from typing import Optional, List
from langchain_core.messages import SystemMessage, HumanMessage
from backend.interview.models import InterviewState, Evaluation
from backend.core.llm import question_llm, evaluation_with_feedback_llm, hint_llm, closing_llm, transition_llm
from backend.core.config import (
    MAX_QUESTIONS,
    WEAK_ANSWER_THRESHOLD,
    STRONG_ANSWER_THRESHOLD,
    SCORE_EXCELLENT,
    SCORE_GOOD,
    SCORE_SATISFACTORY,
    SCORE_NEEDS_IMPROVEMENT,
    DIFFICULTY_EASY,
    DIFFICULTY_HARD
)
import logging
import re

logger = logging.getLogger(__name__)


def _extract_question_topics(questions: List[str]) -> str:
    """
    Extract key topics/keywords from a list of questions.
    Focuses on nouns and important technical terms.
    """
    if not questions:
        return "None"
    
    # Common stop words to ignore
    stop_words = {
        'a', 'an', 'the', 'you', 'your', 'would', 'how', 'what', 'why', 'when', 'where',
        'is', 'are', 'do', 'does', 'can', 'could', 'should', 'have', 'has', 'be',
        'about', 'in', 'on', 'at', 'to', 'for', 'from', 'of', 'and', 'or', 'but',
        'tell', 'explain', 'describe', 'discuss', 'difference', 'between', 'vs',
        'project', 'experience', 'work', 'worked', 'working', 'i', 'me', 'we'
    }
    
    topics = set()
    for question in questions:
        # Extract words, convert to lowercase
        words = re.findall(r'\b[a-z]+\b', question.lower())
        # Filter out stop words and add substantial words
        for word in words:
            if len(word) > 3 and word not in stop_words:
                topics.add(word)
    
    if not topics:
        return "None"
    
    # Return top keywords (limit to 15)
    sorted_topics = sorted(list(topics))[:15]
    return ", ".join(sorted_topics)


def ask_question_agent(state: InterviewState):
    """
    Generate the next interview question.

    Use role, experience, difficulty, weak topics,
    and previously asked questions to produce
    exactly one professional interview question.
    
    ENFORCES TOPIC VARIETY by extracting keywords from previous questions
    and telling the LLM to explicitly avoid those topics.
    """
    weak_topics = ", ".join(state["weak_topics"]) if state["weak_topics"] else "None"
    prev_qs = "\n".join(f"- {q}" for q in state["asked_questions"]) or "None"
    asked_topics = _extract_question_topics(state["asked_questions"])
    role_desc = state.get("role_description") or ""
    question_count = state.get("question_count", 0)

    return question_llm.invoke([
        SystemMessage(
            content=(
                "Generate exactly ONE professional interview question.\n\n"
                "Context:\n"
                "You are an experienced technical interviewer.\n"
                "Ask questions relevant to the role, experience level, and the provided role description.\n"
                "Sound natural, not scripted. Focus on real-world competency.\n\n"
                "Question Types (PRIORITIZE TECHNICAL - Balance is ~40% Technical, ~30% Problem-Solving, ~20% Behavioral, ~10% Scenario):\n"
                "1. TECHNICAL CONCEPT: Ask about fundamental concepts, principles, or theory (MOST IMPORTANT)\n"
                "   Examples: 'What is X?', 'Explain how X works', 'What are the differences between X and Y?', 'Define X in simple terms'\n"
                "2. PROBLEM-SOLVING: Ask how to approach a challenge, design system, or solve a problem\n"
                "   Examples: 'How would you design...?', 'How would you optimize...?', 'What approach would you take...?'\n"
                "3. BEHAVIORAL: Ask about general past experiences, lessons learned (Keep it BROAD and accessible)\n"
                "   Examples: 'Tell me about a project you worked on', 'How do you typically approach problem-solving?', 'Describe your experience with X'\n"
                "4. SCENARIO-BASED: Present a realistic situation and ask how they'd handle it\n"
                "   Examples: 'If you had to...', 'Imagine you were working on...', 'In a situation where...'\n"
                "5. BEST PRACTICES: Ask about standards, conventions, or methodologies\n"
                "   Examples: 'What are best practices for...?', 'How do teams typically handle...?'\n\n"
                "Rules:\n"
                "- Ask only ONE thing.\n"
                "- Use at most ONE interrogative word (what OR why OR how OR tell OR explain OR describe).\n"
                "- Do NOT combine multiple sub-questions.\n"
                "- Do NOT use conjunctions like 'and', 'also', 'as well as', 'furthermore'.\n"
                "- Do NOT ask for definitions and examples in the same question.\n"
                "- Make questions conversational and engaging, not robotic.\n"
                "- Avoid overly technical jargon unless appropriate for the role.\n"
                "- Vary sentence structure and question styles.\n\n"
                "Adaptation:\n"
                "- Use 'Role Description' to tailor domain, stack, and context.\n"
                "- If difficulty is 'easy': Focus on fundamentals and foundational concepts (ask TECHNICAL questions).\n"
                "- If difficulty is 'hard': Push on edge cases, optimization, system design, trade-offs, and advanced concepts.\n"
                "- AVOID asking too many BEHAVIORAL/SOFT questions - focus on TECHNICAL skills assessment.\n"
                "- Build on previously asked questions WITHOUT REPETITION - ask about different topics/concepts.\n"
                "- Vary question types throughout the interview - don't ask similar types consecutively.\n\n"
                'Return JSON only using the schema: {"question": "string"}'
            )
        ),
        HumanMessage(
            content=f"""
Role: {state["role"]}
Experience: {state["experience"]}
Difficulty: {state["difficulty"]}
Question Number: {question_count + 1} of 5
Weak Topics: {weak_topics}

Role Description:
{role_desc}

Previously asked questions:
{prev_qs}

Topics already covered (DO NOT ASK ABOUT THESE):
{asked_topics}

CRITICAL INSTRUCTIONS:
1. AVOID these specific keywords/topics: {asked_topics}
2. Focus on COMPLETELY DIFFERENT concepts than what's already been asked
3. Question #{question_count + 1}: Prioritize asking a TECHNICAL QUESTION (concepts, theory, fundamentals)
4. Do NOT ask about the same topic with different wording
5. Do NOT ask overly soft/behavioral questions - assess TECHNICAL competency
6. Ensure deep topic diversity across all 5 questions
"""
        )
    ])


