from typing import TypedDict, List, Set, Optional, Dict
from pydantic import BaseModel


class Question(BaseModel):
    question: str


class Evaluation(BaseModel):
    score: float
    topic: str
    strengths: List[str]
    weaknesses: List[str]


class Feedback(BaseModel):
    feedback: str

class SpokenTransition(BaseModel):
    transition: str

class SpokenClosing(BaseModel):
    spoken_closing: str


class InterviewState(TypedDict):
    role: str
    experience: str

    current_question: Optional[str]
    last_answer_text: Optional[str]

    evaluation: Optional[Evaluation]
    feedback: Optional[str]

    score_history: List[float]
    weak_topics: Set[str]

    difficulty: str
    question_count: int
    end_interview: bool
    asked_questions: List[str]

    summary: Optional[Dict]
    spoken_closing: Optional[str]
    spoken_transition: Optional[str]
