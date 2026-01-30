from langchain_ollama import ChatOllama
from backend.models import Question, Evaluation, Feedback, Hint, EvaluationWithFeedback, SpokenClosing, SpokenTransition
from dotenv import load_dotenv

load_dotenv()

llm = ChatOllama(
    model="gpt-oss:120b-cloud",
    temperature=0.5
)

question_llm = llm.with_structured_output(Question)
evaluation_llm = llm.with_structured_output(Evaluation)
feedback_llm = llm.with_structured_output(Feedback)
evaluation_with_feedback_llm = llm.with_structured_output(EvaluationWithFeedback)
hint_llm = llm.with_structured_output(Hint)
closing_llm = llm.with_structured_output(SpokenClosing)
transition_llm = llm.with_structured_output(SpokenTransition)