def evaluate_with_feedback_agent(state: InterviewState):
    """
    Evaluate the candidate's answer AND generate feedback in a single LLM call.
    
    Assess correctness, clarity, depth, and provide professional feedback.
    This reduces two separate LLM calls into one optimized call.
    """
    return evaluation_with_feedback_llm.invoke([
        SystemMessage(
            content=(
                "Evaluate the candidate's answer and provide professional feedback in one response.\n\n"
                
                "PART 1: EVALUATION\n"
                "Assessment Dimensions:\n"
                "1. CORRECTNESS: Is the core concept/answer right?\n"
                "2. CLARITY: Is it well-explained and easy to follow?\n"
                "3. DEPTH: Does it show genuine understanding or go beyond basics?\n\n"

                "Scoring Bands (0–10):\n"
                "0–2: Incorrect or irrelevant. Fundamental misunderstandings.\n"
                "3–4: Very weak. Vague, shallow, or mostly incorrect.\n"
                "5–6: Basic. Core idea correct but shallow or incomplete.\n"
                "7–8: Strong. Correct, clear, structured, with relevant examples.\n"
                "9–10: Excellent. Fully correct, well-structured, examples, nuances, and insightful.\n\n"

                "Scoring Rules:\n"
                "- Do NOT average scores. Choose the closest single band.\n"
                "- Do NOT give 7+ without at least one concrete example or applied reasoning.\n"
                "- Do NOT give 9–10 unless explanation is complete, nuanced, and demonstrates deep understanding.\n"
                "- Consider if answer is practical and applicable to real-world scenarios.\n\n"

                "Instructions:\n"
                "1. Identify the primary topic of the question.\n"
                "2. List 2-3 concrete strengths (what was done well).\n"
                "3. List 2-3 concrete weaknesses (what needs improvement).\n\n"
                
                "PART 2: FEEDBACK\n"
                "Generate professional, constructive interview feedback.\n\n"
                "Your Role:\n"
                "You are a seasoned technical interviewer providing honest, direct feedback.\n"
                "Be encouraging but truthful - do not sugarcoat weak performance.\n"
                "Be specific and actionable.\n\n"
                "Guidelines:\n"
                "1. Start with what went WELL (strengths).\n"
                "2. Address areas for IMPROVEMENT (weaknesses) constructively.\n"
                "3. Do NOT provide full model answers or solutions.\n"
                "4. Do NOT repeat the numeric score.\n"
                "5. Suggest direction for improvement (e.g., 'Consider exploring X concept').\n"
                "6. Keep tone professional, supportive, and respectful.\n"
                "7. If score is low, acknowledge it directly but encourage learning.\n\n"
                "Tone:\n"
                "- Be honest: If answer was weak, say so.\n"
                "- Be helpful: Give direction without spoiling the learning.\n"
                "- Be professional: Sound like a real interviewer, not a machine.\n\n"
                
                'Return JSON only using the schema: '
                '{"score": number, "topic": string, '
                '"strengths": [string], "weaknesses": [string], "feedback": string}'
            )
        ),
        HumanMessage(
            content=f"""
Question:
{state["current_question"]}

Candidate Answer:
{state["last_answer_text"]}
"""
        )
    ])


