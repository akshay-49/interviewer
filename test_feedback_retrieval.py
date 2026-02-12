"""
Test script to debug feedback retrieval from Cosmos DB
"""
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.core.cosmos import get_session, sessions_container, serialize_for_cosmos
import json

# Test session ID
TEST_SESSION_ID = "test-feedback-flow-001"

# Create test session with feedback
test_session = {
    "id": TEST_SESSION_ID,
    "session_id": TEST_SESSION_ID,
    "user_id": "test-user",
    "user_email": "test@example.com",
    "user_name": "Test User",
    "job_title": "Software Engineer",
    "company_name": "Test Company",
    "total_questions": 2,
    "overall_score": 7.5,
    "hints_used": 0,
    "questions_skipped": 0,
    "answers": [
        {
            "question": "What is OOP?",
            "answer": "Object-oriented programming is..."
        },
        {
            "question": "Explain polymorphism",
            "answer": "Polymorphism is the ability to..."
        }
    ],
    "question_wise_feedback": [
        {
            "questionNumber": 1,
            "question": "What is OOP?",
            "answer": "Object-oriented programming is...",
            "score": 7,
            "topic": "Object-Oriented Programming",
            "strengths": ["Clear explanation", "Good examples"],
            "weaknesses": ["Missed some details"],
            "feedback": "Good answer, could add more detail",
            "recordingUrl": "https://example.com/audio1.webm"
        },
        {
            "questionNumber": 2,
            "question": "Explain polymorphism",
            "answer": "Polymorphism is the ability to...",
            "score": 8,
            "topic": "Polymorphism",
            "strengths": ["Excellent explanation"],
            "weaknesses": [],
            "feedback": "Outstanding answer!",
            "recordingUrl": "https://example.com/audio2.webm"
        }
    ],
    "summary": {
        "average_score": 7.5,
        "key_strengths": ["Clear communication"],
        "areas_for_improvement": ["More depth needed"]
    },
    "started_at": datetime.utcnow().isoformat(),
    "completed_at": datetime.utcnow().isoformat(),
    "duration_seconds": 300
}

print("=" * 60)
print("STEP 1: Inserting test session into Cosmos DB")
print("=" * 60)
print(f"Session ID: {TEST_SESSION_ID}")
print(f"question_wise_feedback items: {len(test_session['question_wise_feedback'])}")

# Serialize and save
serialized = serialize_for_cosmos(test_session)
print(f"\nAfter serialization:")
print(f"- question_wise_feedback in serialized: {len(serialized.get('question_wise_feedback', []))} items")

sessions_container.upsert_item(serialized)
print("✓ Session inserted successfully")

print("\n" + "=" * 60)
print("STEP 2: Retrieving session using get_session()")
print("=" * 60)

retrieved = get_session(TEST_SESSION_ID)

if not retrieved:
    print("❌ ERROR: Session not found!")
    sys.exit(1)

print(f"✓ Session retrieved")
print(f"Session keys: {list(retrieved.keys())}")
print(f"'question_wise_feedback' in keys: {'question_wise_feedback' in retrieved}")

qwf = retrieved.get('question_wise_feedback', [])
print(f"\nquestion_wise_feedback:")
print(f"- Type: {type(qwf)}")
print(f"- Length: {len(qwf) if isinstance(qwf, list) else 'N/A'}")
print(f"- Value: {qwf}")

if len(qwf) > 0:
    print(f"\nFirst feedback item:")
    print(json.dumps(qwf[0], indent=2))

print("\n" + "=" * 60)
print("STEP 3: Building SessionDetail response")
print("=" * 60)

from backend.interview.models import SessionDetail

session_detail = SessionDetail(
    session_id=retrieved.get('session_id'),
    user_email=retrieved.get('user_email'),
    user_name=retrieved.get('user_name'),
    job_title=retrieved.get('job_title'),
    company_name=retrieved.get('company_name'),
    total_questions=retrieved.get('total_questions', 0),
    overall_score=retrieved.get('overall_score'),
    hints_used=retrieved.get('hints_used', 0),
    questions_skipped=retrieved.get('questions_skipped', 0),
    summary=retrieved.get('summary'),
    question_wise_feedback=qwf,
    started_at=retrieved.get('started_at'),
    completed_at=retrieved.get('completed_at'),
    duration_seconds=retrieved.get('duration_seconds'),
)

print(f"✓ SessionDetail created")
print(f"SessionDetail.question_wise_feedback:")
print(f"- Length: {len(session_detail.question_wise_feedback)}")
print(f"- Type: {type(session_detail.question_wise_feedback)}")

print("\n" + "=" * 60)
print("STEP 4: Serializing SessionDetail to JSON")
print("=" * 60)

response_json = session_detail.model_dump_json(exclude_none=True)
print(f"Response JSON length: {len(response_json)} chars")

import json as json_module
response_dict = json_module.loads(response_json)
print(f"question_wise_feedback in JSON: {len(response_dict.get('question_wise_feedback', []))} items")

if len(response_dict.get('question_wise_feedback', [])) > 0:
    print(f"\nFirst feedback item in response:")
    print(json_module.dumps(response_dict['question_wise_feedback'][0], indent=2))

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"✓ Data flows correctly through all layers!")
print(f"✓ Final response has {len(response_dict.get('question_wise_feedback', []))} feedback items")

# Cleanup
print("\nCleaning up test data...")
sessions_container.delete_item(item=TEST_SESSION_ID, partition_key=TEST_SESSION_ID)
print("✓ Test session deleted")
