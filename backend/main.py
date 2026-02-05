from fastapi import FastAPI, HTTPException, File, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from uuid import uuid4

# Pydantic Models for Request Bodies
class DeleteMultipleQuestionsRequest(BaseModel):
    question_ids: List[str]
from langgraph.types import Command
import base64
import os
import asyncio
import json
import logging
import requests
from datetime import datetime, timedelta

from backend.interview.models import InterviewState
from typing import cast
from backend.interview.graph import build_graph_strict, build_graph_coach
from backend.interview.agents import hint_agent
from backend.core.config import (
    DEFAULT_PERSONA,
    AVAILABLE_PERSONAS,
    SESSION_TTL_MINUTES,
    MAX_SESSIONS
)
from backend.auth.routes import router as auth_router
from backend.interview.recording_routes import router as recording_router
from backend.interview.history_routes import router as history_router
from backend.core.cosmos import init_cosmos_db
from backend.interview.enhanced_session_manager import SessionManager
from backend.core.auth0_manager import Auth0Manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Disable Cosmos DB verbose logging
logging.getLogger('azure.cosmos').setLevel(logging.WARNING)
logging.getLogger('azure.identity').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.WARNING)

# --------------------------------------------------
# App
# --------------------------------------------------

app = FastAPI(title="Voice Interview Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Specific origins for credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include authentication routes
app.include_router(auth_router)

# Include recording management routes
app.include_router(recording_router)

# Include history/sessions routes
app.include_router(history_router)

# Initialize Cosmos DB
init_cosmos_db()

# --------------------------------------------------
# LangGraph (build once)
# --------------------------------------------------

try:
    # Maintain separate graphs per persona
    graphs = {
        "strict": build_graph_strict(),
        "coach": build_graph_coach(),
    }
    logger.info("Interview graphs compiled successfully")
except Exception as e:
    logger.error(f"Failed to compile graphs: {e}")
    raise

# Session management with TTL
SESSION_PERSONAS: dict[str, str] = {}  # session_id → persona
SESSION_TIMESTAMPS: dict[str, datetime] = {}  # session_id → last_access_time
SESSION_LAST_PROMPT: dict[str, str] = {}  # session_id → latest question prompt
SESSION_CONTEXT: dict[str, dict] = {}  # session_id → context (role, experience, persona)


def cleanup_expired_sessions():
    """Remove sessions older than SESSION_TTL_MINUTES."""
    now = datetime.now()
    expired = [
        sid for sid, timestamp in SESSION_TIMESTAMPS.items()
        if now - timestamp > timedelta(minutes=SESSION_TTL_MINUTES)
    ]
    for sid in expired:
        SESSION_PERSONAS.pop(sid, None)
        SESSION_TIMESTAMPS.pop(sid, None)
        SESSION_LAST_PROMPT.pop(sid, None)
        SESSION_CONTEXT.pop(sid, None)
    if expired:
        logger.info(f"Cleaned up {len(expired)} expired sessions")


def validate_session(session_id: str) -> str:
    """Validate session exists and return persona. Raises HTTPException if invalid."""
    cleanup_expired_sessions()
    
    if session_id not in SESSION_PERSONAS:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Update access time
    SESSION_TIMESTAMPS[session_id] = datetime.now()
    return SESSION_PERSONAS[session_id]


def create_session(persona: str) -> str:
    """Create new session with persona. Enforces MAX_SESSIONS limit."""
    cleanup_expired_sessions()
    
    if len(SESSION_PERSONAS) >= MAX_SESSIONS:
        raise HTTPException(
            status_code=503,
            detail=f"Maximum concurrent sessions ({MAX_SESSIONS}) reached. Try again later."
        )
    
    session_id = str(uuid4())
    SESSION_PERSONAS[session_id] = persona
    SESSION_TIMESTAMPS[session_id] = datetime.now()
    logger.info(f"Created session {session_id} with persona '{persona}'")
    return session_id

# --------------------------------------------------
# Schemas
# --------------------------------------------------

class StartInterviewRequest(BaseModel):
    role: str
    experience: str
    role_description: Optional[str] = None
    persona: Optional[str] = DEFAULT_PERSONA  # 'strict' or 'coach'


class AnswerRequest(BaseModel):
    session_id: str
    answer: str
    skip: Optional[bool] = False
    recording_blob_url: Optional[str] = None  # URL to recording in blob storage


class EndSessionRequest(BaseModel):
    session_id: str

class ContinueRequest(BaseModel):
    session_id: str


class HintRequest(BaseModel):
    session_id: str

# --------------------------------------------------
# STT endpoints removed - using Azure SDK in frontend
# --------------------------------------------------

# --------------------------------------------------
# Azure Speech Token (Secure)
# --------------------------------------------------

@app.get("/speech/token")
def get_speech_token():
    """
    Generate short-lived Azure Speech authorization token (expires in 10 minutes).
    This keeps the API key secure on the server.
    """
    AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
    AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "westus")
    
    token_url = f"https://{AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    headers = {"Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY}
    
    try:
        response = requests.post(token_url, headers=headers)
        if response.status_code == 200:
            logger.info("Azure Speech token generated successfully")
            return {
                "token": response.text,
                "region": AZURE_SPEECH_REGION
            }
        else:
            logger.error(f"Failed to get token: {response.status_code} - {response.text}")
            raise HTTPException(status_code=500, detail="Failed to get speech token")
    except Exception as e:
        logger.error(f"Error getting speech token: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get speech token: {str(e)}")

# --------------------------------------------------

@app.get("/")
def health():
    return {"status": "ok"}

# --------------------------------------------------
# Start Interview
# --------------------------------------------------

