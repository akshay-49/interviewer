"""Recording management API endpoints"""
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
import logging
from backend.core.blob_storage import get_blob_manager
from backend.interview.session_manager import SessionManager
from backend.auth.auth0_utils import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recordings", tags=["Recordings"])


class RecordingInfo(BaseModel):
    """Recording information"""
    session_id: str
    file_name: str
    size: int
    url: Optional[str] = None


class SessionRecordings(BaseModel):
    """Session with recordings"""
    session_id: str
    created_at: str
    completed: bool
    recordings: List[RecordingInfo]


@router.post("/upload")
async def upload_recording(
    session_id: str,
    file: UploadFile = File(...),
    auth0_user: dict = Depends(get_current_user)
):
    """
    Upload a recording for a session
    
    Args:
        session_id: Interview session ID
        file: Audio file to upload
    """
    try:
        # Extract user info
        from backend.auth.auth0_utils import extract_user_info
        user_info = extract_user_info(auth0_user)
        user_id = user_info["auth0_sub"]
        
        # Check session exists
        session = SessionManager.get_session(user_id, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Upload to blob storage
        blob_manager = get_blob_manager()
        file_data = await file.read()
        
        blob_url = blob_manager.upload_recording(
            user_id=user_id,
            session_id=session_id,
            file_data=file_data,
            file_name=file.filename
        )
        
        # Add recording to session
        recording_info = {
            "file_name": file.filename,
            "size": len(file_data),
            "url": blob_url,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
        SessionManager.add_recording(user_id, session_id, recording_info)
        
        logger.info(f"Uploaded recording: {file.filename} for session {session_id}")
        
        return {
            "message": "Recording uploaded successfully",
            "recording": recording_info
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload recording: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/session/{session_id}")
async def get_session_recordings(
    session_id: str,
    auth0_user: dict = Depends(get_current_user)
):
    """Get all recordings for a session"""
    try:
        from backend.auth.auth0_utils import extract_user_info
        user_info = extract_user_info(auth0_user)
        user_id = user_info["auth0_sub"]
        
        session = SessionManager.get_session(user_id, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        return {
            "session_id": session_id,
            "recordings": session.recordings
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recordings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/user")
async def get_user_recordings(auth0_user: dict = Depends(get_current_user)):
    """Get all sessions and recordings for the current user"""
    try:
        from backend.auth.auth0_utils import extract_user_info
        user_info = extract_user_info(auth0_user)
        user_id = user_info["auth0_sub"]
        
        sessions = SessionManager.get_user_sessions(user_id)
        
        return {
            "user_id": user_id,
            "sessions": sessions
        }
    
    except Exception as e:
        logger.error(f"Failed to get user recordings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/recording/{session_id}/{file_name}")
async def delete_recording(
    session_id: str,
    file_name: str,
    auth0_user: dict = Depends(get_current_user)
):
    """Delete a specific recording"""
    try:
        from backend.auth.auth0_utils import extract_user_info
        user_info = extract_user_info(auth0_user)
        user_id = user_info["auth0_sub"]
        
        # Delete from blob storage
        blob_manager = get_blob_manager()
        blob_manager.delete_recording(user_id, session_id, file_name)
        
        # Update session
        session = SessionManager.get_session(user_id, session_id)
        if session:
            session.recordings = [r for r in session.recordings if r["file_name"] != file_name]
            SessionManager.update_session(user_id, session_id, {"recordings": session.recordings})
        
        return {"message": "Recording deleted successfully"}
    
    except Exception as e:
        logger.error(f"Failed to delete recording: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


from datetime import datetime
