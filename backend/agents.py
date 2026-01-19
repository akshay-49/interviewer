from langchain_core.messages import SystemMessage, HumanMessage
from backend.models import InterviewState, Evaluation
from backend.llm import question_llm, evaluation_llm, feedback_llm, closing_llm, transition_llm


def ask_question_agent(state: InterviewState):
    """
    Generate the next interview question.

    Use role, experience, difficulty, weak topics,
    and previously asked questions to produce
    exactly one professional interview question.
    """
    weak_topics = ", ".join(state["weak_topics"]) if state["weak_topics"] else "None"
    prev_qs = "\n".join(f"- {q}" for q in state["asked_questions"]) or "None"

    return question_llm.invoke([
        SystemMessage(
            content=(
         "Generate exactly ONE professional interview question.\n\n"

        "Context:\n"
        "You are an experienced technical interviewer.\n"
        "Ask questions that are relevant to the role and experience level.\n"
        "Sound natural, not scripted.\n"
        "Questions should assess real-world competency.\n\n"

        "Rules:\n"
        "- Ask only ONE thing.\n"
        "- Use at most ONE interrogative word (what OR why OR how OR explain).\n"
        "- Do NOT combine multiple sub-questions.\n"
        "- Do NOT use conjunctions like 'and', 'also', 'as well as'.\n"
        "- Do NOT ask for definitions and examples in the same question.\n"
        "- Do NOT ask follow-up parts in the same turn.\n"
        "- Make questions conversational and engaging.\n"
        "- Avoid overly technical jargon unless appropriate for the role.\n\n"

        "Adaptation:\n"
        "- If difficulty is 'easy': Use beginner-friendly language. Focus on fundamentals.\n"
        "- If difficulty is 'hard': Increase complexity. Ask about edge cases, optimization, or system design.\n"
        "- Avoid topics in 'Weak Topics' or address them differently.\n"
        "- Build on previously asked questions without repetition.\n\n"

        'Return JSON only using the schema: {"question": "string"}'
            )
        ),
        HumanMessage(
            content=f"""
Role: {state["role"]}
Experience: {state["experience"]}
Difficulty: {state["difficulty"]}
Weak Topics: {weak_topics}

Previously asked questions:
{prev_qs}
"""
        )
    ])


def evaluate_answer_agent(state: InterviewState):
    """
    Evaluate the candidate's answer to the current question.

    Assess correctness, clarity, and depth.
    Assign a numeric score and identify strengths and weaknesses.
    """
    return evaluation_llm.invoke([
        SystemMessage(
            content=(
                "Evaluate the candidate's answer holistically.\n\n"

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
        "3. List 2-3 concrete weaknesses (what needs improvement).\n"
        "4. Do NOT provide feedback or suggestions - only observations.\n\n"

        'Return JSON only using the schema: '
        '{"score": number, "topic": string, '
        '"strengths": [string], "weaknesses": [string]}'
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


def feedback_agent(evaluation: Evaluation):
    """
    Generate concise interview-style feedback.

    Explain strengths and areas for improvement
    without providing full model answers.
    """
    return feedback_llm.invoke([
        SystemMessage(
            content=(
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
                'Return JSON only using the schema: {"feedback": "string"}'
            )
        ),
        HumanMessage(
            content=f"""
Score: {evaluation.score}
Strengths: {evaluation.strengths}
Weaknesses: {evaluation.weaknesses}
"""
        )
    ])

def transition_agent(state: InterviewState):
    """
    Generate a short spoken transition between interview questions.
    """
    score = state["evaluation"].score if state.get("evaluation") else None

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

def decision_agent(state: InterviewState, evaluation: Evaluation):
    """
    Decide how the interview should proceed based on performance.

    Adapt difficulty, track weak topics, and determine continuation.
    Strategy:
    - Weak answer (< 5): Simplify or revisit similar concepts
    - Good answer (> 7): Increase difficulty or move to related topics
    - Repeated weak: Eventually end interview after sufficient questions
    """
    difficulty = state["difficulty"]
    add_weak = False

    # Adaptive difficulty based on performance
    if evaluation.score < 5:
        # Weak answer - go easier, track topic
        difficulty = "easy"
        add_weak = True
    elif evaluation.score >= 7:
        # Strong answer - increase challenge
        difficulty = "hard"
    # else: score 5-7 keeps current difficulty

    # End after sufficient questions (adjust as needed)
    end_interview = state["question_count"] >= 5

    return {
        "difficulty": difficulty,
        "add_weak_topic": add_weak,
        "end_interview": end_interview,
    }


def end_interview_agent(state: InterviewState):
    """
    Generate interview closing with honest assessment and feedback.
    Provide summary and spoken closing reflecting actual performance.
    """
    avg = (
        sum(state["score_history"]) / len(state["score_history"])
        if state["score_history"]
        else 0.0
    )

    # Determine verdict based on performance
    if avg >= 8:
        verdict = "Excellent performance"
    elif avg >= 7:
        verdict = "Good performance"
    elif avg >= 6:
        verdict = "Satisfactory performance"
    elif avg >= 5:
        verdict = "Needs improvement"
    else:
        verdict = "Significant gaps identified"

    summary = {
        "average_score": round(avg, 2),
        "weak_topics": list(state["weak_topics"]),
        "verdict": verdict,
    }

    closing = closing_llm.invoke([
        SystemMessage(
            content=(
                "Generate a professional, honest interview closing statement.\n\n"
                "Your Role:\n"
                "You are concluding the interview as a senior technical interviewer.\n"
                "Deliver honest feedback reflecting actual performance.\n\n"
                "Guidelines:\n"
                "1. Acknowledge overall performance (strong, good, or needs improvement).\n"
                "2. Highlight specific strengths observed during interview.\n"
                "3. Identify key areas for focused learning (weak topics).\n"
                "4. Be honest - if performance was weak, acknowledge directly.\n"
                "5. If strong - praise genuine competency and insight.\n"
                "6. Provide specific, actionable learning recommendations.\n"
                "7. End on constructive note (encouragement to keep learning).\n\n"
                "Tone:\n"
                "- Professional and respectful\n"
                "- Honest but encouraging\n"
                "- Conversational, like speaking to the candidate\n"
                "- Do NOT read scores or lists - synthesize into narrative.\n\n"
                "Important:\n"
                "- If average score < 6: Acknowledge gaps directly, suggest focused learning.\n"
                "- If average score >= 7: Praise strengths, suggest advanced topics.\n"
                "- If weak_topics are many: Suggest prioritizing learning in those areas.\n\n"
                'Return JSON only using the schema: {"spoken_closing": "string"}'
            )
        ),
        HumanMessage(
            content=f"""
Interview Summary:
Average Score: {summary['average_score']}/10
Weak Topics: {', '.join(summary['weak_topics']) if summary['weak_topics'] else 'None'}
Verdict: {summary['verdict']}
Total Questions Asked: {state['question_count']}
"""
        )
    ])

    return {
        "summary": summary,
        "spoken_closing": closing.spoken_closing,
    }