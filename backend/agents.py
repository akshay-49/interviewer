from typing import Optional
from langchain_core.messages import SystemMessage, HumanMessage
from backend.models import InterviewState, Evaluation
from backend.llm import question_llm, evaluation_with_feedback_llm, hint_llm, closing_llm, transition_llm
from backend.config import (
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

logger = logging.getLogger(__name__)


def ask_question_agent(state: InterviewState):
    """
    Generate the next interview question.

    Use role, experience, difficulty, weak topics,
    and previously asked questions to produce
    exactly one professional interview question.
    """
    weak_topics = ", ".join(state["weak_topics"]) if state["weak_topics"] else "None"
    prev_qs = "\n".join(f"- {q}" for q in state["asked_questions"]) or "None"
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
                "Question Types (Vary question types across the interview):\n"
                "1. BEHAVIORAL: Ask about past experiences, decisions, conflicts, or lessons learned (e.g., 'Tell me about a time when...')\n"
                "2. TECHNICAL CONCEPT: Ask about fundamental concepts, principles, or theory (e.g., 'What is...', 'Explain...')\n"
                "3. PROBLEM-SOLVING: Ask how to approach a challenge, design system, or solve a problem (e.g., 'How would you...')\n"
                "4. SCENARIO-BASED: Present a real-world situation and ask how they'd handle it (e.g., 'If you were...')\n"
                "5. DEEP-DIVE: Dig deeper into previously mentioned topics (e.g., 'Why did you choose...', 'What were the trade-offs...')\n"
                "6. BEST PRACTICES: Ask about standards, conventions, or methodologies (e.g., 'What are best practices for...')\n"
                "7. EXPERIENCE-FOCUSED: Ask about their hands-on experience and projects (e.g., 'What's the most complex...', 'Describe a project where...')\n\n"
                "Rules:\n"
                "- Ask only ONE thing.\n"
                "- Use at most ONE interrogative word (what OR why OR how OR tell OR explain OR describe).\n"
                "- Do NOT combine multiple sub-questions.\n"
                "- Do NOT use conjunctions like 'and', 'also', 'as well as', 'furthermore'.\n"
                "- Do NOT ask for definitions and examples in the same question.\n"
                "- Do NOT ask follow-up parts in the same turn.\n"
                "- Make questions conversational and engaging, not robotic.\n"
                "- Avoid overly technical jargon unless appropriate for the role.\n"
                "- Vary sentence structure and question styles.\n\n"
                "Adaptation:\n"
                "- Use 'Role Description' to tailor domain, stack, and context.\n"
                "- If difficulty is 'easy': Focus on fundamentals and foundational concepts.\n"
                "- If difficulty is 'hard': Push on edge cases, optimization, system design, trade-offs, and advanced concepts.\n"
                "- Avoid topics in 'Weak Topics' or address them from a different angle to help improvement.\n"
                "- Build on previously asked questions without repetition - ask about different topics.\n"
                "- Vary question types throughout the interview - don't ask similar types consecutively.\n"
                "- Mix behavioral, technical, and scenario-based questions.\n\n"
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

Previously asked questions (AVOID REPEATING THESE TOPICS):
{prev_qs}

Important: Generate a DIFFERENT question that covers a new topic or angle from the ones already asked. 
Vary the question type for better interview quality.
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