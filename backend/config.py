"""
Configuration constants for the interview backend.
"""

# Interview settings
MAX_QUESTIONS = 5  # Total questions per interview
DEFAULT_PERSONA = "strict"  # Default interviewer persona
AVAILABLE_PERSONAS = ["strict", "coach"]

# Session management
SESSION_TTL_MINUTES = 60  # Session expiration time
MAX_SESSIONS = 1000  # Maximum concurrent sessions

# Azure Speech settings
DEFAULT_TTS_VOICE = "en-US-JennyNeural"  # Professional female voice
# Alternative voices:
# "en-US-GuyNeural" - Professional male
# "en-US-AriaNeural" - Conversational female
# "en-US-DavisNeural" - Conversational male

DEFAULT_STT_LANGUAGE = "en-US"

# Scoring thresholds
SCORE_EXCELLENT = 8.0
SCORE_GOOD = 7.0
SCORE_SATISFACTORY = 6.0
SCORE_NEEDS_IMPROVEMENT = 5.0
WEAK_ANSWER_THRESHOLD = 5.0  # Below this marks topic as weak
STRONG_ANSWER_THRESHOLD = 7.0  # Above this increases difficulty

# Difficulty levels
DIFFICULTY_EASY = "easy"
DIFFICULTY_HARD = "hard"
