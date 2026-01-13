from TTS.api import TTS

tts = TTS(
    model_name="tts_models/en/ljspeech/tacotron2-DDC",
    gpu=False
)

tts.tts_to_file(
    text="This is a direct test of text to speech.",
    file_path="test.wav"
)

print("done")
