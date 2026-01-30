# AI-Powered Voice Interview Platform

An interactive interview platform with real-time speech recognition, AI-powered question generation, and honest feedback evaluation.

## Features

- **Voice-Based Recording**: Real-time speech-to-text using Web Speech API
- **AI Question Generation**: Adaptive questions based on role, experience, and performance
- **Auto-Stop on Silence**: Automatically stops recording after 5 seconds of silence
- **Smart Countdown**: 5-second auto-submit countdown with answer, 10-second without
- **Pause/Resume**: Full control over recording with pause functionality
- **Honest Feedback**: Evaluates answers across correctness, clarity, and depth
- **Session Management**: 30-minute session timeout with 5-minute warning
- **Interview Adaptation**: Difficulty adjusts based on answer quality
- **Comprehensive Report**: Final verdict with actionable improvement suggestions

## Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** - REST API framework
- **LangChain** - LLM orchestration
- **LangGraph** - Workflow management
- **Whisper API** - Speech-to-text (via OpenAI)
- **pyttsx3** - Text-to-speech

### Frontend
- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Web Speech API** - Browser speech recognition
- **CSS3** - Responsive styling

## Project Structure

```
interviewer/
├── backend/
│   ├── agents.py          # LLM agents for question/evaluation/feedback
│   ├── graph.py           # LangGraph workflow
│   ├── llm.py             # LLM configurations
│   ├── models.py          # Pydantic models
│   ├── nodes.py           # Graph nodes
│   ├── main.py            # FastAPI server
│   ├── requirements.txt    # Python dependencies
│   ├── stt_app/           # Speech-to-text utilities
│   └── tts/               # Text-to-speech utilities
├── frontend/
│   └── voice-interviewer/
│       ├── app/           # Next.js app directory
│       ├── public/        # Static assets
│       ├── package.json   # Node dependencies
│       └── tsconfig.json  # TypeScript config
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
cd frontend/voice-interviewer
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

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
- Session timeout: 30 minutes
- Session warning: 5 minutes remaining

## Features in Detail

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
1. **Correctness**: Technical accuracy (0-10)
2. **Clarity**: How well explained (0-10)
3. **Depth**: Level of detail and reasoning (0-10)

### Final Verdict (5-Level System)
- **Excellent** (avg 8-10): Strong performance
- **Good** (avg 6-8): Solid understanding
- **Satisfactory** (avg 5-6): Acceptable
- **Needs Improvement** (avg 3-5): Below expectations
- **Significant Gaps** (avg 0-3): Major deficiencies

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

## Browser Compatibility

- Chrome/Edge: Full support
- Safari: Full support
- Firefox: Limited support (some Web Speech API features)

## Development Notes

- Frontend uses refs for callback state management to prevent stale closures
- Backend uses LangGraph for interview state workflow
- All API calls use fetchWithRetry for reliability
- Countdown logic uses synchronous refs to prevent race conditions

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
