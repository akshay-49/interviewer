from langchain_ollama import ChatOllama
from models import Question, Evaluation, Feedback, SpokenClosing, SpokenTransition

llm = ChatOllama(
    model="gpt-oss:120b-cloud",
    temperature=0.5
)

question_llm = llm.with_structured_output(Question)
evaluation_llm = llm.with_structured_output(Evaluation)
feedback_llm = llm.with_structured_output(Feedback)
closing_llm = llm.with_structured_output(SpokenClosing)
transition_llm = llm.with_structured_output(SpokenTransition)
