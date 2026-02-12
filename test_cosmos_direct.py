"""
Simplified test - just check Cosmos DB directly
"""
import sys
import os
import json
from datetime import datetime

# Set up path but avoid circular imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import only what we need
from azure.cosmos import CosmosClient
from backend.core.config import COSMOS_CONNECTION_STRING, COSMOS_DATABASE_NAME

# Connect directly
client = CosmosClient.from_connection_string(COSMOS_CONNECTION_STRING)
db = client.get_database_client(COSMOS_DATABASE_NAME)
container = db.get_container_client("sessions")

TEST_SESSION_ID = "test-feedback-flow-002"

print("=" * 60)
print("STEP 1: Insert test session into Cosmos DB")
print("=" * 60)

test_doc = {
    "id": TEST_SESSION_ID,
    "session_id": TEST_SESSION_ID,
    "user_id": "test-user",
    "user_email": "test@example.com",
    "user_name": "Test User",
    "job_title": "Software Engineer",
    "company_name": "Test Company",
    "total_questions": 2,
    "overall_score": 7.5,
    "question_wise_feedback": [
        {
            "questionNumber": 1,
            "question": "What is OOP?",
            "answer": "Object-oriented programming is a paradigm...",
            "score": 7,
            "topic": "OOP",
            "strengths": ["Clear", "Good examples"],
            "weaknesses": ["Missing some details"],
            "feedback": "Good answer!",
            "recordingUrl": "https://example.com/audio1.webm"
        },
        {
            "questionNumber": 2,
            "question": "What is polymorphism?",
            "answer": "Polymorphism is the ability to...",
            "score": 8,
            "topic": "Polymorphism",
            "strengths": ["Excellent"],
            "weaknesses": [],
            "feedback": "Outstanding!",
            "recordingUrl": "https://example.com/audio2.webm"
        }
    ],
    "started_at": datetime.utcnow().isoformat(),
    "completed_at": datetime.utcnow().isoformat(),
}

print(f"Inserting session with {len(test_doc['question_wise_feedback'])} feedback items")
container.upsert_item(test_doc)
print("✓ Inserted")

print("\n" + "=" * 60)
print("STEP 2: Query Cosmos DB directly")
print("=" * 60)

query = "SELECT * FROM sessions WHERE sessions.session_id = @session_id"
results = list(container.query_items(
    query=query,
    parameters=[{"name": "@session_id", "value": TEST_SESSION_ID}],
    enable_cross_partition_query=True,
    max_item_count=1
))

if not results:
    print("❌ No results found!")
    sys.exit(1)

retrieved = results[0]
print(f"✓ Retrieved session from Cosmos DB")
print(f"Keys in document: {list(retrieved.keys())}")

qwf = retrieved.get('question_wise_feedback')
print(f"\nquestion_wise_feedback:")
print(f"- Present: {'question_wise_feedback' in retrieved}")
print(f"- Value: {qwf}")
print(f"- Type: {type(qwf)}")
if qwf:
    print(f"- Length: {len(qwf)}")
    if len(qwf) > 0:
        print(f"\nFirst item:")
        print(json.dumps(qwf[0], indent=2))

# Cleanup
print("\n" + "=" * 60)
print("Cleaning up...")
print("=" * 60)
container.delete_item(item=TEST_SESSION_ID, partition_key=TEST_SESSION_ID)
print("✓ Done")
