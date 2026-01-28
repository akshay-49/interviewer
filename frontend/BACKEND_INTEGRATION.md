# Backend Integration Guide

## Setup

### 1. Start Backend Server
```bash
cd backend
python -m uvicorn main:app --reload
```
Backend runs on `http://localhost:8000`

### 2. Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5174`

## Architecture

### Frontend Flow
1. **Welcome Screen** → User clicks "Start Interview Session"
2. **Setup Screen** → User selects role, experience, duration, difficulty
3. **Listening Screen** → Backend sends question, user's turn to speak
4. **Evaluating Screen** → User's answer is being analyzed
5. **Results Screen** → Interview summary and scores

### Backend Integration Points

#### 1. Start Interview
```
POST /interview/start
Request: { role: string, experience: string }
Response: { session_id, question, audio: base64 }
```

#### 2. Submit Answer
```
POST /interview/answer
Request: { session_id, answer: string }
Response: { 
  final: boolean,
  question?: string,
  summary?: object,
  audio: base64,
  spoken_transition?: string
}
```

## Features Implemented

✅ **Audio Playback** - Backend TTS responses play automatically
✅ **Speech Recognition** - Web Speech API captures user answers
✅ **Session Management** - Each interview has unique session_id
✅ **Progressive Questions** - Backend generates next question based on answers
✅ **Answer Evaluation** - Backend analyzes and scores responses
✅ **Interview Summary** - Final results with performance metrics

## Key Functions

### api.js
- `api.startInterview(role, experience)` - Initialize interview session
- `api.submitAnswer(sessionId, answer)` - Submit user's spoken answer
- `api.healthCheck()` - Check backend availability
- `recordAudio(maxDuration)` - Record user speech using Web Speech API
- `playAudioFromBase64(audio)` - Play base64 encoded audio response

### app.js
- `navigateTo(screenName)` - Navigate between screens
- `handleStartInterview()` - Prepare for interview
- `handleSetupComplete(data)` - Start interview with backend
- `handleSubmitAnswer()` - Record answer and get next question/summary

## Environment Variables

Create `.env` file in frontend (optional):
```
VITE_API_URL=http://localhost:8000
```

## Browser Requirements

- Modern browser with Web Speech API support (Chrome, Edge, Firefox)
- Microphone access permissions
- CORS enabled on backend (already configured)

## Troubleshooting

**Backend not connecting?**
- Ensure backend is running on `http://localhost:8000`
- Check CORS is enabled: `CORSMiddleware` in backend/main.py
- Check browser console for errors

**No audio playing?**
- Check browser audio permissions
- Verify backend TTS engine (requires festival/espeak on system)

**Speech recognition not working?**
- Only works in HTTPS or localhost
- Use Chrome/Edge for best compatibility
- Check microphone permissions

## File Structure
```
frontend/
├── index.html           # Main HTML
├── js/
│   ├── app.js          # Main app logic + backend integration
│   ├── api.js          # API client for backend communication
│   └── tailwind-config.js
├── css/
│   └── main.css
└── screens/ui/         # All 12 interview screens
```
