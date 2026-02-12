"""Recording management API endpoints"""
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
import logging
from backend.core.blob_storage import get_blob_manager
from backend.interview.session_manager import SessionManager
from backend.auth.auth0_utils import get_current_user_from_cookie

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recordings", tags=["Recordings"])


# DEBUG: Simple test endpoint
@router.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify router is working"""
    return {"status": "ok", "message": "recordings router is working"}


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
    session_id: str = Query(...),
    file: UploadFile = File(...)
):
    """Upload a recording for a session"""
    logger.info(f"✅ Recording upload endpoint hit! session_id={session_id}, file={file.filename}")
    
    try:
        # Read file data
        file_data = await file.read()
        logger.info(f"📦 File read complete: {len(file_data)} bytes")
        
        # Upload to blob storage
        # For now, use a generic user_id since we removed auth
        user_id = "anonymous"
        blob_manager = get_blob_manager()
        
        blob_url = blob_manager.upload_recording(
            user_id=user_id,
            session_id=session_id,
            file_data=file_data,
            file_name=file.filename
        )
        
        logger.info(f"💾 Recording uploaded to blob storage: {blob_url}")
        
        # Generate SAS URL for 24-hour access (required for private storage account)
        sas_url = blob_manager.get_sas_url(
            user_id=user_id,
            session_id=session_id,
            file_name=file.filename,
            expiry_hours=24
        )
        
        if sas_url:
            logger.info(f"🔗 Generated SAS URL for recording playback")
            response_url = sas_url
        else:
            logger.warning(f"⚠️  SAS URL generation failed, falling back to direct blob URL (may fail if public access disabled)")
            response_url = blob_url
        
        return {
            "message": "Recording uploaded successfully",
            "recording": {
                "file_name": file.filename,
                "size": len(file_data),
                "url": response_url
            }
        }
    
    except Exception as e:
        logger.error(f"❌ Failed to upload recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload recording: {str(e)}"
        )


@router.get("/sas-url")
async def get_recording_sas_url(
    user_id: str = "anonymous",
    session_id: str = Query(...),
    file_name: str = Query(...)
):
    """
    Generate a SAS URL for accessing a recording
    
    This endpoint creates temporary signed URLs for recordings stored in private blob storage.
    Used when recordings need to be accessed from the browser.
    """
    try:
        logger.info(f"🔑 Generating SAS URL for {user_id}/{session_id}/{file_name}")
        
        blob_manager = get_blob_manager()
        sas_url = blob_manager.get_sas_url(
            user_id=user_id,
            session_id=session_id,
            file_name=file_name,
            expiry_hours=24
        )
        
        if not sas_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate SAS URL. AZURE_STORAGE_ACCOUNT_KEY may not be configured."
            )
        
        return {
            "message": "SAS URL generated successfully",
            "sas_url": sas_url,
            "expiry_hours": 24
        }
    
    except Exception as e:
        logger.error(f"❌ Failed to generate SAS URL: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"SAS URL generation failed: {str(e)}"
        )


@router.get("/session/{session_id}")
async def get_session_recordings(
    session_id: str,
    auth0_user: dict = Depends(get_current_user_from_cookie)
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
async def get_user_recordings(auth0_user: dict = Depends(get_current_user_from_cookie)):
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
    auth0_user: dict = Depends(get_current_user_from_cookie)
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
