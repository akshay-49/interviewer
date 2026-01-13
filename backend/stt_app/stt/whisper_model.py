from faster_whisper import WhisperModel

model = WhisperModel(
    "small",           # good balance
    device="cpu",
    compute_type="int8"
)
