import tempfile
import os
from .whisper_model import model

def transcribe_audio(audio_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as f:
        f.write(audio_bytes)
        temp_path = f.name

    try:
        segments, _ = model.transcribe(
            temp_path,
            language="en",
            vad_filter=True
        )

        text = " ".join(segment.text for segment in segments)
        return text.strip()

    finally:
        os.remove(temp_path)
