from .record import record_audio
from .transcribe import transcribe_audio

def get_answer_via_stt() -> str:
    audio_bytes = record_audio(seconds=8)
    text = transcribe_audio(audio_bytes)

    if not text:
        print("Could not transcribe. Please try again.")
        return get_answer_via_stt()

    print(f"\nTranscribed Answer: {text}")
    return text
