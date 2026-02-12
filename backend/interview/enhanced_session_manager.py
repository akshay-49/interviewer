"""Enhanced session manager with Cosmos DB integration"""
from datetime import datetime
from uuid import uuid4
from typing import Optional, Dict, List, Any
from backend.core.cosmos import (
    create_session, 
    add_answer_to_session,
    update_session_summary,
    update_session_closing_audio,
    AnswerRecord,
    SessionResult
)
from backend.core.blob_storage import get_blob_manager


class SessionManager:
    """Manages interview sessions with Cosmos DB persistence"""
    
    # In-memory session state during interview
    _active_sessions: Dict[str, Dict] = {}
    
    @staticmethod
    def create_session(
        user_id: str,
        user_email: str,
        user_name: Optional[str] = None,
        job_title: Optional[str] = None,
        company_name: Optional[str] = None,
        total_questions: int = 0,
        recording_mode: str = 'audio'
    ) -> str:
        """Create a new interview session"""
        session_id = str(uuid4())
        
        session_data = {
            'session_id': session_id,
            'user_id': user_id,
            'user_email': user_email,
            'user_name': user_name,
            'job_title': job_title,
            'company_name': company_name,
            'total_questions': total_questions,
            'recording_mode': recording_mode,
            'answers': [],
            'hints_used': 0,
            'questions_skipped': 0,
            'started_at': datetime.utcnow(),
            'completed_at': None,
            'overall_score': None,
            'summary': None,
            'closing_audio_blob_url': None
        }
        
        # Store in memory for current session
        SessionManager._active_sessions[session_id] = session_data
        
        # Also persist to Cosmos DB
        try:
            create_session(session_data)
        except Exception as e:
            print(f"Warning: Could not save session to Cosmos DB: {e}")
        
        return session_id
    
    @staticmethod
    def add_answer_to_session(
        session_id: str,
        question_number: int,
        question_text: str,
        question_topic: str,
        user_answer: str,
        evaluation_score: float,
        evaluation_feedback: str,
        recording_blob_url: Optional[str] = None
    ) -> bool:
        """Add an answer/evaluation to session"""
        try:
            answer_record = AnswerRecord(
                question_number=question_number,
                question_text=question_text,
                question_topic=question_topic,
                user_answer=user_answer,
                recording_blob_url=recording_blob_url,
                evaluation_score=evaluation_score,
                evaluation_feedback=evaluation_feedback
            )
            
            # Update in memory
            if session_id in SessionManager._active_sessions:
                if 'answers' not in SessionManager._active_sessions[session_id]:
                    SessionManager._active_sessions[session_id]['answers'] = []
                SessionManager._active_sessions[session_id]['answers'].append(answer_record.dict())
            
            # Persist to Cosmos DB
            add_answer_to_session(session_id, answer_record)
            return True
        except Exception as e:
            print(f"Error adding answer: {e}")
            return False
    
    @staticmethod
    def complete_session(
        session_id: str,
        summary: Dict[str, Any],
        overall_score: float,
        hints_used: int,
        questions_skipped: int,
        closing_audio_blob_url: Optional[str] = None
    ) -> bool:
        """Mark session as completed with final summary"""
        try:
            # Calculate duration
            if session_id in SessionManager._active_sessions:
                session = SessionManager._active_sessions[session_id]
                started_at = session.get('started_at')
                if started_at:
                    duration = int((datetime.utcnow() - started_at).total_seconds())
                    session['duration_seconds'] = duration
            
            # Update Cosmos DB
            success = update_session_summary(
                session_id,
                summary,
                overall_score,
                hints_used,
                questions_skipped
            )
            
            # Update closing audio if provided
            if closing_audio_blob_url:
                update_session_closing_audio(session_id, closing_audio_blob_url)
            
            # Update in memory
            if session_id in SessionManager._active_sessions:
                SessionManager._active_sessions[session_id].update({
                    'summary': summary,
                    'overall_score': overall_score,
                    'hints_used': hints_used,
                    'questions_skipped': questions_skipped,
                    'closing_audio_blob_url': closing_audio_blob_url,
                    'completed_at': datetime.utcnow()
                })
            
            return success
        except Exception as e:
            print(f"Error completing session: {e}")
            return False
    
    @staticmethod
    def get_session(session_id: str) -> Optional[Dict]:
        """Get session from memory (for active session)"""
        return SessionManager._active_sessions.get(session_id)
    
    @staticmethod
    def update_session_metadata(
        session_id: str,
        hints_used: Optional[int] = None,
        questions_skipped: Optional[int] = None
    ):
        """Update session metadata during interview"""
        if session_id in SessionManager._active_sessions:
            session = SessionManager._active_sessions[session_id]
            if hints_used is not None:
                session['hints_used'] = hints_used
            if questions_skipped is not None:
                session['questions_skipped'] = questions_skipped
