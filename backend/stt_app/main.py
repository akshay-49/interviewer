from fastapi import FastAPI, UploadFile, File, HTTPException
from stt.transcribe import transcribe_audio

app = FastAPI()

@app.get("/")
def home():
    return {"message": "STT server is running"}

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    if not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="Invalid audio file")

    audio_bytes = await file.read()
    text = transcribe_audio(audio_bytes)

    if not text:
        return {"text": None, "error": "Could not transcribe"}

    return {"text": text}