def transition_agent(state: InterviewState):
    """
    Generate a short spoken transition between interview questions.
    """
    evaluation = state.get("evaluation")
    score = evaluation.score if evaluation is not None else None

    return transition_llm.invoke([
        SystemMessage(
            content=(
                "Generate a very short spoken transition between interview questions.\n"
                "One sentence only.\n"
                "Do not give feedback or advice.\n"
                "Do not ask a question.\n"
                "Sound professional and natural.\n"
                'Return JSON only: {"transition": "string"}'
            )
        ),
        HumanMessage(
            content=f"""
Last answer score: {score}
"""
        )
    ])


def hint_agent(question: str, role: Optional[str] = None, experience: Optional[str] = None):
    """
    Provide a concise, non-spoiler hint for the current question.
    Keep it short (1-2 sentences) and focus on guiding the candidate
    toward the key idea without giving the full answer.
    """
    role_text = role or "Not specified"
    exp_text = experience or "Not specified"

    return hint_llm.invoke([
        SystemMessage(
            content=(
                "You are a supportive technical interviewer providing strategic hints.\n"
                "Give a concise hint (1-2 sentences) that nudges the candidate toward the right idea.\n\n"
                "Hint Strategy:\n"
                "- Identify the KEY CONCEPT or AREA the question is probing.\n"
                "- Ask a guiding question or suggest a relevant angle to explore.\n"
                "- Do NOT reveal the full answer or solution.\n"
                "- Do NOT provide code or step-by-step instructions.\n"
                "- Do NOT spoil the learning opportunity.\n"
                "- Instead, suggest: 'Think about...', 'Consider how...', 'What if you approach it from...'\n\n"
                "Examples:\n"
                "- Bad hint: 'Use a hash map to solve this in O(n) time.'\n"
                "- Good hint: 'Think about what data structure lets you look up information quickly.'\n\n"
                'Return JSON only: {"hint": "string"}'
            )
        ),
        HumanMessage(
            content=f"""
Role: {role_text}
Experience: {exp_text}

Question:
{question}
"""
        )
    ])

def decision_agent(state: InterviewState, evaluation: Evaluation):
    """
    Decide how the interview should proceed based on performance.

    Adapt difficulty, track weak topics, and determine continuation.
    Strategy:
    - Weak answer (< WEAK_ANSWER_THRESHOLD): Simplify or revisit similar concepts
    - Good answer (> STRONG_ANSWER_THRESHOLD): Increase difficulty or move to related topics
    - Repeated weak: Eventually end interview after sufficient questions
    """
    difficulty = state["difficulty"]
    add_weak = False

    # Adaptive difficulty based on performance
    if evaluation.score < WEAK_ANSWER_THRESHOLD:
        # Weak answer - go easier, track topic as weak
        difficulty = DIFFICULTY_EASY
        add_weak = True
        logger.info(f"Low score ({evaluation.score}), marking '{evaluation.topic}' as weak topic and going easier")
    elif evaluation.score >= STRONG_ANSWER_THRESHOLD:
        # Strong answer - increase challenge
        difficulty = DIFFICULTY_HARD
        logger.info(f"Strong score ({evaluation.score}), increasing difficulty")
    else:
        # Adequate answer - maintain current difficulty
        logger.info(f"Adequate score ({evaluation.score}), maintaining difficulty")

    # End after MAX_QUESTIONS (check >= MAX_QUESTIONS-1 because count increments after this check)
    end_interview = state["question_count"] >= MAX_QUESTIONS - 1
    
    logger.info(f"Decision: question_count={state['question_count']}, MAX_QUESTIONS={MAX_QUESTIONS}, end_interview={end_interview}")

    return {
        "difficulty": difficulty,
        "add_weak_topic": add_weak,
        "end_interview": end_interview,
    }


