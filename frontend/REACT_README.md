# Frontend - React Migration Complete

## Setup

The frontend has been converted from vanilla JavaScript to React.

### Installation

```bash
cd frontend
npm install
```

### Running the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

## What Changed

### Architecture
- **Before**: Vanilla JS with iframe-based screens
- **After**: React with proper component architecture

### Tech Stack
- React 18.3.1
- Vite (with React plugin)
- Tailwind CSS (CDN)
- Web Speech API for voice recognition
- Fetch API for backend communication

### Components Structure
```
src/
├── App.jsx                          # Main app component
├── main.jsx                         # Entry point
├── index.css                        # Global styles
├── components/
│   ├── ScreenManager.jsx            # Screen routing logic
│   └── screens/
│       ├── WelcomeScreen.jsx        # Landing page
│       ├── SetupScreen.jsx          # Interview configuration
│       ├── InterviewScreen.jsx      # Main interview with Q&A
│       └── ResultsScreen.jsx        # Summary and feedback
├── context/
│   └── InterviewContext.jsx         # Global state management
└── utils/
    └── api.js                       # Backend API client
```

### Features
- ✅ Real-time speech recognition
- ✅ Audio playback for questions
- ✅ Progress tracking (5 questions)
- ✅ Live transcript display
- ✅ Backend integration
- ✅ Responsive design
- ✅ Dark mode ready (via Tailwind)

### State Management
Using React Context API for global state:
- Interview data (session, questions, answers)
- Screen navigation
- Backend connection status

### API Integration
All API calls handled through `utils/api.js`:
- `api.startInterview(role, experience)`
- `api.submitAnswer(sessionId, answer)`
- `playAudioFromBase64(base64Audio)`

## Development

The app uses Vite's hot module replacement (HMR) for instant updates during development.

### Backend Requirement
Make sure the FastAPI backend is running on `http://localhost:8000`

```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Build for Production

```bash
npm run build
```

Output will be in `dist/` directory.
