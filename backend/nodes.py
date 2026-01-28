from typing import Dict
from langgraph.types import interrupt
from backend.models import InterviewState
from backend.agents import (
    ask_question_agent,
    evaluate_with_feedback_agent,
    decision_agent,
    end_interview_agent,
    transition_agent
)
import logging

logger = logging.getLogger(__name__)


def _extract_attr(obj, attr_name):
    """Safely extract attribute from Pydantic model or dict."""
    if isinstance(obj, dict):
        return obj.get(attr_name)
    return getattr(obj, attr_name, None)


def ask_question_node(state: InterviewState) -> Dict:
    """
    Generate the next interview question.

    Use the candidate's role, experience, difficulty level,
    weak topics, and previously asked questions to produce
    a professional interview question.

    Update the current question and track it as asked.
    """
    logger.debug(f"Generating question (difficulty={state['difficulty']}, count={state['question_count']})")
    q = ask_question_agent(state)
    question_text = _extract_attr(q, "question")
    if not question_text:
        logger.error(f"Question generation failed: got {type(q).__name__} = {q}")
        raise ValueError(f"Question generation failed: missing 'question' field")
    logger.info(f"Generated question: {question_text[:100]}...")
    return {
        "current_question": question_text,
        "asked_questions": state["asked_questions"] + [question_text],
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
    Evaluate the candidate's answer AND generate feedback.
    
    Uses merged LLM call to get evaluation + feedback in one pass.
    Analyze the answer for quality and understanding.
    Assign a numeric score and identify the primary topic,
    strengths, and weaknesses.
    """
    logger.debug(f"Evaluating answer (length={len(state['last_answer_text'] or '')} chars)")
    ev = evaluate_with_feedback_agent(state)
    
    # Support dict return shape as well as Pydantic object
    score = _extract_attr(ev, "score")
    topic = _extract_attr(ev, "topic")
    strengths = _extract_attr(ev, "strengths") or []
    weaknesses = _extract_attr(ev, "weaknesses") or []
    feedback_text = _extract_attr(ev, "feedback")

    if score is None or topic is None:
        logger.error(f"Evaluation failed: got {type(ev).__name__} = {ev}")
        raise ValueError(f"Evaluation failed: missing score or topic")

    logger.info(f"Evaluation: score={score}, topic={topic}")

    from backend.models import Evaluation
    evaluation = Evaluation(
        score=score,
        topic=topic,
        strengths=strengths,
        weaknesses=weaknesses
    )

    return {
        "evaluation": evaluation,
        "feedback": feedback_text,  # Set feedback here instead of in feedback_node
        "score_history": state["score_history"] + [score],
        "evaluations_history": state["evaluations_history"] + [evaluation],
    }


def await_continue_node(state: InterviewState) -> Dict:
    """
    In coach persona, pause after feedback and wait for user to proceed.
    This allows the UI to present the voice feedback summary screen with a
    "Proceed to next question" option.
    """
    resume_val = interrupt({"continue": True})
    return {"proceed": resume_val}


def decision_node(state: InterviewState) -> Dict:
    """
    Decide the next interview step.

    Adjust difficulty based on performance.
    Track weak topics when answers are poor.
    Increment question count and determine
    whether the interview should end.
    """
    if not state["evaluation"]:
        logger.error("decision_node called without evaluation")
        raise ValueError("Evaluation is required for decision")
        
    d = decision_agent(state, state["evaluation"])

    weak_topics = set(state["weak_topics"])
    if d["add_weak_topic"] and state["evaluation"]:
        weak_topics.add(state["evaluation"].topic)
        logger.info(f"Added weak topic: {state['evaluation'].topic}")

    logger.debug(f"Decision: difficulty={d['difficulty']}, end={d['end_interview']}")

    return {
        "difficulty": d["difficulty"],
        "end_interview": d["end_interview"],
        "question_count": state["question_count"] + 1,
        "weak_topics": weak_topics,
    }

def transition_node(state: InterviewState) -> Dict:
    t = transition_agent(state)
    transition_text = _extract_attr(t, "transition")
    return {"spoken_transition": transition_text}

def end_node(state: InterviewState) -> Dict:
    """
    Produce the final interview summary.

    Aggregate scores, identify weak topics,
    and generate an overall performance verdict.
    """
    logger.info("Generating final interview summary")
    result = end_interview_agent(state)
    logger.info(f"Interview completed: verdict={result['summary']['verdict']}")
    return result