def end_interview_agent(state: InterviewState):
    """
    Generate interview closing with structured feedback for the results page.

    Uses all evaluations from the interview to provide relevant, personalized feedback.
    Returns a summary dict with sections:
    - average_score, weak_topics, verdict
    - what_went_well: list[str] - aggregated from all answers
    - areas_for_improvement: list[str] - aggregated from all answers
    """

    # Compute average score and verdict
    avg = (
        sum(state["score_history"]) / max(len(state["score_history"]), 1)
        if state.get("score_history") is not None
        else 0.0
    )

    if avg >= SCORE_EXCELLENT:
        verdict = "Excellent performance"
    elif avg >= SCORE_GOOD:
        verdict = "Good performance"
    elif avg >= SCORE_SATISFACTORY:
        verdict = "Satisfactory performance"
    elif avg >= SCORE_NEEDS_IMPROVEMENT:
        verdict = "Needs improvement"
    else:
        verdict = "Significant gaps identified"

    # Aggregate strengths and weaknesses from ALL evaluations
    all_strengths = []
    all_weaknesses = []
    
    evaluations_history = state.get("evaluations_history") or []
    if evaluations_history:
        # Collect unique strengths from all evaluations
        for evaluation in evaluations_history:
            if evaluation.strengths:
                for strength in evaluation.strengths:
                    # Only add non-empty, non-N/A strengths
                    if strength and strength.strip() and "N/A" not in strength and "no answer" not in strength.lower():
                        all_strengths.append(strength.strip())
            if evaluation.weaknesses:
                for weakness in evaluation.weaknesses:
                    # Only add non-empty, non-N/A weaknesses
                    if weakness and weakness.strip() and "N/A" not in weakness and "no answer" not in weakness.lower():
                        all_weaknesses.append(weakness.strip())
        
        # Remove duplicates while preserving order (case-insensitive)
        seen_strengths = set()
        unique_strengths = []
        for s in all_strengths:
            s_lower = s.lower()
            if s_lower not in seen_strengths:
                seen_strengths.add(s_lower)
                unique_strengths.append(s)
        all_strengths = unique_strengths[:3]
        
        seen_weaknesses = set()
        unique_weaknesses = []
        for w in all_weaknesses:
            w_lower = w.lower()
            if w_lower not in seen_weaknesses:
                seen_weaknesses.add(w_lower)
                unique_weaknesses.append(w)
        all_weaknesses = unique_weaknesses[:3]

    # If we have meaningful feedback, use it; otherwise generate contextual defaults
    if not all_strengths:
        if avg >= SCORE_GOOD:
            all_strengths = [
                "Demonstrated understanding of core concepts",
                "Provided structured and coherent responses",
                "Engaged thoughtfully with technical topics"
            ]
        else:
            all_strengths = [
                "Willingness to attempt challenging questions",
                "Responsive to interviewer guidance",
                "Effort to articulate thinking process"
            ]
    
    if not all_weaknesses:
        if avg < SCORE_SATISFACTORY:
            all_weaknesses = [
                "Depth of technical understanding needs development",
                "Specific examples and real-world applications could be stronger",
                "Consider building foundational knowledge in core areas"
            ]
        else:
            all_weaknesses = [
                "Could provide more concrete examples",
                "Explore edge cases and corner scenarios",
                "Strengthen knowledge in advanced concepts"
            ]

    summary = {
        "average_score": round(avg, 2),
        "weak_topics": list(state.get("weak_topics") or []),
        "verdict": verdict,
        "what_went_well": all_strengths[:3],
        "areas_for_improvement": all_weaknesses[:3]
    }

    # Keep spoken closing generation for audio
    closing = closing_llm.invoke([
        SystemMessage(
            content=(
                "Generate a concise professional closing (1–2 sentences) that reflects the verdict "
                "and offers encouragement to improve. Return JSON: {\"spoken_closing\": \"string\"}."
            )
        ),
        HumanMessage(
            content=(
                f"Average Score: {summary['average_score']}/10\n"
                f"Verdict: {summary['verdict']}\n"
                f"Weak Topics: {', '.join(summary['weak_topics']) if summary['weak_topics'] else 'None'}"
            )
        )
    ])

    spoken = getattr(closing, "spoken_closing", None) or "Session ended. Thank you for the interview!"

    return {
        "summary": summary,
        "spoken_closing": spoken,
    }