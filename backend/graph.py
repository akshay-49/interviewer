from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from backend.models import InterviewState
from backend.nodes import (
    ask_question_node,
    await_answer_node,
    evaluate_node,
    decision_node,
    end_node,
    transition_node,
    await_continue_node,
)


def build_graph_strict():
    """Original strict interview flow: ask → await_answer → evaluate → decide → transition/end."""
    builder = StateGraph(InterviewState)

    builder.add_node("ask", ask_question_node)
    builder.add_node("await_answer", await_answer_node)
    builder.add_node("evaluate", evaluate_node)
    builder.add_node("transition", transition_node)
    builder.add_node("decide", decision_node)
    builder.add_node("end", end_node)

    builder.set_entry_point("ask")

    builder.add_edge("ask", "await_answer")
    builder.add_edge("await_answer", "evaluate")
    builder.add_edge("evaluate", "decide")
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


def build_graph_coach():
    """Coach flow: insert await_continue after evaluate to gate next question on user action."""
    builder = StateGraph(InterviewState)

    builder.add_node("ask", ask_question_node)
    builder.add_node("await_answer", await_answer_node)
    builder.add_node("evaluate", evaluate_node)
    builder.add_node("await_continue", await_continue_node)
    builder.add_node("decide", decision_node)
    builder.add_node("transition", transition_node)
    builder.add_node("end", end_node)

    builder.set_entry_point("ask")

    builder.add_edge("ask", "await_answer")
    builder.add_edge("await_answer", "evaluate")
    # Pause here for user to review feedback and press Proceed
    builder.add_edge("evaluate", "await_continue")
    # After proceed, continue with decision/transition
    builder.add_edge("await_continue", "decide")
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
