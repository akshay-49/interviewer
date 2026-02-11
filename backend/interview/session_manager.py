"""User session management for interview tracking"""
import logging
from datetime import datetime
from typing import Dict, List, Optional
import uuid

logger = logging.getLogger(__name__)

# In-memory session storage: {user_id: {session_id: session_data}}
user_sessions: Dict[str, Dict[str, dict]] = {}


class UserSession:
    """Represents a user's interview session"""
    
    def __init__(self, user_id: str, session_id: str = None):
        self.user_id = user_id
        self.session_id = session_id or str(uuid.uuid4())
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.interview_data = {}
        self.recordings = []
        self.completed = False
        self.summary = None
    
    def to_dict(self):
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "completed": self.completed,
            "recordings": self.recordings,
            "summary": self.summary
        }


class SessionManager:
    """Manages interview sessions per user"""
    
    @staticmethod
    def create_session(user_id: str) -> UserSession:
        """Create a new session for a user"""
        if user_id not in user_sessions:
            user_sessions[user_id] = {}
        
        session = UserSession(user_id)
        user_sessions[user_id][session.session_id] = session.to_dict()
        
        logger.info(f"Created session {session.session_id} for user {user_id}")
        return session
    
    @staticmethod
    def get_session(user_id: str, session_id: str) -> Optional[UserSession]:
        """Get a specific session for a user"""
        if user_id not in user_sessions or session_id not in user_sessions[user_id]:
            return None
        
        session_data = user_sessions[user_id][session_id]
        session = UserSession(user_id, session_id)
        session.completed = session_data.get("completed", False)
        session.recordings = session_data.get("recordings", [])
        session.summary = session_data.get("summary")
        
        return session
    
    @staticmethod
    def get_user_sessions(user_id: str) -> List[Dict]:
        """Get all sessions for a user"""
        if user_id not in user_sessions:
            return []
        
        return list(user_sessions[user_id].values())
    
    @staticmethod
    def update_session(user_id: str, session_id: str, updates: dict):
        """Update session data"""
        if user_id not in user_sessions or session_id not in user_sessions[user_id]:
            logger.warning(f"Session {session_id} not found for user {user_id}")
            return False
        
        session_data = user_sessions[user_id][session_id]
        session_data.update(updates)
        session_data["updated_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Updated session {session_id} for user {user_id}")
        return True
    
    @staticmethod
    def add_recording(user_id: str, session_id: str, recording_info: dict):
        """Add a recording reference to a session"""
        if user_id not in user_sessions or session_id not in user_sessions[user_id]:
            return False
        
        session_data = user_sessions[user_id][session_id]
        if "recordings" not in session_data:
            session_data["recordings"] = []
        
        session_data["recordings"].append(recording_info)
        session_data["updated_at"] = datetime.utcnow().isoformat()
        
        return True
    
    @staticmethod
    def complete_session(user_id: str, session_id: str, summary: dict = None):
        """Mark a session as completed"""
        if user_id not in user_sessions or session_id not in user_sessions[user_id]:
            return False
        
        session_data = user_sessions[user_id][session_id]
        session_data["completed"] = True
        session_data["summary"] = summary
        session_data["updated_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Completed session {session_id} for user {user_id}")
        return True
    
    @staticmethod
    def delete_session(user_id: str, session_id: str):
        """Delete a session"""
        if user_id not in user_sessions or session_id not in user_sessions[user_id]:
            return False
        
        del user_sessions[user_id][session_id]
        
        # Clean up empty user entries
        if not user_sessions[user_id]:
            del user_sessions[user_id]
        
        logger.info(f"Deleted session {session_id} for user {user_id}")
        return True
