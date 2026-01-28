from fastapi import FastAPI, HTTPException, File, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from uuid import uuid4
from langgraph.types import Command
import base64
import os
import asyncio
import json
import logging
import requests
from datetime import datetime, timedelta

from backend.models import InterviewState
from typing import cast
from backend.graph import build_graph_strict, build_graph_coach
from backend.agents import hint_agent
from backend.config import (
    DEFAULT_PERSONA,
    AVAILABLE_PERSONAS,
    SESSION_TTL_MINUTES,
    MAX_SESSIONS
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --------------------------------------------------
# App
# --------------------------------------------------

app = FastAPI(title="Voice Interview Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    }

# --------------------------------------------------
# Answer Interview Question
# --------------------------------------------------

@app.post("/interview/answer")
def answer_interview(req: AnswerRequest):
    # Validate session
    persona = validate_session(req.session_id)
    
    answer_preview = (req.answer[:50] if req.answer else "EMPTY")
    logger.info(f"Answer received: session={req.session_id}, preview='{answer_preview}...'")
    
    if not req.answer or not req.answer.strip():
        logger.warning(f"Empty answer received for session {req.session_id}")
    
    try:
        result = graphs[persona].invoke(
            Command(resume=req.answer),
            config={"configurable": {"thread_id": req.session_id}},
        )
    except Exception as e:
        logger.error(f"Graph invocation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process answer: {str(e)}")


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

    # Coach flow: pause after feedback and let user press Proceed
    if feedback and not transition and interrupt_payload.get("continue"):
        logger.info(f"Coach feedback step: session={req.session_id}")

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
        from backend.agents import end_interview_agent
        
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