@app.post("/interview/start")
def start_interview(req: StartInterviewRequest):
    logger.info(f"Starting interview: role={req.role}, experience={req.experience}, persona={req.persona}")
    
    # Validate persona
    persona = (req.persona or DEFAULT_PERSONA).lower()
    if persona not in AVAILABLE_PERSONAS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid persona '{persona}'. Must be one of: {AVAILABLE_PERSONAS}"
        )

    # Create session with limit enforcement
    try:
        session_id = create_session(persona)
    except HTTPException:
        raise

    # Store lightweight session context for hinting
    SESSION_CONTEXT[session_id] = {
        "role": req.role,
        "experience": req.experience,
        "persona": persona,
    }
    
    # Create Cosmos DB session for tracking and history
    try:
        # Get user info from context if available (can be enhanced with auth later)
        user_id = getattr(req, 'user_id', 'anonymous')
        user_email = getattr(req, 'user_email', 'anonymous@example.com')
        
        SessionManager.create_session(
            user_id=user_id,
            user_email=user_email,
            user_name=getattr(req, 'user_name', None),
            job_title=getattr(req, 'job_title', None),
            company_name=getattr(req, 'company_name', None),
            total_questions=0  # Will be updated as questions are asked
        )
    except Exception as e:
        logger.warning(f"Could not create Cosmos DB session: {e}")

    # Validate inputs
    if not req.role or not req.role.strip():
        raise HTTPException(status_code=400, detail="Role is required")
    if not req.experience or not req.experience.strip():
        raise HTTPException(status_code=400, detail="Experience is required")

    state: InterviewState = {
        "role": req.role,
        "experience": req.experience,
        "role_description": req.role_description or None,
        "persona": persona,

        "current_question": None,
        "last_answer_text": None,

        "evaluation": None,
        "feedback": None,
        "evaluations_history": [],

        "score_history": [],
        "weak_topics": set(),

        "difficulty": "easy",
        "question_count": 0,
        "end_interview": False,
        "asked_questions": [],

        "summary": None,
        "spoken_transition": None,
        "spoken_closing": None,
    }

    try:
        result = graphs[persona].invoke(
            state,
            config={"configurable": {"thread_id": session_id}},
        )
    except Exception as e:
        logger.error(f"Graph invocation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")

    if "__interrupt__" not in result:
        raise HTTPException(status_code=500, detail="Interview did not start")

    question = result["__interrupt__"][0].value["prompt"]
    
    logger.info(f"Interview started successfully: session={session_id}")

    SESSION_LAST_PROMPT[session_id] = question

    return {
        "session_id": session_id,
        "question": question,
        "total_questions": 5,  # Default interview has 5 questions
    }

# --------------------------------------------------
# Answer Interview Question
# --------------------------------------------------

@app.post("/interview/answer")
def answer_interview(req: AnswerRequest):
    # Validate session
    persona = validate_session(req.session_id)
    
    answer_preview = (req.answer[:50] if req.answer else "EMPTY")
    skip_text = " (SKIP)" if req.skip else ""
    logger.info(f"Answer received: session={req.session_id}, preview='{answer_preview}...'{skip_text}")
    
    if not req.answer or not req.answer.strip():
        logger.warning(f"Empty answer received for session {req.session_id}")
    
    try:
        result = graphs[persona].invoke(
            Command(resume=req.answer or "[Skip]" if req.skip else req.answer),
            config={"configurable": {"thread_id": req.session_id}},
        )
    except Exception as e:
        logger.error(f"Graph invocation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process answer: {str(e)}")

    logger.info(f"After answer invoke: question_count={result.get('question_count')}, end_interview={result.get('end_interview')}")


    # -----------------------------
    # Interview finished
    # -----------------------------
    if result.get("summary"):
        logger.info(f"Interview completed: session={req.session_id}")
        
        if "spoken_closing" not in result:
            raise HTTPException(
                status_code=500,
                detail="spoken_closing missing from final state"
            )

        closing_text = result["spoken_closing"]
        
        # Try to store the answer to Cosmos DB before returning
        try:
            # Get the current question and evaluation data
            current_question = result.get("current_question")
            question_count = result.get("question_count", 0)
            
            if result.get("evaluation"):
                ev = result["evaluation"]
                evaluation_score = ev.score if hasattr(ev, 'score') else ev.get('score', 0)
                evaluation_feedback = ev.feedback if hasattr(ev, 'feedback') else ev.get('feedback', '')
                question_topic = ev.topic if hasattr(ev, 'topic') else ev.get('topic', 'General')
            else:
                evaluation_score = 0
                evaluation_feedback = ''
                question_topic = 'General'
            
            # Store answer with recording if provided
            SessionManager.add_answer_to_session(
                session_id=req.session_id,
                question_number=question_count,
                question_text=current_question or "Question",
                question_topic=question_topic,
                user_answer=req.answer,
                evaluation_score=evaluation_score,
                evaluation_feedback=evaluation_feedback,
                recording_blob_url=req.recording_blob_url
            )
        except Exception as e:
            logger.warning(f"Could not store answer to Cosmos DB: {e}")

        # Extract evaluation data for the last question
        evaluation_data = None
        if result.get("evaluation"):
            ev = result["evaluation"]
            evaluation_data = {
                "score": ev.score if hasattr(ev, 'score') else ev.get('score'),
                "topic": ev.topic if hasattr(ev, 'topic') else ev.get('topic'),
                "strengths": ev.strengths if hasattr(ev, 'strengths') else ev.get('strengths', []),
                "weaknesses": ev.weaknesses if hasattr(ev, 'weaknesses') else ev.get('weaknesses', []),
            }

        # Store final session results to Cosmos DB
        try:
            summary = result.get("summary", {})
            overall_score = sum(result.get("score_history", [])) / max(len(result.get("score_history", [])), 1) if result.get("score_history") else 0
            hints_used = len([h for h in result.get("evaluations_history", []) if h])  # Placeholder
            questions_skipped = len([q for q in result.get("weak_topics", [])])  # Placeholder
            
            SessionManager.complete_session(
                session_id=req.session_id,
                summary=summary,
                overall_score=overall_score,
                hints_used=hints_used,
                questions_skipped=questions_skipped,
                closing_audio_blob_url=None  # Can be set if closing audio is generated
            )
        except Exception as e:
            logger.warning(f"Could not complete session in Cosmos DB: {e}")

        return {
            "final": True,
            "summary": result["summary"],
            "spoken_closing": closing_text,
            "evaluation": evaluation_data,
        }

    # -----------------------------
    # Interview continues
    # -----------------------------
    if "__interrupt__" not in result:
        raise HTTPException(status_code=500, detail="Expected next step")

    # Distinguish between feedback pause (coach) vs next question
    transition = result.get("spoken_transition")
    feedback = result.get("feedback")
    interrupt_payload = result["__interrupt__"][0].value
    
    logger.info(f"Submit answer result: question_count={result.get('question_count')}, end_interview={result.get('end_interview')}, has_summary={bool(result.get('summary'))}")
    logger.info(f"DEBUG: feedback={bool(feedback)}, transition={bool(transition)}, interrupt_payload={interrupt_payload}, persona={result.get('persona')}")

    # Coach flow: pause after feedback and let user press Proceed
    # We show feedback if: (1) we have fresh feedback from evaluation, AND
    # (2) we're coming from await_continue pause (have "continue" in interrupt), AND
    # (3) this is the first pause for this answer (transition not yet set)
    if feedback and interrupt_payload.get("continue") and not transition:
        logger.info(f"Coach feedback step: session={req.session_id}")
        
        # Store the answer with evaluation to Cosmos DB
        try:
            current_question = result.get("current_question")
            question_count = result.get("question_count", 0)
            
            if result.get("evaluation"):
                ev = result["evaluation"]
                evaluation_score = ev.score if hasattr(ev, 'score') else ev.get('score', 0)
                evaluation_feedback = ev.feedback if hasattr(ev, 'feedback') else ev.get('feedback', '')
                question_topic = ev.topic if hasattr(ev, 'topic') else ev.get('topic', 'General')
            else:
                evaluation_score = 0
                evaluation_feedback = ''
                question_topic = 'General'
            
            SessionManager.add_answer_to_session(
                session_id=req.session_id,
                question_number=question_count,
                question_text=current_question or "Question",
                question_topic=question_topic,
                user_answer=req.answer,
                evaluation_score=evaluation_score,
                evaluation_feedback=evaluation_feedback,
                recording_blob_url=req.recording_blob_url
            )
        except Exception as e:
            logger.warning(f"Could not store answer to Cosmos DB: {e}")

        # Capture current question for retry and display
        question = result.get("current_question") or interrupt_payload.get("prompt")
        if question:
            SESSION_LAST_PROMPT[req.session_id] = question
        
        # Extract evaluation data for frontend tracking
        evaluation_data = None
        if result.get("evaluation"):
            ev = result["evaluation"]
            evaluation_data = {
                "score": ev.score if hasattr(ev, 'score') else ev.get('score'),
                "topic": ev.topic if hasattr(ev, 'topic') else ev.get('topic'),
                "strengths": ev.strengths if hasattr(ev, 'strengths') else ev.get('strengths', []),
                "weaknesses": ev.weaknesses if hasattr(ev, 'weaknesses') else ev.get('weaknesses', []),
            }
            
        return {
            "final": False,
            "step": "feedback",
            "feedback": feedback,
            "question": question,
            "evaluation": evaluation_data,
        }

    # Otherwise, treat it as next-question (strict or coach after proceed)
    question = interrupt_payload.get("prompt")
    transition = result.get("spoken_transition") or ""
    
    logger.info(f"Next question: session={req.session_id}")

    if question:
        SESSION_LAST_PROMPT[req.session_id] = question

    # Extract evaluation data for frontend tracking (available for all personas)
    evaluation_data = None
    if result.get("evaluation"):
        ev = result["evaluation"]
        evaluation_data = {
            "score": ev.score if hasattr(ev, 'score') else ev.get('score'),
            "topic": ev.topic if hasattr(ev, 'topic') else ev.get('topic'),
            "strengths": ev.strengths if hasattr(ev, 'strengths') else ev.get('strengths', []),
            "weaknesses": ev.weaknesses if hasattr(ev, 'weaknesses') else ev.get('weaknesses', []),
        }

    # Combine transition + question naturally
    if transition and transition.strip():
        spoken_text = f"{transition} {question}"
    else:
        spoken_text = question

    return {
        "final": False,
        "step": "question",
        "question": question,
        "spoken_transition": transition,
        "evaluation": evaluation_data,
    }

