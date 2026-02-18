"""Recording management API endpoints"""
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends, Query, Request
from pydantic import BaseModel
from typing import List, Optional
import logging
import os
from backend.core.blob_storage import get_blob_manager
from backend.core.cosmos import update_session_recording_url, get_session as get_cosmos_session
from backend.interview.enhanced_session_manager import SessionManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recordings", tags=["Recordings"])


def _get_current_user(request: Request) -> dict:
    """Simple auth dependency - returns a dev user"""
    # Development mode - no auth required
    return {
        "user_id": "dev|user",
        "email": "user@dev.local",
        "full_name": "Development User"
    }



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
    current_user: dict = Depends(_get_current_user)
):
    """
    Upload a recording for a session
    
    Args:
        session_id: Interview session ID
        file: Audio file to upload
    """
    try:
        # Resolve user ID from session data
        session = SessionManager.get_session(session_id) or get_cosmos_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        user_id = session.get("user_id") or current_user.get("user_id", "unknown")
        
        # Upload to blob storage
        blob_manager = get_blob_manager()
        file_data = await file.read()
        
        blob_url = blob_manager.upload_recording(
            user_id=user_id,
            session_id=session_id,
            file_data=file_data,
            file_name=file.filename
        )
        if not blob_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Recording upload failed"
            )

        sas_url = blob_manager.get_sas_url(
            user_id=user_id,
            session_id=session_id,
            file_name=file.filename
        )
        
        recording_info = {
            "file_name": file.filename,
            "size": len(file_data),
            "url": sas_url or blob_url,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
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

@router.post("/upload-session")
async def upload_session_recording(
    session_id: str = Query(...),
    file: UploadFile = File(...)
):
    """Upload a full-session recording and attach it to the session record"""
    logger.info(f"✅ Session recording upload hit! session_id={session_id}, file={file.filename}")

    try:
        file_data = await file.read()
        logger.info(f"📦 Session recording read: {len(file_data)} bytes")

        session = SessionManager.get_session(session_id) or get_cosmos_session(session_id)
        user_id = session.get("user_id") if session else "anonymous"
        blob_manager = get_blob_manager()

        blob_url = blob_manager.upload_recording(
            user_id=user_id,
            session_id=session_id,
            file_data=file_data,
            file_name=file.filename
        )

        sas_url = blob_manager.get_sas_url(
            user_id=user_id,
            session_id=session_id,
            file_name=file.filename,
            expiry_hours=24
        )

        if sas_url:
            response_url = sas_url
        else:
            response_url = blob_url

        if response_url:
            update_session_recording_url(session_id, response_url)

        return {
            "message": "Session recording uploaded successfully",
            "recording": {
                "file_name": file.filename,
                "size": len(file_data),
                "url": response_url
            }
        }
    except Exception as e:
        logger.error(f"❌ Failed to upload session recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload session recording: {str(e)}"
        )


@router.get("/session/{session_id}")
async def get_session_recordings(
    session_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Get all recordings for a session"""
    try:
        session = SessionManager.get_session(session_id) or get_cosmos_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        user_id = session.get("user_id") or current_user.get("user_id", "unknown")

        blob_manager = get_blob_manager()
        prefix = f"{user_id}/{session_id}/"
        recordings = []

        for recording in blob_manager.list_user_recordings(user_id):
            name = recording.get("name", "")
            if not name.startswith(prefix):
                continue
            file_name = name.split("/")[-1]
            recordings.append({
                "session_id": session_id,
                "file_name": file_name,
                "size": recording.get("size", 0),
                "url": blob_manager.get_sas_url(user_id, session_id, file_name)
            })

        return {
            "session_id": session_id,
            "recordings": recordings
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
async def get_user_recordings(current_user: dict = Depends(_get_current_user)):
    """Get all sessions and recordings for the current user"""
    try:
        user_id = current_user.get("user_id", "unknown")
        
        blob_manager = get_blob_manager()
        recordings = blob_manager.list_user_recordings(user_id)

        return {
            "user_id": user_id,
            "recordings": recordings
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
    current_user: dict = Depends(_get_current_user)
):
    """Delete a specific recording"""
    try:
        user_id = current_user.get("user_id", "unknown")
        
        # Delete from blob storage
        blob_manager = get_blob_manager()
        blob_manager.delete_recording(user_id, session_id, file_name)
        
        return {"message": "Recording deleted successfully"}
    
    except Exception as e:
        logger.error(f"Failed to delete recording: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
