# Backend Folder Structure

The backend has been organized into logical modules for better maintainability and scalability.

## Directory Structure

```
backend/
├── api/                    # API routes (future expansion)
│   └── __init__.py
│
├── auth/                   # Authentication module
│   ├── __init__.py
│   ├── models.py          # User database model
│   ├── routes.py          # Auth endpoints (signup, login, forgot-password)
│   └── utils.py           # Password hashing & JWT utilities
│
├── core/                   # Core infrastructure
│   ├── __init__.py
│   ├── config.py          # Application configuration constants
│   ├── database.py        # PostgreSQL database setup (SQLAlchemy)
│   └── llm.py            # LLM instances with structured output
│
├── interview/              # Interview logic
│   ├── __init__.py
│   ├── agents.py          # AI agents (question, evaluate, hint, etc.)
│   ├── graph.py           # LangGraph workflow definitions
│   ├── models.py          # Interview state & data models
│   └── nodes.py           # Graph nodes (ask, evaluate, decide, etc.)
│
├── init_db.py             # Database initialization script
├── main.py                # FastAPI application entry point
└── requirements.txt       # Python dependencies
```

## Module Descriptions

### `auth/` - Authentication
Handles user authentication with PostgreSQL and JWT tokens:
- **models.py**: User table schema with email, password, timestamps
- **routes.py**: REST endpoints for signup, login, password reset
- **utils.py**: bcrypt password hashing and JWT token creation/verification

### `core/` - Core Infrastructure
Foundational components used across the application:
- **config.py**: Configuration constants (max questions, personas, thresholds, etc.)
- **database.py**: SQLAlchemy engine, session management, Base class
- **llm.py**: ChatOllama LLM instances configured with structured output schemas

### `interview/` - Interview Engine
Complete interview workflow logic powered by LangGraph:
- **models.py**: TypedDict/Pydantic models for interview state, questions, evaluations
- **agents.py**: AI agents that generate questions, evaluate answers, provide hints
- **nodes.py**: LangGraph nodes that wrap agents and handle state transitions
- **graph.py**: Workflow graphs (strict mode, coach mode) with conditional edges

### `api/` - API Routes
Reserved for future API endpoint organization (currently empty).

## Import Patterns

### From Interview Module
```python
from backend.interview import InterviewState, build_graph_strict
from backend.interview.agents import hint_agent
```

### From Core Module
```python
from backend.core import get_db, question_llm
from backend.core.config import MAX_QUESTIONS
```

### From Auth Module
```python
from backend.auth.routes import router as auth_router
from backend.auth.models import User
```

## Benefits of This Structure

✅ **Separation of Concerns**: Each module has a clear responsibility
✅ **Scalability**: Easy to add new modules (e.g., analytics, reporting)
✅ **Testability**: Modules can be tested independently
✅ **Maintainability**: Related code is grouped together
✅ **Clean Imports**: Clear module hierarchy prevents circular dependencies

## Running the Application

```bash
# Initialize database (first time only)
python init_db.py

# Start the server
uvicorn backend.main:app --reload
```

All imports have been updated to reflect the new structure. No code changes required!
