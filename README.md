# AI-Powered Voice Interview Platform

An interactive interview platform with real-time speech recognition, AI-powered question generation, and honest feedback evaluation.

**© 2026 Accellor** - All rights reserved

## Features

## Key Features

### Admin Dashboard
- User management (view, delete users)
- View interview sessions for each user
- Questions bank management
- Candidate invite system with email notifications
- Analytics and activity tracking

### Interview Features
- Real-time speech recognition with Web Speech API
- AI-powered adaptive question generation
- Auto-stop on 5 seconds of silence
- Smart countdown with 5s (with answer) or 10s (without answer) before auto-submit
- Pause/resume recording capability
- Comprehensive evaluation with scoring (0-10 scale) and detailed strengths/weaknesses
- 60-minute session timeout
- Adaptive difficulty based on performance
- Final verdict with actionable feedback
- Two interview modes: Strict (continuous flow) and Coach (gated progression)

## Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** - REST API framework
- **LangChain** - LLM orchestration
- **LangGraph** - Agentic workflow management
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

### Frontend
- **React 19** - UI framework
- **Vite 5** - Build tool & dev server
- **Tailwind CSS 4** - Utility-first styling
- **Web Speech API** - Browser speech recognition
- **Azure Speech Services** - Text-to-speech
- **JavaScript (ES6+)** - Dynamic interactivity

## Project Structure

```
interviewer/
├── backend/
│   ├── api/               # API routes
│   ├── auth/              # Authentication utilities
│   ├── core/              # Core utilities (config, database, LLM)
│   ├── interview/         # Interview workflow & graph logic
│   ├── main.py            # FastAPI server
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/    # React components (screens, UI)
│   │   ├── context/       # React context (interview state)
│   │   ├── hooks/         # Custom hooks (auth, API)
│   │   ├── utils/         # Utility functions (API, auth config)
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Vite entry point
│   ├── public/            # Static assets
│   ├── screens/           # Screen UI templates
│   ├── css/               # Tailwind styling
│   ├── js/                # JavaScript modules
│   ├── index.html         # HTML entry point
│   ├── package.json       # Node dependencies
│   └── vite.config.js     # Vite configuration
├── interview_graph.mmd    # Interview flow diagram
└── README.md
```

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```

Backend runs on `http://127.0.0.1:8000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` (Vite default)

## Interview Flow

1. **Start**: Select role and experience level
2. **Question**: Hear the first question (audio plays automatically)
3. **Record**: Recording starts 1.5s after question finishes
4. **Smart Stop**: Recording stops on 5 seconds of silence OR manual stop
5. **Review**: 5s countdown (with answer) or 10s (without) before auto-submit
6. **Evaluate**: Backend evaluates answer and determines next difficulty
7. **Repeat**: Up to 5 questions total
8. **Complete**: Final verdict with comprehensive feedback

## Key Configuration

### Silence Detection
- Threshold: 5 seconds of silence triggers auto-stop
- Check interval: 500ms

### Auto-Submit Countdown
- With answer: 5 seconds
- Without answer: 10 seconds
- Manual mode (re-record): No auto-submit

### Interview Duration
- Total questions: 5
- Session timeout: 60 minutes

## Features in Detail

### Interview Personas
- **Strict Mode**: Continuous flow - questions follow each other automatically after evaluation
- **Coach Mode**: Gated progression - waits for user confirmation before proceeding to next question, providing detailed feedback

### Recording Logic
- **Normal Recording** (from question audio):
  - Auto-stops on silence → enters review mode → 5/10s countdown → auto-submit
  
- **Manual Re-Record**:
  - No auto-stop, no auto-submit → user must press Stop or Submit manually
  
- **Pause Feature**:
  - Pauses without entering review mode
  - Resume continues recording

- **Stop Button**:
  - Stops recording → enters review mode → auto-submit countdown

### Evaluation Criteria
Each answer receives a single holistic score (0-10 scale) based on technical accuracy, clarity, and depth, along with:
- **Strengths**: What was done well
- **Weaknesses**: Areas for improvement

### Final Verdict (5-Level System)
- **Excellent** (8.0-10): Strong performance with comprehensive understanding
- **Good** (7.0-8.0): Solid understanding with minor gaps
- **Satisfactory** (6.0-7.0): Acceptable knowledge with some gaps
- **Needs Improvement** (5.0-6.0): Below expectations with significant gaps
- **Significant Gaps** (<5.0): Major deficiencies in understanding

## Keyboard Shortcuts

- **Ctrl/Cmd + Enter**: Submit answer (in review mode)
- **Space**: Toggle record/stop (recording mode) or re-record (review mode)

## State Management

### Frontend State
- Recording state with recognition ref
- Pause/resume capabilities
- Manual recording mode for re-record
- Auto-send countdown with 5/10 second variants
- Session timeout tracking

### Backend State
- Interview session tracking
- Question history
- Weak topics identification
- Adaptive difficulty management
- Performance scoring

## Error Handling

- **3x retry logic** with exponential backoff on API calls
- **Microphone permission** handling
- **Network error** recovery
- **Stale state prevention** using refs in React callbacks

## Development Notes

- Frontend uses refs for callback state management to prevent stale closures
- Backend uses LangGraph for interview state workflow management with two graph types: strict and coach
- All API calls use fetchWithRetry for reliability
- Countdown logic uses synchronous refs to prevent race conditions
- Email templates use embedded Base64 SVG logos to prevent email client image blocking
- Admin dashboard includes user management, session viewing, questions bank management, and candidate invitations
- Authentication integrated with Auth0 for secure user management
- Database uses Azure Cosmos DB for scalable session storage
- LLM-powered question generation and evaluation using LangChain with streaming capabilities

## Future Enhancements

- Video interview support
- Interview history/analytics
- Skill-based question recommendations
- Real-time performance dashboard
- Export interview transcript
- Interviewer calibration

## License

MIT

## Support

For issues or questions, check the documentation in each directory's README.md file.
