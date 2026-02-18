"""API routes for managing interview history and session results"""
from fastapi import APIRouter, Depends, HTTPException
import os
from typing import List, Optional
from datetime import datetime
from fastapi import Request
from backend.core.cosmos import (
    get_user_sessions, 
    get_session, 
    delete_session,
    SessionResult
)
from pydantic import BaseModel

router = APIRouter(prefix="/history", tags=["history"])


def _is_dev_mode() -> bool:
    """Check if running in development mode"""
    return os.getenv("ENVIRONMENT", "development") != "production"


def _is_admin(current_user: dict) -> bool:
    """Check if user is admin"""
    # In development mode, always allow admin access
    if _is_dev_mode():
        return True
    # In production, check user attributes
    email = (current_user.get("email") or "").lower()
    return current_user.get("is_admin", False) or email.endswith("@accellor.com")


def _get_current_user(request: Request) -> dict:
    """Simple auth dependency - dev mode allows any request"""
    if _is_dev_mode():
        return {
            "auth0_sub": "dev|admin",
            "email": "admin@dev.local",
            "full_name": "Development Admin",
            "is_admin": True,
            "email_verified": True
        }
    # In production, would need real auth - for now just dev
    return {
        "auth0_sub": "dev|admin",
        "email": "admin@dev.local",
        "full_name": "Development Admin",
        "is_admin": True,
        "email_verified": True
    }


class SessionSummary(BaseModel):
    """Summary of a session for history list"""
    session_id: str
    user_name: Optional[str]
    job_title: Optional[str]
    company_name: Optional[str]
    total_questions: int
    overall_score: Optional[float]
    hints_used: int
    questions_skipped: int
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]


class SessionDetail(BaseModel):
    """Detailed session information"""
    session_id: str
    user_email: str
    user_name: Optional[str]
    job_title: Optional[str]
    company_name: Optional[str]
    total_questions: int
    overall_score: Optional[float]
    hints_used: int
    questions_skipped: int
    summary: Optional[dict]
    closing_audio_blob_url: Optional[str]
    session_recording_blob_url: Optional[str]
    question_wise_feedback: Optional[List[dict]]
    recording_mode: Optional[str] = 'audio'  # Track if interview was audio or video
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]
    answers: List[dict]


@router.get("/user-sessions", response_model=List[SessionSummary])
async def get_user_interview_history(
    current_user = Depends(_get_current_user),
    limit: int = 50
):
    """Get interview history for current user"""
    try:
        user_id = current_user.get('sub') or current_user.get('user_id')
        sessions = get_user_sessions(user_id, limit=limit)
        
        result = []
        for session in sessions:
            session_summary = SessionSummary(
                session_id=session.get('session_id'),
                user_name=session.get('user_name'),
                job_title=session.get('job_title'),
                company_name=session.get('company_name'),
                total_questions=session.get('total_questions', 0),
                overall_score=session.get('overall_score'),
                hints_used=session.get('hints_used', 0),
                questions_skipped=session.get('questions_skipped', 0),
                started_at=session.get('started_at', datetime.utcnow()),
                completed_at=session.get('completed_at'),
                duration_seconds=session.get('duration_seconds')
            )
            result.append(session_summary)
        
        return result
    except Exception as e:
        print(f"Error fetching user sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/user-sessions/{user_id}", response_model=List[SessionSummary])
