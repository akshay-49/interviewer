from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from uuid import uuid4
from langgraph.types import Command
import base64

from backend.models import InterviewState
from backend.graph import build_graph
from backend.tts.tts_engine import synthesize_speech

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

graph = build_graph()

# --------------------------------------------------
# Helpers
# --------------------------------------------------

def audio_to_base64(audio_bytes: bytes) -> str:
    return base64.b64encode(audio_bytes).decode("utf-8")

# --------------------------------------------------
# Schemas
# --------------------------------------------------

class StartInterviewRequest(BaseModel):
    role: str
    experience: str


class AnswerRequest(BaseModel):
    session_id: str
    answer: str

# --------------------------------------------------
# Health
# --------------------------------------------------

@app.get("/")
def health():
    return {"status": "ok"}

# --------------------------------------------------
# Start Interview
# --------------------------------------------------

@app.post("/interview/start")
def start_interview(req: StartInterviewRequest):
    session_id = str(uuid4())

    state: InterviewState = {
        "role": req.role,
        "experience": req.experience,

        "current_question": None,
        "last_answer_text": None,

        "evaluation": None,
        "feedback": None,

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

    result = graph.invoke(
        state,
        config={"configurable": {"thread_id": session_id}},
    )

    if "__interrupt__" not in result:
        raise HTTPException(status_code=500, detail="Interview did not start")

    question = result["__interrupt__"][0].value["prompt"]

    audio = synthesize_speech(question)

    return {
        "session_id": session_id,
        "question": question,
        "audio": audio_to_base64(audio),
    }

# --------------------------------------------------
# Answer Interview Question
# --------------------------------------------------

@app.post("/interview/answer")
def answer_interview(req: AnswerRequest):
    print(f"[DEBUG] Received answer for session {req.session_id}: {req.answer[:50]}...")
    result = graph.invoke(
        Command(resume=req.answer),
        config={"configurable": {"thread_id": req.session_id}},
    )
    print(f"[DEBUG] Graph result keys: {result.keys()}")

    # -----------------------------
    # Interview finished
    # -----------------------------
    if result.get("summary"):
        if "spoken_closing" not in result:
            raise HTTPException(
                status_code=500,
                detail="spoken_closing missing from final state"
            )

        closing_text = result["spoken_closing"]
        audio = synthesize_speech(closing_text)

        return {
            "final": True,
            "summary": result["summary"],
            "spoken_closing": closing_text,
            "audio": audio_to_base64(audio),
        }

    # -----------------------------
    # Interview continues
    # -----------------------------
    if "__interrupt__" not in result:
        raise HTTPException(status_code=500, detail="Expected next question")

    question = result["__interrupt__"][0].value["prompt"]
    transition = result.get("spoken_transition")

    # Combine transition + question naturally
    if transition:
        spoken_text = f"{transition} {question}"
    else:
        spoken_text = question

    audio = synthesize_speech(spoken_text)

    return {
        "final": False,
        "question": question,
        "spoken_transition": transition,
        "audio": audio_to_base64(audio),
    }
