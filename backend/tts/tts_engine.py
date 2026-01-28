import azure.cognitiveservices.speech as speechsdk
import os
from io import BytesIO

from dotenv import load_dotenv
from backend.config import DEFAULT_TTS_VOICE

load_dotenv()


AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "eastus")

# Voice selection - professional, clear, neutral
INTERVIEWER_VOICE = DEFAULT_TTS_VOICE

if not AZURE_SPEECH_KEY:
    print("WARNING: AZURE_SPEECH_KEY not set. TTS will fail.")
    print("Set it with: $env:AZURE_SPEECH_KEY='your_key_here' (PowerShell)")


def synthesize_speech(text: str) -> bytes:
    """
    Convert text to natural-sounding interviewer speech using Azure AI Speech.
    Returns WAV audio bytes.
    """
    if not text or not text.strip():
        raise ValueError("Empty text passed to TTS")
    
    if not AZURE_SPEECH_KEY:
        raise ValueError(
            "Azure Speech API key not configured. "
            "Set AZURE_SPEECH_KEY environment variable."
        )

    # Configure Azure Speech
    speech_config = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY,
        region=AZURE_SPEECH_REGION
    )
    
    # Set voice and audio format
    speech_config.speech_synthesis_voice_name = INTERVIEWER_VOICE
    
    # Create synthesizer without audio output (we'll get audio data directly from result)
    speech_synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config,
        audio_config=None  # None means we get the audio data in the result
    )
    
    # Synthesize speech
    result = speech_synthesizer.speak_text_async(text).get()
    
    # Check result
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        # Return audio data as bytes
        return result.audio_data
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation = result.cancellation_details
        error_msg = f"Speech synthesis canceled: {cancellation.reason}"
        if cancellation.reason == speechsdk.CancellationReason.Error:
            error_msg += f" Error details: {cancellation.error_details}"
        raise RuntimeError(error_msg)
    else:
        raise RuntimeError(f"Speech synthesis failed with reason: {result.reason}")
