from typing import Dict, Optional
from datetime import datetime
from langgraph.types import interrupt
from backend.interview.models import InterviewState
from backend.interview.agents import (
    ask_question_agent,
    evaluate_with_feedback_agent,
    decision_agent,
    end_interview_agent,
    transition_agent
)
from backend.core.cosmos import questions_container, Question
import logging
import hashlib

logger = logging.getLogger(__name__)


def _extract_attr(obj, attr_name):
    """Safely extract attribute from Pydantic model or dict."""
    if isinstance(obj, dict):
        return obj.get(attr_name)
    return getattr(obj, attr_name, None)


def _normalize_question_text(text: str) -> str:
    """Normalize question text for deduplication (lowercase, strip whitespace)."""
    return text.lower().strip()


def _get_question_hash(text: str) -> str:
    """Generate a hash of the normalized question text."""
    normalized = _normalize_question_text(text)
    return hashlib.md5(normalized.encode()).hexdigest()


def _calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculate similarity between two texts using Jaccard similarity on word sets."""
    words1 = set(_normalize_question_text(text1).split())
    words2 = set(_normalize_question_text(text2).split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    return intersection / union if union > 0 else 0.0


def _is_similar_question_exists(question_text: str, category: str, similarity_threshold: float = 0.65) -> bool:
    """Check if a similar question already exists (not just exact duplicates)."""
    try:
        query = f"SELECT c.text FROM questions c WHERE c.category = @category"
        items = list(questions_container.query_items(
            query=query,
            parameters=[{"name": "@category", "value": category}],
            enable_cross_partition_query=True
        ))
        
        for item in items:
            existing_text = item.get("text", "")
            similarity = _calculate_text_similarity(question_text, existing_text)
            if similarity >= similarity_threshold:
                logger.info(f"Similar question found (similarity: {similarity:.2f}): {existing_text[:60]}...")
                return True
        return False
    except Exception as e:
        logger.warning(f"Error checking for similar questions: {e}")
        return False


def _classify_question_category(question_text: str) -> str:
    """
    Classify the question into categories based on keywords in the question text.
    Categories: Behavioral, Technical, Architecture, Management
    """
    question_lower = question_text.lower()
    
    # Behavioral keywords
    behavioral_keywords = [
        "tell me about a time", "describe a situation", "have you ever", "how would you handle",
        "conflict", "disagree", "mistake", "failure", "challenge", "learned", "experience",
        "example", "past", "you've worked", "team", "collaborated", "decision"
    ]
    
    # Architecture keywords
    architecture_keywords = [
        "design", "architect", "scale", "system", "distributed", "microservice",
        "infrastructure", "database design", "api design", "tradeoff", "trade-off",
        "load balancing", "caching", "replication", "data flow", "component"
    ]
    
    # Management keywords
    management_keywords = [
        "lead", "manage", "mentor", "hire", "team", "process", "methodology",
        "agile", "deadline", "priority", "stakeholder", "communication", "culture",
        "feedback", "performance"
    ]
    
    # Check for architecture (higher priority)
    for keyword in architecture_keywords:
        if keyword in question_lower:
            return "Architecture"
    
    # Check for management
    for keyword in management_keywords:
        if keyword in question_lower:
            # Exclude team-related behavioral questions
            if not any(bk in question_lower for bk in ["tell me about", "describe", "have you ever"]):
                return "Management"
    
    # Check for behavioral
    for keyword in behavioral_keywords:
        if keyword in question_lower:
            return "Behavioral"
    
    # Default to Technical
    return "Technical"


def _is_duplicate_question(question_text: str, category: str) -> bool:
    """Check if an exact or very similar question already exists in the database."""
    try:
        # First check for exact duplicates using hash
        question_hash = _get_question_hash(question_text)
        query = f"SELECT * FROM questions c WHERE c.category = @category AND c.hash = @hash"
        items = list(questions_container.query_items(
            query=query,
            parameters=[
                {"name": "@category", "value": category},
                {"name": "@hash", "value": question_hash}
            ],
            enable_cross_partition_query=True
        ))
        if len(items) > 0:
            return True
        
        # Then check for similar questions
        return _is_similar_question_exists(question_text, category, similarity_threshold=0.65)
    except Exception as e:
        logger.warning(f"Error checking for duplicate question: {e}")
        return False


def _save_question_to_db(question_text: str, category: str, role: str, experience: str, topic: Optional[str] = None) -> str:
    """
    Save a generated question to Cosmos DB (with deduplication).
    Returns the unique question ID.
    """
    try:
        if _is_duplicate_question(question_text, category):
            logger.info(f"Question already exists in database, skipping save: {question_text[:80]}...")
            # Find and return existing question ID
            question_hash = _get_question_hash(question_text)
            query = f"SELECT c.id FROM questions c WHERE c.category = @category AND c.hash = @hash"
            items = list(questions_container.query_items(
                query=query,
                parameters=[
                    {"name": "@category", "value": category},
                    {"name": "@hash", "value": question_hash}
                ],
                enable_cross_partition_query=True
            ))
            if items:
                return items[0]['id']
        
        question_hash = _get_question_hash(question_text)
        question_id = f"{question_hash}_{int(datetime.utcnow().timestamp() * 1000)}"
        question_doc = {
            "id": question_id,
            "text": question_text,
            "category": category,
            "role": role,
            "experience": experience,
            "topic": topic,
            "hash": question_hash,
            "created_at": datetime.utcnow().isoformat(),
            "uses_count": 0,
            "rating": None
        }
        
        questions_container.create_item(body=question_doc)
        logger.info(f"✅ Question saved to database with ID: {question_id}")
        return question_id
    except Exception as e:
        logger.error(f"Error saving question to database: {e}")
        return None


def _log_question_asked(user_id: str, question_id: str, question_text: str, session_id: Optional[str] = None):
    """Log that a question was asked to a user."""
    try:
        from backend.core.cosmos import question_logs_container
        from uuid import uuid4
        
        log_doc = {
            "id": str(uuid4()),
            "user_id": user_id,
            "question_id": question_id,
            "question_text": question_text,
            "session_id": session_id,
            "asked_at": datetime.utcnow().isoformat(),
            "answered": False,
            "answer_score": None
        }
        
        question_logs_container.create_item(body=log_doc)
        logger.info(f"✅ Question logged for user {user_id}: {question_id}")
    except Exception as e:
        logger.error(f"Error logging question: {e}")


def _get_user_asked_questions(user_id: str) -> set:
    """Get all question IDs that have been asked to a user."""
    try:
        from backend.core.cosmos import question_logs_container
        
        query = "SELECT DISTINCT c.question_id FROM question_logs c WHERE c.user_id = @user_id"
        items = list(question_logs_container.query_items(
            query=query,
            parameters=[{"name": "@user_id", "value": user_id}],
            enable_cross_partition_query=False  # Same partition key
        ))
        
        question_ids = {item['question_id'] for item in items}
        logger.info(f"User {user_id} has been asked {len(question_ids)} unique questions")
        return question_ids
    except Exception as e:
        logger.warning(f"Error fetching user's asked questions: {e}")
        return set()


def _get_unasked_question_from_bank(user_id: str, role: Optional[str] = None, experience: Optional[str] = None) -> Optional[dict]:
    """
    Return a question from the bank that the user has not been asked yet.
    Prioritizes role/difficulty matches when provided.
    """
    try:
        from backend.core.cosmos import questions_container

        asked_ids = _get_user_asked_questions(user_id) if user_id else set()
        query = "SELECT * FROM questions c WHERE 1=1"
        parameters = []

        if role and role != "All Roles":
            query += " AND c.role = @role"
            parameters.append({"name": "@role", "value": role})

        if experience and experience != "All Experience":
            query += " AND c.experience = @experience"
            parameters.append({"name": "@experience", "value": experience})

        items = list(questions_container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))

        for item in items:
            if item.get("id") and item.get("id") not in asked_ids:
                return item

        return None
    except Exception as e:
        logger.warning(f"Error fetching unasked question from bank: {e}")
        return None


def ask_question_node(state: InterviewState) -> Dict:
    """
    Generate the next interview question.

    Use the candidate's role, experience, difficulty level,
    weak topics, and previously asked questions to produce
    a professional interview question.

    Update the current question and track it as asked.
    Save unique questions to Cosmos DB and log for user.
    
    PREVENTS RE-ASKING: Uses unasked bank questions first, then retries LLM generation.
    PREVENTS DUPLICATES: Checks for exact and similar questions before saving.
    """
    logger.debug(f"Generating question (difficulty={state['difficulty']}, count={state['question_count']})")
    
    # Get user's previously asked question IDs to prevent re-asking
    user_id = state.get("user_id")
    session_id = state.get("session_id")
    previously_asked_ids = set()
    if user_id:
        previously_asked_ids = _get_user_asked_questions(user_id)
        logger.info(f"User {user_id} has been asked {len(previously_asked_ids)} unique questions across all sessions")

    # 1) Prefer unasked question bank items first
    if user_id:
        bank_question = _get_unasked_question_from_bank(
            user_id=user_id,
            role=state.get("role"),
            experience=state.get("experience")
        )
        if bank_question:
            question_id = bank_question.get("id")
            question_text = bank_question.get("text")
            logger.info(f"✅ Using unasked question from bank: {question_id}")

            # Log that this question was asked to this user
            if question_id and user_id:
                _log_question_asked(user_id, question_id, question_text, session_id)

            # Store question ID in state for tracking
            question_ids_asked = state.get("question_ids_asked", [])
            if question_id:
                question_ids_asked = question_ids_asked + [question_id]

            return {
                "current_question": question_text,
                "current_question_id": question_id,
                "asked_questions": state["asked_questions"] + [question_text],
                "question_ids_asked": question_ids_asked,
                "feedback": None,
                "spoken_transition": None,
            }
    
    # 2) If no unasked bank question, try LLM generation
    # Try up to 5 times to generate a new unique question
    max_retries = 5
    question_id = None
    question_text = None
    
    for attempt in range(max_retries):
        q = ask_question_agent(state)
        question_text = _extract_attr(q, "question")
        
        if not question_text:
            logger.error(f"Question generation failed: got {type(q).__name__} = {q}")
            raise ValueError(f"Question generation failed: missing 'question' field")
        
        logger.info(f"Generated question (attempt {attempt + 1}/{max_retries}): {question_text[:100]}...")
        
        # Check for duplicates BEFORE saving
        category = _classify_question_category(question_text)
        if _is_duplicate_question(question_text, category):
            logger.warning(f"Question is duplicate or too similar. Retrying... (attempt {attempt + 1}/{max_retries})")
            question_text = None
            continue
        
        # Save question to database (no duplicates at this point)
        experience = state.get("experience", "Mid-Level")
        question_id = _save_question_to_db(
            question_text=question_text,
            category=category,
            role=state.get("role", "All Roles"),
            experience=experience,
            topic=state.get("topic")
        )
        
        # Check if this question was already asked to this user in CURRENT SESSION
        current_session_questions = state.get("asked_questions", [])
        if question_text in current_session_questions:
            logger.warning(f"Question was already asked in current session. Retrying... (attempt {attempt + 1}/{max_retries})")
            question_text = None
            question_id = None
            continue
        else:
            # Question is new - use it
            logger.info(f"✅ Question is new (ID: {question_id})")
            break
    
    # If we couldn't generate a new question after retries, use the last one anyway
    if not question_text:
        logger.warning(f"Could not generate a new question after {max_retries} attempts. Using latest generation.")
        q = ask_question_agent(state)
        question_text = _extract_attr(q, "question")
        if not question_text:
            raise ValueError(f"Question generation failed: missing 'question' field")
        
        category = _classify_question_category(question_text)
        experience = state.get("experience", "Mid-Level")
        question_id = _save_question_to_db(
            question_text=question_text,
            category=category,
            role=state.get("role", "All Roles"),
            experience=experience,
            topic=state.get("topic")
        )
    
    # Log that this question was asked to this user
    if question_id and user_id:
        _log_question_asked(user_id, question_id, question_text, session_id)
    
    # Store question ID in state for tracking
    question_ids_asked = state.get("question_ids_asked", [])
    if question_id:
        question_ids_asked = question_ids_asked + [question_id]
    
    return {
        "current_question": question_text,
        "current_question_id": question_id,  # Track the question ID
        "asked_questions": state["asked_questions"] + [question_text],
        "question_ids_asked": question_ids_asked,  # Track all question IDs asked
        # Clear feedback and transition from previous cycle for fresh evaluation
        "feedback": None,
        "spoken_transition": None,
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

    from backend.interview.models import Evaluation
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
    logger.info(f"Decision node START: question_count={state['question_count']}")
    
    if not state["evaluation"]:
        logger.error("decision_node called without evaluation")
        raise ValueError("Evaluation is required for decision")
        
    d = decision_agent(state, state["evaluation"])

    weak_topics = set(state["weak_topics"])
    if d["add_weak_topic"] and state["evaluation"]:
        weak_topics.add(state["evaluation"].topic)
        logger.info(f"Added weak topic: {state['evaluation'].topic}")

    logger.debug(f"Decision: difficulty={d['difficulty']}, end={d['end_interview']}")
    
    new_count = state["question_count"] + 1
    logger.info(f"Decision node END: incrementing question_count from {state['question_count']} to {new_count}, end_interview={d['end_interview']}")

    return {
        "difficulty": d["difficulty"],
        "end_interview": d["end_interview"],
        "question_count": new_count,
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
