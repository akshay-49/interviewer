from typing import Dict
from langgraph.types import interrupt
from backend.models import InterviewState
from backend.agents import (
    ask_question_agent,
    evaluate_answer_agent,
    feedback_agent,
    decision_agent,
    end_interview_agent,
    transition_agent
)


def ask_question_node(state: InterviewState) -> Dict:
    """
    Generate the next interview question.

    Use the candidate's role, experience, difficulty level,
    weak topics, and previously asked questions to produce
    a professional interview question.

    Update the current question and track it as asked.
    """
    q = ask_question_agent(state)
    return {
        "current_question": q.question,
        "asked_questions": state["asked_questions"] + [q.question],
    }


def await_answer_node(state: InterviewState) -> Dict:
    """
    Pause execution and wait for the candidate's answer.

    Present the current question as a prompt and stop execution
    until an external system resumes the graph with the answer text.
    """
    answer = interrupt({"prompt": state["current_question"]})
    return {"last_answer_text": answer}


def evaluate_node(state: InterviewState) -> Dict:
    """
    Evaluate the candidate's answer.

    Analyze the answer for quality and understanding.
    Assign a numeric score and identify the primary topic,
    strengths, and weaknesses.
    """
    ev = evaluate_answer_agent(state)
    return {
        "evaluation": ev,
        "score_history": state["score_history"] + [ev.score],
    }


def feedback_node(state: InterviewState) -> Dict:
    """
    Generate concise interview-style feedback.

    Explain what the candidate did well and what should
    be improved based on the evaluation.
    """
    fb = feedback_agent(state["evaluation"])
    return {"feedback": fb.feedback}


def decision_node(state: InterviewState) -> Dict:
    """
    Decide the next interview step.

    Adjust difficulty based on performance.
    Track weak topics when answers are poor.
    Increment question count and determine
    whether the interview should end.
    """
    d = decision_agent(state, state["evaluation"])

    weak_topics = set(state["weak_topics"])
    if d["add_weak_topic"]:
        weak_topics.add(state["evaluation"].topic)

    return {
        "difficulty": d["difficulty"],
        "end_interview": d["end_interview"],
        "question_count": state["question_count"] + 1,
        "weak_topics": weak_topics,
    }

def transition_node(state: InterviewState) -> Dict:
    t = transition_agent(state)
    return {"spoken_transition": t.transition}

def end_node(state: InterviewState) -> Dict:
    """
    Produce the final interview summary.

    Aggregate scores, identify weak topics,
    and generate an overall performance verdict.
    """
    return end_interview_agent(state)
