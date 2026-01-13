import sounddevice as sd
import soundfile as sf
import io

def record_audio(seconds: int = 8, sample_rate: int = 16000) -> bytes:
    print(f"\n Recording for {seconds} seconds... Speak now.")

    audio = sd.rec(
        int(seconds * sample_rate),
        samplerate=sample_rate,
        channels=1,
        dtype="float32"
    )
    sd.wait()

    print("Recording stopped.")

    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV")
    buffer.seek(0)

    return buffer.read()
