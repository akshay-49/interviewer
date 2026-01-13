from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from models import InterviewState
from nodes import (
    ask_question_node,
    await_answer_node,
    evaluate_node,
    feedback_node,
    decision_node,
    end_node,
    transition_node,
)


def build_graph():
    builder = StateGraph(InterviewState)

    builder.add_node("ask", ask_question_node)
    builder.add_node("await_answer", await_answer_node)
    builder.add_node("evaluate", evaluate_node)
    builder.add_node("transition", transition_node)
    builder.add_node("feedback", feedback_node)
    builder.add_node("decide", decision_node)
    builder.add_node("end", end_node)

    builder.set_entry_point("ask")

    builder.add_edge("ask", "await_answer")
    builder.add_edge("await_answer", "evaluate")
    builder.add_edge("evaluate", "feedback")
    builder.add_edge("feedback", "decide")
    builder.add_edge("decide", "transition")
    builder.add_edge("transition", "ask")

    builder.add_conditional_edges(
    "decide",
    lambda s: "end" if s["end_interview"] else "transition",
    {
        "end": "end",
        "transition": "transition",
    },
)


    builder.add_edge("end", END)

    return builder.compile(checkpointer=MemorySaver())