# --------------------------------------------------
# End Interview Early
# --------------------------------------------------

@app.post("/interview/end")
def end_interview(req: EndSessionRequest):
    logger.info(f"Early end requested: session={req.session_id}")
    
    # Validate session
    persona = validate_session(req.session_id)
    
    # Step 1: Resume to process current answer and get state
    try:
        result = graphs[persona].invoke(
            Command(resume="[Session ended early by user]"),
            config={"configurable": {"thread_id": req.session_id}},
        )
    except Exception as e:
        logger.error(f"Error during resume: {e}")
        result = {}
    
    # Step 2: If we don't have a summary, manually call end_interview_agent
    if not result.get("summary"):
        logger.info("No summary from graph, calling end_interview_agent directly")
        from backend.interview.agents import end_interview_agent
        
        # The end_interview_agent needs score_history and weak_topics from state
        # which should be in the graph's memory now
        summary_result = end_interview_agent(cast(InterviewState, result))
        result.update(summary_result)
    
    logger.info(f"Interview ended early: session={req.session_id}")
    
    if result.get("summary"):
        closing_text = result.get("spoken_closing", "Session ended. Thank you for the interview!")
        
        return {
            "final": True,
            "summary": result["summary"],
            "spoken_closing": closing_text,
        }
    else:
        # Return error if summary couldn't be generated
        raise HTTPException(
            status_code=500,
            detail="Failed to generate summary for early end"
        )

# --------------------------------------------------
# Proceed to Next Question (Coach persona)
# --------------------------------------------------

@app.post("/interview/continue")
def continue_after_feedback(req: ContinueRequest):
    logger.info(f"Continue after feedback: session={req.session_id}")
    
    # Validate session
    persona = validate_session(req.session_id)

    try:
        result = graphs[persona].invoke(
            Command(resume="[Proceed]"),
            config={"configurable": {"thread_id": req.session_id}},
        )
    except Exception as e:
        logger.error(f"Graph invocation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to continue: {str(e)}")

    logger.info(f"After continue invoke: question_count={result.get('question_count')}, end_interview={result.get('end_interview')}")

    if "__interrupt__" not in result:
        raise HTTPException(status_code=500, detail="Expected next question")

    interrupt_payload = result["__interrupt__"][0].value
    question = interrupt_payload.get("prompt")
    transition = result.get("spoken_transition")

    logger.info(f"Next question after continue: session={req.session_id}")

    if question:
        SESSION_LAST_PROMPT[req.session_id] = question

    spoken_text = f"{transition} {question}" if transition else question

    return {
        "final": False,
        "step": "question",
        "question": question,
        "spoken_transition": transition,
    }


# --------------------------------------------------
# Hint for current question
# --------------------------------------------------

@app.post("/interview/hint")
def get_hint(req: HintRequest):
    logger.info(f"Hint requested: session={req.session_id}")

    # Validate session
    persona = validate_session(req.session_id)

    question = SESSION_LAST_PROMPT.get(req.session_id)
    if not question:
        raise HTTPException(status_code=400, detail="No active question found for this session")

    ctx = SESSION_CONTEXT.get(req.session_id, {})
    try:
        hint = hint_agent(question, ctx.get("role"), ctx.get("experience"))
        hint_text = hint.hint if hasattr(hint, "hint") else hint.get("hint") if isinstance(hint, dict) else None
    except Exception as e:
        logger.error(f"Hint generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate hint")

    if not hint_text:
        logger.warning(f"Hint empty for session {req.session_id}")
        raise HTTPException(status_code=500, detail="Hint not available")

    return {
        "hint": hint_text,
        "persona": persona,
    }