async def get_user_sessions_admin(
    user_id: str,
    current_user = Depends(_get_current_user),
    limit: int = 50
):
    """Get interview history for a specific user (admin only)."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        sessions = get_user_sessions(user_id, limit=limit)
        result = []
        for session in sessions:
            session_summary = SessionSummary(
                session_id=session.get('session_id'),
                user_name=session.get('user_name'),
                job_title=session.get('job_title'),
                company_name=session.get('company_name'),
                total_questions=session.get('total_questions', 0),
                overall_score=session.get('overall_score'),
                hints_used=session.get('hints_used', 0),
                questions_skipped=session.get('questions_skipped', 0),
                started_at=session.get('started_at', datetime.utcnow()),
                completed_at=session.get('completed_at'),
                duration_seconds=session.get('duration_seconds')
            )
            result.append(session_summary)

        return result
    except Exception as e:
        print(f"Error fetching admin user sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}", response_model=SessionDetail)
async def get_session_details(
    session_id: str,
    current_user = Depends(_get_current_user)
):
    """Get detailed information for a specific session"""
    try:
        user_id = current_user.get('sub') or current_user.get('user_id')
        session = get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify user owns this session
        if session.get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to session")
        
        # Ensure question_wise_feedback is populated
        qwf = session.get('question_wise_feedback', [])
        print(f"DEBUG: Session {session_id} question_wise_feedback from DB: {qwf}")
        print(f"DEBUG: Full session keys: {list(session.keys())}")
        if not qwf and session.get('summary'):
            print(f"Warning: Session {session_id} has summary but no question_wise_feedback")
        
        session_detail = SessionDetail(
            session_id=session.get('session_id'),
            user_email=session.get('user_email'),
            user_name=session.get('user_name'),
            job_title=session.get('job_title'),
            company_name=session.get('company_name'),
            total_questions=session.get('total_questions', 0),
            overall_score=session.get('overall_score'),
            hints_used=session.get('hints_used', 0),
            questions_skipped=session.get('questions_skipped', 0),
            summary=session.get('summary'),
            closing_audio_blob_url=session.get('closing_audio_blob_url'),
            session_recording_blob_url=session.get('session_recording_blob_url'),
            question_wise_feedback=qwf,
            recording_mode=session.get('recording_mode', 'audio'),
            started_at=session.get('started_at', datetime.utcnow()),
            completed_at=session.get('completed_at'),
            duration_seconds=session.get('duration_seconds'),
            answers=session.get('answers', [])
        )
        
        print(f"DEBUG: Returning SessionDetail with {len(qwf)} questions")
        return session_detail
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching session details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session-debug/{session_id}")
async def get_session_details_debug(
    session_id: str,
    current_user = Depends(_get_current_user)
):
    """Debug endpoint - returns raw session from Cosmos DB (no auth check, no validation)"""
    try:
        session = get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Return raw document
        print(f"DEBUG: Returning raw session with keys: {list(session.keys())}")
        return session
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in debug endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/session/{session_id}", response_model=SessionDetail)
async def get_session_details_admin(
    session_id: str,
    current_user = Depends(_get_current_user)
):
    """Get detailed information for a specific session (admin only)."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        session = get_session(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Ensure question_wise_feedback is populated for admin view
        qwf = session.get('question_wise_feedback', [])
        print(f"DEBUG ADMIN: Session {session_id} question_wise_feedback from DB: {qwf}")
        print(f"DEBUG ADMIN: Full session keys: {list(session.keys())}")
        if not qwf and session.get('summary'):
            print(f"Warning: Admin view - Session {session_id} has summary but no question_wise_feedback")

        session_detail = SessionDetail(
            session_id=session.get('session_id'),
            user_email=session.get('user_email'),
            user_name=session.get('user_name'),
            job_title=session.get('job_title'),
            company_name=session.get('company_name'),
            total_questions=session.get('total_questions', 0),
            overall_score=session.get('overall_score'),
            hints_used=session.get('hints_used', 0),
            questions_skipped=session.get('questions_skipped', 0),
            summary=session.get('summary'),
            closing_audio_blob_url=session.get('closing_audio_blob_url'),
            session_recording_blob_url=session.get('session_recording_blob_url'),
            question_wise_feedback=qwf,
            recording_mode=session.get('recording_mode', 'audio'),
            started_at=session.get('started_at', datetime.utcnow()),
            completed_at=session.get('completed_at'),
            duration_seconds=session.get('duration_seconds'),
            answers=session.get('answers', [])
        )

        print(f"DEBUG ADMIN: Returning SessionDetail with {len(qwf)} questions")
        return session_detail
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching admin session details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session-public/{session_id}", response_model=SessionDetail)
async def get_session_details_public(
    session_id: str
):
    """Get session details without authentication (public fallback for expired auth)."""
    try:
        session = get_session(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Ensure question_wise_feedback is populated
        qwf = session.get('question_wise_feedback', [])
        print(f"DEBUG PUBLIC: Session {session_id} question_wise_feedback from DB: {qwf}")
        print(f"DEBUG PUBLIC: Full session keys: {list(session.keys())}")
        if not qwf and session.get('summary'):
            print(f"Warning: Public view - Session {session_id} has summary but no question_wise_feedback")

        session_detail = SessionDetail(
            session_id=session.get('session_id'),
            user_email=session.get('user_email'),
            user_name=session.get('user_name'),
            job_title=session.get('job_title'),
            company_name=session.get('company_name'),
            total_questions=session.get('total_questions', 0),
            overall_score=session.get('overall_score'),
            hints_used=session.get('hints_used', 0),
            questions_skipped=session.get('questions_skipped', 0),
            summary=session.get('summary'),
            closing_audio_blob_url=session.get('closing_audio_blob_url'),
            session_recording_blob_url=session.get('session_recording_blob_url'),
            question_wise_feedback=qwf,
            recording_mode=session.get('recording_mode', 'audio'),
            started_at=session.get('started_at', datetime.utcnow()),
            completed_at=session.get('completed_at'),
            duration_seconds=session.get('duration_seconds'),
            answers=session.get('answers', [])
        )

        print(f"DEBUG PUBLIC: Returning SessionDetail with {len(qwf)} questions")
        return session_detail
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching public session details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session/{session_id}")
async def delete_interview_session(
    session_id: str,
    current_user = Depends(_get_current_user)
):
    """Delete a session (admin only or session owner)"""
    try:
        user_id = current_user.get('sub') or current_user.get('user_id')
        session = get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify user owns this session or is admin
        is_admin = current_user.get('is_admin', False)
        if session.get('user_id') != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="Unauthorized access to session")
        
        success = delete_session(session_id)
        if success:
            return {"message": "Session deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete session")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
