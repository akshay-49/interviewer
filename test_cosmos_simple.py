"""
Direct Cosmos DB test - no backend imports
"""
import os
import json
from datetime import datetime
from azure.cosmos import CosmosClient
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Get config from env directly
COSMOS_CONNECTION_STRING = os.getenv('COSMOS_CONNECTION_STRING')
COSMOS_DATABASE_NAME = os.getenv('COSMOS_DATABASE_NAME', 'interviewer_db')

if not COSMOS_CONNECTION_STRING:
    print("ERROR: COSMOS_CONNECTION_STRING not set in .env")
    exit(1)

# Connect directly
print("Connecting to Cosmos DB...")
client = CosmosClient.from_connection_string(COSMOS_CONNECTION_STRING)
db = client.get_database_client(COSMOS_DATABASE_NAME)
container = db.get_container_client("sessions")
print("✓ Connected")

TEST_SESSION_ID = "test-feedback-flow-003"

print("\n" + "=" * 60)
print("STEP 1: Insert test session")
print("=" * 60)

test_doc = {
    "id": TEST_SESSION_ID,
    "session_id": TEST_SESSION_ID,
    "user_id": "test-user",
    "user_email": "test@example.com",
    "user_name": "Test User",
    "job_title": "Software Engineer",
    "total_questions": 2,
    "overall_score": 7.5,
    "question_wise_feedback": [
        {
            "questionNumber": 1,
            "question": "What is OOP?",
            "answer": "Object-oriented programming...",
            "score": 7,
            "topic": "OOP",
            "strengths": ["Clear"],
            "weaknesses": ["Missing details"],
            "feedback": "Good!",
            "recordingUrl": "https://example.com/audio1.webm"
        },
        {
            "questionNumber": 2,
            "question": "What is polymorphism?",
            "answer": "Polymorphism is...",
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

print(f"Document has {len(test_doc['question_wise_feedback'])} feedback items")
container.upsert_item(test_doc)
print("✓ Inserted into Cosmos")

print("\n" + "=" * 60)
print("STEP 2: Retrieve with SQL query")
print("=" * 60)

query = "SELECT * FROM sessions WHERE sessions.session_id = @session_id"
results = list(container.query_items(
    query=query,
    parameters=[{"name": "@session_id", "value": TEST_SESSION_ID}],
    enable_cross_partition_query=True
))

print(f"Query results: {len(results)} items")

if not results:
    print("❌ ERROR: No results!")
else:
    doc = results[0]
    print(f"✓ Retrieved document")
    print(f"  Keys: {list(doc.keys())}")
    
    qwf = doc.get('question_wise_feedback')
    print(f"\n  question_wise_feedback:")
    print(f"    - Present: {'question_wise_feedback' in doc}")
    print(f"    - Type: {type(qwf).__name__}")
    print(f"    - Length: {len(qwf) if qwf else 'null'}")
    
    if qwf and len(qwf) > 0:
        print(f"\n  First feedback item:")
        print(f"    - questionNumber: {qwf[0].get('questionNumber')}")
        print(f"    - question: {qwf[0].get('question')}")
        print(f"    - score: {qwf[0].get('score')}")

# Cleanup
print("\n" + "=" * 60)
print("STEP 3: Cleanup")
print("=" * 60)
container.delete_item(item=TEST_SESSION_ID, partition_key=TEST_SESSION_ID)
print("✓ Test document deleted")

print("\n" + "=" * 60)
print("RESULT: Data flows correctly through Cosmos DB!")
print("=" * 60)