# --------------------------------------------------
# Save Session Results to Cosmos DB
# --------------------------------------------------

class SaveSessionResultsRequest(BaseModel):
    session_id: str
    user_id: str
    user_email: str
    user_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    summary: Dict[str, Any]
    overall_score: float
    hints_used: int
    questions_skipped: int
    total_questions: Optional[int] = None
    answers: Optional[List[Dict[str, Any]]] = None
    question_wise_feedback: List[Dict[str, Any]]  # All Q&A with evaluations
    duration_seconds: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


@app.post("/session/save-results")
def save_session_results(req: SaveSessionResultsRequest):
    """Save complete interview session results to Cosmos DB"""
    logger.info(f"Saving session results: session={req.session_id}, user={req.user_id}")
    
    try:
        from backend.core.cosmos import sessions_container, serialize_for_cosmos
        from datetime import datetime
        
        # Build the session document
        session_doc = {
            "id": req.session_id,  # Cosmos DB requires 'id' field
            "session_id": req.session_id,
            "user_id": req.user_id,
            "user_email": req.user_email,
            "user_name": req.user_name,
            "job_title": req.job_title,
            "company_name": req.company_name,
            "summary": req.summary,
            "overall_score": req.overall_score,
            "hints_used": req.hints_used,
            "questions_skipped": req.questions_skipped,
            "total_questions": req.total_questions,
            "answers": req.answers or [],
            "question_wise_feedback": req.question_wise_feedback,
            "duration_seconds": req.duration_seconds,
            "started_at": req.started_at,
            "completed_at": req.completed_at or datetime.utcnow().isoformat(),
        }
        
        # Serialize all datetime and complex objects
        serialized_doc = serialize_for_cosmos(session_doc)
        
        # Save to Cosmos DB
        sessions_container.upsert_item(serialized_doc)
        logger.info(f"Successfully saved session {req.session_id} to Cosmos DB")
        
        return {
            "success": True,
            "session_id": req.session_id,
            "message": "Session results saved successfully"
        }
    except Exception as e:
        logger.error(f"Error saving session results: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save session results: {str(e)}")


# --------------------------------------------------
# Get User Session History from Cosmos DB
# --------------------------------------------------

class GetUserHistoryRequest(BaseModel):
    user_id: str


@app.post("/session/user-history")
def get_user_history(req: GetUserHistoryRequest):
    """Get all session history for a user from Cosmos DB"""
    logger.info(f"Fetching history for user={req.user_id}")
    
    try:
        from backend.core.cosmos import sessions_container
        
        # Query sessions for this user
        query = """
            SELECT * FROM sessions 
            WHERE sessions.user_id = @user_id 
            ORDER BY sessions.completed_at DESC
        """
        
        items = list(sessions_container.query_items(
            query=query,
            parameters=[{"name": "@user_id", "value": req.user_id}],
            max_item_count=50
        ))
        
        logger.info(f"Found {len(items)} sessions for user {req.user_id}")
        return {
            "success": True,
            "user_id": req.user_id,
            "sessions": items
        }
    except Exception as e:
        logger.error(f"Error fetching user history: {e}")
        # Return empty array instead of error to avoid breaking UI
        return {
            "success": False,
            "user_id": req.user_id,
            "sessions": [],
            "error": str(e)
        }


# --------------------------------------------------
# User Profile Management
# --------------------------------------------------

class SaveUserProfileRequest(BaseModel):
    user_id: str
    user_name: str
    user_email: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    experience_level: Optional[str] = None


