from TTS.api import TTS
import tempfile
import os
import soundfile as sf

# --------------------------------------------------
# Load model ONCE
# --------------------------------------------------

tts = TTS(
    model_name="tts_models/en/vctk/vits",
    gpu=False
)

# Choose a consistent interviewer voice
INTERVIEWER_SPEAKER = "p225"  # calm, neutral, professional


def synthesize_speech(text: str) -> bytes:
    """
    Convert text to natural-sounding interviewer speech.
    Returns WAV audio bytes.
    """
    if not text or not text.strip():
        raise ValueError("Empty text passed to TTS")

    # Generate waveform
    wav = tts.tts(
        text=text,
        speaker=INTERVIEWER_SPEAKER
    )

    # Write proper WAV bytes
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
        sf.write(f.name, wav, samplerate=22050)
        path = f.name

    try:
        with open(path, "rb") as audio_file:
            return audio_file.read()
    finally:
        os.remove(path)
