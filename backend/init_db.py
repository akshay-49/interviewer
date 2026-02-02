"""Database initialization script - creates collections and indexes for Cosmos DB"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.cosmos import init_cosmos_db

if __name__ == "__main__":
    try:
        init_cosmos_db()
        print("✅ Cosmos DB initialization completed successfully")
    except Exception as e:
        print(f"❌ Cosmos DB initialization failed: {e}")
        sys.exit(1)

def init_db():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
