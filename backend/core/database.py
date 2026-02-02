"""Database configuration for Azure Cosmos DB (MongoDB API)"""
import os
from pathlib import Path
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from dotenv import load_dotenv

# Load .env from project root
root_dir = Path(__file__).parent.parent.parent
load_dotenv(root_dir / '.env')

# Cosmos DB connection string (MongoDB API)
COSMOS_CONNECTION_STRING = os.getenv(
    "COSMOS_CONNECTION_STRING",
    "mongodb://localhost:27017"  # Local fallback for development
)

# Database and collection names
DATABASE_NAME = "interviewer"
USERS_COLLECTION = "users"

# Create MongoDB client
try:
    client = MongoClient(COSMOS_CONNECTION_STRING, serverSelectionTimeoutMS=5000)
    # Test connection
    client.admin.command('ping')
    db = client[DATABASE_NAME]
    users_collection = db[USERS_COLLECTION]
    print("✅ Connected to Cosmos DB (MongoDB API)")
except ServerSelectionTimeoutError:
    print("⚠️  Could not connect to Cosmos DB. Using local MongoDB if available.")
    client = MongoClient(COSMOS_CONNECTION_STRING)
    db = client[DATABASE_NAME]
    users_collection = db[USERS_COLLECTION]

def get_db():
    """Returns the database instance for dependency injection"""
    return db

def get_users_collection():
    """Returns the users collection"""
    return users_collection

def init_db():
    """Initialize database collections and indexes"""
    try:
        # Create unique index on email
        users_collection.create_index("email", unique=True)
        print("✅ Database indexes created successfully")
    except Exception as e:
        print(f"⚠️  Error creating indexes: {e}")