@app.post("/user/save-profile")
def save_user_profile(req: SaveUserProfileRequest):
    """Save or update user profile in Cosmos DB"""
    logger.info(f"Saving profile for user={req.user_id}")
    
    try:
        from backend.core.cosmos import users_container, serialize_for_cosmos
        from datetime import datetime
        
        # Build user profile document
        user_doc = {
            "id": req.user_id,  # Cosmos DB requires 'id' field
            "user_id": req.user_id,
            "user_name": req.user_name,
            "user_email": req.user_email,
            "job_title": req.job_title,
            "company_name": req.company_name,
            "experience_level": req.experience_level,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Serialize for Cosmos
        serialized_doc = serialize_for_cosmos(user_doc)
        
        # Upsert to Cosmos DB (creates or updates)
        users_container.upsert_item(serialized_doc)
        logger.info(f"Successfully saved profile for user {req.user_id}")
        
        return {
            "success": True,
            "user_id": req.user_id,
            "message": "Profile saved successfully"
        }
    except Exception as e:
        logger.error(f"Error saving user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {str(e)}")


class GetUserProfileRequest(BaseModel):
    user_id: str


@app.post("/user/get-profile")
def get_user_profile(req: GetUserProfileRequest):
    """Get user profile from Cosmos DB"""
    logger.info(f"Fetching profile for user={req.user_id}")
    
    try:
        from backend.core.cosmos import users_container
        
        # Query for user profile
        query = "SELECT * FROM users WHERE users.user_id = @user_id"
        
        items = list(users_container.query_items(
            query=query,
            parameters=[{"name": "@user_id", "value": req.user_id}],
            max_item_count=1
        ))
        
        if items:
            logger.info(f"Found profile for user {req.user_id}")
            return {
                "success": True,
                "profile": items[0]
            }
        else:
            logger.info(f"No profile found for user {req.user_id}")
            return {
                "success": False,
                "profile": None,
                "message": "Profile not found"
            }
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


@app.get("/admin/users-cosmos")
def get_all_users_from_cosmos():
    """Get all users from Cosmos DB (for admin dashboard - no auth for testing)"""
    logger.info("Fetching all users from Cosmos DB")
    
    try:
        from backend.core.cosmos import users_container
        
        # Query for all users
        query = "SELECT * FROM users"
        
        items = list(users_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        
        logger.info(f"Found {len(items)} users in Cosmos DB")
        
        # Transform to match expected format
        users = []
        for item in items:
            # Convert Cosmos _ts (seconds since epoch) to ISO string
            created_at = None
            if "_ts" in item:
                try:
                    from datetime import datetime
                    created_at = datetime.fromtimestamp(item["_ts"]).isoformat()
                except:
                    created_at = None
            
            users.append({
                "id": item.get("user_id"),
                "email": item.get("user_email"),
                "full_name": item.get("user_name"),
                "is_active": item.get("is_active", True),
                "is_admin": item.get("is_admin", item.get("user_email", "").endswith("@accellor.com")),
                "auth_provider": item.get("auth_provider", "auth0"),
                "created_at": created_at,
                "job_title": item.get("job_title"),
                "company_name": item.get("company_name"),
                "experience_level": item.get("experience_level")
            })
        
        return {
            "success": True,
            "users": users
        }
    except Exception as e:
        logger.error(f"Error fetching users from Cosmos: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@app.post("/admin/update-user-admin")
def update_user_admin_status(req: dict):
    """Toggle admin status for a user in Cosmos DB"""
    user_id = req.get("user_id")
    is_admin = req.get("is_admin")
    
    logger.info(f"Updating admin status for user {user_id} to {is_admin}")
    
    try:
        from backend.core.cosmos import users_container
        
        # Get existing user
        query = "SELECT * FROM users WHERE users.user_id = @user_id"
        items = list(users_container.query_items(
            query=query,
            parameters=[{"name": "@user_id", "value": user_id}],
            max_item_count=1
        ))
        
        if not items:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = items[0]
        user["is_admin"] = is_admin
        
        # Update in Cosmos
        users_container.upsert_item(user)
        
        logger.info(f"Successfully updated admin status for user {user_id}")
        return {"success": True, "message": "Admin status updated"}
    except Exception as e:
        logger.error(f"Error updating admin status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update: {str(e)}")


@app.post("/admin/update-user-active")
def update_user_active_status(req: dict):
    """Toggle active status for a user in Cosmos DB"""
    user_id = req.get("user_id")
    is_active = req.get("is_active")
    
    logger.info(f"Updating active status for user {user_id} to {is_active}")
    
    try:
        from backend.core.cosmos import users_container
        
        # Get existing user
        query = "SELECT * FROM users WHERE users.user_id = @user_id"
        items = list(users_container.query_items(
            query=query,
            parameters=[{"name": "@user_id", "value": user_id}],
            max_item_count=1
        ))
        
        if not items:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = items[0]
        user["is_active"] = is_active
        
        # Update in Cosmos
        users_container.upsert_item(user)
        
        logger.info(f"Successfully updated active status for user {user_id}")
        return {"success": True, "message": "Active status updated"}
    except Exception as e:
        logger.error(f"Error updating active status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update: {str(e)}")


@app.post("/admin/send-invite")
def send_invite(req: dict):
    """Send interview invite to a candidate and create user in Cosmos DB"""
    candidate_name = req.get("fullName")
    candidate_email = req.get("email")
    role = req.get("role", "")
    seniority_level = req.get("seniorityLevel", "Senior")
    job_description = req.get("jobDescription", "")
    
    if not candidate_name or not candidate_email:
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    try:
        from backend.core.cosmos import client
        import secrets
        from azure.cosmos.partition_key import PartitionKey
        
        # Get database
        db = client.get_database_client("interviewer")
        
        # Get or create invites container
        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )
        
        # Get users container
        try:
            users_container = db.get_container_client("users")
        except Exception:
            users_container = db.create_container(
                id="users",
                partition_key=PartitionKey(path="/user_id")
            )
        
        # Generate unique invite code
        invite_code = secrets.token_urlsafe(32)
        user_id = str(uuid4())
        
        # Create user record in Cosmos DB users container
        user_doc = {
            "id": user_id,
            "user_id": user_id,
            "name": candidate_name,
            "email": candidate_email,
            "role": role,
            "seniority_level": seniority_level,
            "job_description": job_description,
            "created_at": datetime.utcnow().isoformat(),
            "invite_code": invite_code,
            "invite_status": "sent",
            "interview_completed": False,
            "invited_by_admin": True,
            "access_enabled": True
        }
        users_container.create_item(user_doc)
        
        # Store invite record in invites container (for tracking)
        invite_doc = {
            "id": str(uuid4()),
            "invite_code": invite_code,
            "user_id": user_id,
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "role": role,
            "seniority_level": seniority_level,
            "job_description": job_description,
            "created_at": datetime.utcnow().isoformat(),
            "status": "sent",
            "interview_completed": False,
            "access_enabled": True
        }
        invites_container.create_item(invite_doc)
        
        # Generate invite link
        invite_link = f"http://localhost:5173/invite/{invite_code}"
        
        # Log the invite link (no email service)
        logger.info(f"📧 INVITE LINK FOR {candidate_name} ({candidate_email}): {invite_link}")
        logger.info(f"📧 Role: {seniority_level} | Position: {role}")
        
        return {
            "success": True,
            "message": f"Invitation created for {candidate_email}. Check backend logs for link.",
            "invite_code": invite_code,
            "invite_link": invite_link
        }
    except Exception as e:
        logger.error(f"Error creating invite: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create invite: {str(e)}")




@app.post("/admin/validate-invite")
def validate_invite(req: dict):
    """Validate invite code and return candidate details"""
    invite_code = req.get("invite_code")
    
    if not invite_code:
        raise HTTPException(status_code=400, detail="Invite code is required")
    
    try:
        from backend.core.cosmos import client
        from azure.cosmos.partition_key import PartitionKey
        
        # Get database
        db = client.get_database_client("interviewer")
        
        # Get or create invites container
        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )
        
        # Query for invite
        query = "SELECT * FROM invites WHERE invites.invite_code = @code"
        items = list(invites_container.query_items(
            query=query,
            parameters=[{"name": "@code", "value": invite_code}],
            max_item_count=1
        ))
        
        if not items:
            raise HTTPException(status_code=404, detail="Invite not found or already used")
        
        invite = items[0]
        
        # Check if invite is still valid
        if invite.get("status") == "used":
            raise HTTPException(status_code=400, detail="This invite has already been used")
        
        if invite.get("status") == "expired":
            raise HTTPException(status_code=400, detail="This invite has expired")
        
        # Check if access is enabled
        if not invite.get("access_enabled", True):
            raise HTTPException(status_code=403, detail="This invite link is no longer active. Please contact your admin.")
        
        return {
            "success": True,
            "invite": {
                "candidate_name": invite.get("candidate_name"),
                "candidate_email": invite.get("candidate_email"),
                "seniority_level": invite.get("seniority_level"),
                "role": invite.get("role"),
                "job_description": invite.get("job_description"),
                "invite_code": invite_code
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating invite: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to validate invite: {str(e)}")


@app.post("/admin/register-invited-user")
def register_invited_user(req: dict):
    """Register an invited user in Auth0 and update Cosmos DB"""
    invite_code = req.get("invite_code")
    password = req.get("password")
    
    if not invite_code or not password:
        raise HTTPException(status_code=400, detail="invite_code and password are required")
    
    try:
        from backend.core.cosmos import client
        from azure.cosmos.partition_key import PartitionKey
        
        # Get database
        db = client.get_database_client("interviewer")
        
        # Get invites container
        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )
        
        # Get users container
        try:
            users_container = db.get_container_client("users")
        except Exception:
            users_container = db.create_container(
                id="users",
                partition_key=PartitionKey(path="/user_id")
            )
        
        # Find the invite
        query = "SELECT * FROM invites WHERE invites.invite_code = @code"
        items = list(invites_container.query_items(
            query=query,
            parameters=[{"name": "@code", "value": invite_code}],
            max_item_count=1
        ))
        
        if not items:
            raise HTTPException(status_code=404, detail="Invite not found")
        
        invite = items[0]
        
        # Check if access is still enabled
        if not invite.get("access_enabled", True):
            raise HTTPException(status_code=403, detail="This invite is no longer active")
        
        # Create user in Auth0
        auth0 = Auth0Manager()
        try:
            auth0_user = auth0.create_user(
                email=invite.get("candidate_email"),
                password=password,
                user_metadata={
                    "job_title": invite.get("role"),
                    "level": invite.get("seniority_level"),
                    "invite_code": invite_code,
                    "registered_at": datetime.utcnow().isoformat()
                }
            )
            auth0_user_id = auth0_user.get("user_id")
        except Exception as e:
            # If Auth0 M2M is not configured, continue with registration using invite code
            logger.warning(f"Auth0 user creation failed, using invite-based registration: {e}")
            auth0_user_id = None
        
        # Update user record in Cosmos DB with Auth0 user_id
        user_id = invite.get("user_id")
        if user_id:
            user_query = "SELECT * FROM users WHERE users.user_id = @id"
            user_items = list(users_container.query_items(
                query=user_query,
                parameters=[{"name": "@id", "value": user_id}],
                max_item_count=1,
                enable_cross_partition_query=True
            ))
            
            if user_items:
                user = user_items[0]
                if auth0_user_id:
                    user["auth0_user_id"] = auth0_user_id
                user["auth0_email"] = invite.get("candidate_email")
                user["registered_at"] = datetime.utcnow().isoformat()
                users_container.replace_item(item=user["id"], body=user)
        
        logger.info(f"✅ Registered invited user: {user_id} (Auth0 ID: {auth0_user_id or 'N/A'})")
        
        return {
            "success": True,
            "message": "User registered successfully",
            "user_id": user_id,
            "auth0_user_id": auth0_user_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering invited user: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to register user: {str(e)}")


@app.get("/admin/get-invites")
def get_invites():
    """Get all invitations from Cosmos DB"""
    try:
        from backend.core.cosmos import client
        from azure.cosmos.partition_key import PartitionKey
        
        # Get database
        db = client.get_database_client("interviewer")
        
        # Get or create invites container
        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )
        
        # Query all invites ordered by creation date (newest first)
        query = "SELECT * FROM invites ORDER BY invites.created_at DESC"
        items = list(invites_container.query_items(query=query, enable_cross_partition_query=True))
        
        return {
            "success": True,
            "invites": items
        }
    except Exception as e:
        logger.error(f"Error fetching invites: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch invites: {str(e)}")


@app.delete("/admin/delete-invite/{invite_code}")
def delete_invite(invite_code: str):
    """Delete an invite and revoke user access"""
    try:
        from backend.core.cosmos import client
        from azure.cosmos.partition_key import PartitionKey
        
        db = client.get_database_client("interviewer")
        
        # Get invites container
        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )
        
        # Get users container
        try:
            users_container = db.get_container_client("users")
        except Exception:
            users_container = db.create_container(
                id="users",
                partition_key=PartitionKey(path="/user_id")
            )
        
        # Find the invite to get user_id
        query = "SELECT * FROM invites WHERE invites.invite_code = @code"
        items = list(invites_container.query_items(
            query=query,
            parameters=[{"name": "@code", "value": invite_code}],
            max_item_count=1,
            enable_cross_partition_query=True
        ))
        
        if not items:
            raise HTTPException(status_code=404, detail="Invite not found")
        
        invite = items[0]
        user_id = invite.get("user_id")
        
        # Delete from invites container
        invites_container.delete_item(item=invite["id"], partition_key=invite.get("invite_code"))
        
        # Delete from users container if user_id exists
        if user_id:
            try:
                user_query = "SELECT * FROM users WHERE users.user_id = @id"
                user_items = list(users_container.query_items(
                    query=user_query,
                    parameters=[{"name": "@id", "value": user_id}],
                    max_item_count=1,
                    enable_cross_partition_query=True
                ))
                
                if user_items:
                    user = user_items[0]
                    users_container.delete_item(item=user["id"], partition_key=user.get("user_id"))
            except Exception as e:
                logger.warning(f"Could not delete user record: {e}")
        
        return {
            "success": True,
            "message": f"Invite revoked and user access removed"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting invite: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete invite: {str(e)}")


@app.post("/admin/toggle-access/{invite_code}")
def toggle_access(invite_code: str, req: dict):
    """Toggle access enabled/disabled for an invite"""
    access_enabled = req.get("access_enabled", True)
    
    try:
        from backend.core.cosmos import client
        from azure.cosmos.partition_key import PartitionKey
        
        db = client.get_database_client("interviewer")
        
        # Get invites container
        try:
            invites_container = db.get_container_client("invites")
        except Exception:
            invites_container = db.create_container(
                id="invites",
                partition_key=PartitionKey(path="/invite_code")
            )
        
        # Get users container
        try:
            users_container = db.get_container_client("users")
        except Exception:
            users_container = db.create_container(
                id="users",
                partition_key=PartitionKey(path="/user_id")
            )
        
        # Find and update the invite
        query = "SELECT * FROM invites WHERE invites.invite_code = @code"
        items = list(invites_container.query_items(
            query=query,
            parameters=[{"name": "@code", "value": invite_code}],
            max_item_count=1,
            enable_cross_partition_query=True
        ))
        
        if not items:
            raise HTTPException(status_code=404, detail="Invite not found")
        
        invite = items[0]
        invite["access_enabled"] = access_enabled
        invites_container.replace_item(item=invite["id"], body=invite)
        
        # Also update user record if exists
        user_id = invite.get("user_id")
        if user_id:
            try:
                user_query = "SELECT * FROM users WHERE users.user_id = @id"
                user_items = list(users_container.query_items(
                    query=user_query,
                    parameters=[{"name": "@id", "value": user_id}],
                    max_item_count=1,
                    enable_cross_partition_query=True
                ))
                
                if user_items:
                    user = user_items[0]
                    user["access_enabled"] = access_enabled
                    users_container.replace_item(item=user["id"], body=user)
            except Exception as e:
                logger.warning(f"Could not update user access status: {e}")
        
        return {
            "success": True,
            "message": f"Access {'enabled' if access_enabled else 'disabled'}",
            "access_enabled": access_enabled
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling access: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle access: {str(e)}")


# ============================================================================
# QUESTIONS API ENDPOINTS
# ============================================================================

@app.get("/admin/get-questions")
async def get_questions(
    category: Optional[str] = None,
    role: Optional[str] = None,
    experience: Optional[str] = None,
    limit: int = 100
):
    """
    Fetch interview questions from Cosmos DB with optional filters.
    
    Parameters:
    - category: Filter by category (Technical, Behavioral, Architecture, etc.)
    - role: Filter by role (Frontend, Backend, DevOps, Data Science, All Roles)
    - experience: Filter by experience (Intern, Junior, Mid-Level, Senior, Staff, Principal, Entry-level)
    - limit: Maximum number of questions to return (default: 100)
    """
    try:
        from backend.core.cosmos import questions_container
        
        # Build query dynamically based on filters
        where_clauses = []
        parameters = []
        
        if category:
            where_clauses.append("c.category = @category")
            parameters.append({"name": "@category", "value": category})
        
        if role:
            where_clauses.append("c.role = @role")
            parameters.append({"name": "@role", "value": role})
        
        if experience:
            where_clauses.append("c.experience = @experience")
            parameters.append({"name": "@experience", "value": experience})
        
        # Build the query
        query = "SELECT * FROM questions c"
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
        query += " ORDER BY c.created_at DESC"
        
        # Execute query
        items = list(questions_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        # Apply limit
        items = items[:limit]
        
        # Backfill experience for older records
        for item in items:
            if "experience" not in item or not item.get("experience"):
                item["experience"] = "Mid-Level"

        logger.info(f"✅ Fetched {len(items)} questions (category={category}, role={role}, experience={experience})")
        
        return {
            "success": True,
            "questions": items,
            "count": len(items)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {str(e)}")


@app.get("/admin/questions-stats")
async def get_questions_stats():
    """
    Get statistics about stored interview questions.
    Returns counts by category, role, and experience.
    """
    try:
        from backend.core.cosmos import questions_container
        
        # Get total count
        total_query = "SELECT VALUE COUNT(1) FROM questions c"
        total_count = list(questions_container.query_items(
            query=total_query,
            enable_cross_partition_query=True
        ))[0]
        
        # Get counts by category
        category_query = "SELECT c.category, COUNT(1) as count FROM questions c GROUP BY c.category"
        try:
            categories = list(questions_container.query_items(
                query=category_query,
                enable_cross_partition_query=True
            ))
        except:
            categories = []
        
        # Get counts by role
        role_query = "SELECT c.role, COUNT(1) as count FROM questions c GROUP BY c.role"
        try:
            roles = list(questions_container.query_items(
                query=role_query,
                enable_cross_partition_query=True
            ))
        except:
            roles = []
        
        # Get counts by experience
        experience_query = "SELECT c.experience, COUNT(1) as count FROM questions c GROUP BY c.experience"
        try:
            experiences = list(questions_container.query_items(
                query=experience_query,
                enable_cross_partition_query=True
            ))
        except:
            experiences = []
        
        return {
            "success": True,
            "total_questions": total_count,
            "by_category": categories,
            "by_role": roles,
            "by_experience": experiences
        }
        
    except Exception as e:
        logger.error(f"Error fetching question stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@app.get("/admin/analytics")
async def get_admin_analytics():
    """
    Get overall platform analytics: total sessions, today's sessions, average scores.
    """
    try:
        from backend.core.cosmos import sessions_container
        from datetime import datetime, timedelta
        
        # Get all sessions
        query = "SELECT c.overall_score, c.completed_at FROM sessions c"
        all_sessions = list(sessions_container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))
        
        total_sessions = len(all_sessions)
        
        # Calculate today's sessions (completed today)
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
        
        today_sessions = 0
        completed_scores = []
        
        for session in all_sessions:
            completed_at = session.get('completed_at')
            if completed_at:
                # Parse the timestamp if it's a string
                if isinstance(completed_at, str):
                    try:
                        completed_date = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                    except:
                        completed_date = None
                else:
                    completed_date = completed_at
                
                if completed_date and completed_date >= today_start:
                    today_sessions += 1
            
            # Collect scores for average
            score = session.get('overall_score')
            if score is not None:
                completed_scores.append(score)
        
        # Calculate average score
        average_score = sum(completed_scores) / len(completed_scores) if completed_scores else 0
        
        return {
            "success": True,
            "total_sessions": total_sessions,
            "today_sessions": today_sessions,
            "average_score": average_score,
            "active_sessions": 0  # Would need WebSocket for real-time
        }
        
    except Exception as e:
        logger.error(f"Error fetching admin analytics: {e}")
        # Return default values on error instead of raising
        return {
            "success": True,
            "total_sessions": 0,
            "today_sessions": 0,
            "average_score": 0,
            "active_sessions": 0
        }


@app.get("/admin/recent-activity")
async def get_recent_activity(limit: int = 10):
    """
    Get recent platform activity: new users, completed interviews, etc.
    """
    try:
        from backend.core.cosmos import users_container, sessions_container
        from datetime import datetime, timedelta
        
        activities = []
        now = datetime.utcnow()
        
        # Get recently created users (last 24 hours)
        try:
            user_query = "SELECT c.user_name, c.user_email, c.created_at FROM users c ORDER BY c.created_at DESC"
            recent_users = list(users_container.query_items(
                query=user_query,
                enable_cross_partition_query=True,
                max_item_count=50
            ))
            
            for user in recent_users[:5]:  # Top 5 recent users
                created_at = user.get('created_at')
                if created_at:
                    if isinstance(created_at, str):
                        try:
                            created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        except:
                            created_date = None
                    else:
                        created_date = created_at
                    
                    if created_date and (now - created_date).days <= 7:  # Within last 7 days
                        time_diff = now - created_date
                        if time_diff.days == 0:
                            if time_diff.seconds < 3600:
                                time_ago = f"{time_diff.seconds // 60} minutes ago"
                            else:
                                time_ago = f"{time_diff.seconds // 3600} hours ago"
                        else:
                            time_ago = f"{time_diff.days} days ago"
                        
                        activities.append({
                            "type": "user_registered",
                            "icon": "person_add",
                            "title": f"New user registered",
                            "description": user.get('user_name') or user.get('user_email', 'Unknown'),
                            "time_ago": time_ago,
                            "timestamp": created_at
                        })
        except Exception as e:
            logger.warning(f"Error fetching recent users: {e}")
        
        # Get recently completed interviews (last 24 hours)
        try:
            session_query = "SELECT c.user_name, c.overall_score, c.completed_at FROM sessions c WHERE c.completed_at != null ORDER BY c.completed_at DESC"
            recent_sessions = list(sessions_container.query_items(
                query=session_query,
                enable_cross_partition_query=True,
                max_item_count=50
            ))
            
            for session in recent_sessions[:5]:  # Top 5 recent sessions
                completed_at = session.get('completed_at')
                if completed_at:
                    if isinstance(completed_at, str):
                        try:
                            completed_date = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
                        except:
                            completed_date = None
                    else:
                        completed_date = completed_at
                    
                    if completed_date and (now - completed_date).days <= 7:
                        time_diff = now - completed_date
                        if time_diff.days == 0:
                            if time_diff.seconds < 3600:
                                time_ago = f"{time_diff.seconds // 60} minutes ago"
                            else:
                                time_ago = f"{time_diff.seconds // 3600} hours ago"
                        else:
                            time_ago = f"{time_diff.days} days ago"
                        
                        score = session.get('overall_score', 0)
                        activities.append({
                            "type": "interview_completed",
                            "icon": "check_circle",
                            "title": "Interview completed",
                            "description": f"{session.get('user_name', 'User')} - Score: {score:.1f}/10",
                            "time_ago": time_ago,
                            "timestamp": completed_at
                        })
        except Exception as e:
            logger.warning(f"Error fetching recent sessions: {e}")
        
        # Sort by timestamp (most recent first) and limit
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        activities = activities[:limit]
        
        return {
            "success": True,
            "activities": activities
        }
        
    except Exception as e:
        logger.error(f"Error fetching recent activity: {e}")
        return {
            "success": True,
            "activities": []
        }



@app.get("/admin/user-question-history/{user_id}")
async def get_user_question_history(user_id: str):
    """
    Get all questions that have been asked to a specific user.
    Shows which questions they've already been asked (to avoid repetition).
    """
    try:
        from backend.core.cosmos import question_logs_container
        
        # Get all questions asked to this user
        query = "SELECT * FROM question_logs c WHERE c.user_id = @user_id ORDER BY c.asked_at DESC"
        items = list(question_logs_container.query_items(
            query=query,
            parameters=[{"name": "@user_id", "value": user_id}],
            enable_cross_partition_query=False
        ))
        
        # Get unique question IDs
        unique_question_ids = set(item['question_id'] for item in items)
        
        logger.info(f"✅ Fetched question history for user {user_id}: {len(unique_question_ids)} unique questions")
        
        return {
            "success": True,
            "user_id": user_id,
            "total_questions_asked": len(items),
            "unique_questions": len(unique_question_ids),
            "question_logs": items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user question history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@app.get("/admin/question/{question_id}/usage")
async def get_question_usage(question_id: str):
    """
    Get usage statistics for a specific question.
    Shows how many users have been asked this question.
    """
    try:
        from backend.core.cosmos import question_logs_container, questions_container
        
        # Get question details
        try:
            question = next(questions_container.query_items(
                query="SELECT * FROM questions c WHERE c.id = @question_id",
                parameters=[{"name": "@question_id", "value": question_id}],
                enable_cross_partition_query=True
            ), None)
        except:
            question = None
        
        # Get usage logs for this question
        query = "SELECT * FROM question_logs c WHERE c.question_id = @question_id ORDER BY c.asked_at DESC"
        items = list(question_logs_container.query_items(
            query=query,
            parameters=[{"name": "@question_id", "value": question_id}],
            enable_cross_partition_query=True
        ))
        
        # Calculate stats
        total_asked = len(items)
        answered = sum(1 for item in items if item.get('answered', False))
        avg_score = sum(item.get('answer_score', 0) for item in items if item.get('answer_score')) / answered if answered > 0 else 0
        
        logger.info(f"✅ Question {question_id} has been asked {total_asked} times")
        
        return {
            "success": True,
            "question_id": question_id,
            "question_text": question.get('text') if question else "N/A",
            "total_times_asked": total_asked,
            "times_answered": answered,
            "average_score": avg_score,
            "usage_logs": items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching question usage: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch usage: {str(e)}")


@app.delete("/admin/question/{question_id}")
async def delete_question(question_id: str):
    """
    Delete a single question by ID.
    """
    try:
        from backend.core.cosmos import questions_container
        
        # Delete the question from Cosmos DB
        # First get it to find the partition key (category)
        question = next(questions_container.query_items(
            query="SELECT * FROM questions c WHERE c.id = @question_id",
            parameters=[{"name": "@question_id", "value": question_id}],
            enable_cross_partition_query=True
        ), None)
        
        if not question:
            raise HTTPException(status_code=404, detail=f"Question {question_id} not found")
        
        # Delete using partition key
        questions_container.delete_item(item=question_id, partition_key=question.get('category'))
        
        logger.info(f"✅ Deleted question {question_id}")
        
        return {
            "success": True,
            "message": f"Question {question_id} deleted successfully",
            "deleted_question_id": question_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting question: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")


@app.post("/admin/questions/delete-multiple")
async def delete_multiple_questions(request: DeleteMultipleQuestionsRequest):
    """
    Delete multiple questions by their IDs.
    """
    question_ids = request.question_ids
    if not question_ids:
        raise HTTPException(status_code=400, detail="No questions to delete")
    
    try:
        from backend.core.cosmos import questions_container
        
        deleted_count = 0
        failed_ids = []
        
        for question_id in question_ids:
            try:
                # Get question to find partition key
                question = next(questions_container.query_items(
                    query="SELECT * FROM questions c WHERE c.id = @question_id",
                    parameters=[{"name": "@question_id", "value": question_id}],
                    enable_cross_partition_query=True
                ), None)
                
                if question:
                    questions_container.delete_item(item=question_id, partition_key=question.get('category'))
                    deleted_count += 1
                else:
                    failed_ids.append(question_id)
                    
            except Exception as e:
                logger.warning(f"Failed to delete question {question_id}: {e}")
                failed_ids.append(question_id)
        
        logger.info(f"✅ Deleted {deleted_count} questions")
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "failed_count": len(failed_ids),
            "failed_ids": failed_ids,
            "message": f"Successfully deleted {deleted_count} of {len(question_ids)} questions"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting multiple questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete questions: {str(e)}")