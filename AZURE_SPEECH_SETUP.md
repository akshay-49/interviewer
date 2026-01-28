# Azure AI Speech Setup

## 1. Get Azure Speech API Key

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a **Speech Service** resource (or use existing)
3. Navigate to **Keys and Endpoint**
4. Copy **Key 1** and **Region**

## 2. Set Environment Variables

### PowerShell (Windows):
```powershell
$env:AZURE_SPEECH_KEY="your_key_here"
$env:AZURE_SPEECH_REGION="eastus"  # or your region
```

### Bash (Linux/Mac):
```bash
export AZURE_SPEECH_KEY="your_key_here"
export AZURE_SPEECH_REGION="eastus"  # or your region
```

### Permanent Setup (Windows):
```powershell
[System.Environment]::SetEnvironmentVariable('AZURE_SPEECH_KEY', 'your_key_here', 'User')
[System.Environment]::SetEnvironmentVariable('AZURE_SPEECH_REGION', 'eastus', 'User')
```

## 3. Install Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

## 4. Voice Options

Current voice: **en-US-JennyNeural** (Professional female)

To change voice, edit `backend/tts/tts_engine.py` and set `INTERVIEWER_VOICE` to:
- `en-US-GuyNeural` - Professional male
- `en-US-AriaNeural` - Conversational female  
- `en-US-DavisNeural` - Conversational male
- [See all voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)

## 5. Test

```powershell
cd c:\Users\AkshayPrabhuGopathi\Documents\interviewer
python -m uvicorn backend.main:app --reload --port 8000
```

If you see "⚠️ WARNING: AZURE_SPEECH_KEY not set", check step 2.
