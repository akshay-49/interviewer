// Azure Speech SDK Wrapper for Interview Application
// Load SDK from CDN: Add to index.html:
// <script src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle.min.js"></script>

// Token cache to avoid fetching new token for every request
let cachedToken = null;
let tokenExpiry = null;

// Fetch Azure Speech token from backend (secure - API key stays on server)
async function getAzureSpeechToken() {
    // Return cached token if still valid (tokens expire after 10 minutes)
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE_URL}/speech/token`);
        
        if (!response.ok) {
            throw new Error('Failed to get speech token');
        }
        
        const data = await response.json();
        cachedToken = data;
        // Set expiry to 9 minutes (tokens valid for 10, refresh before expiry)
        tokenExpiry = Date.now() + (9 * 60 * 1000);
        
        return cachedToken;
    } catch (error) {
        console.error('Error fetching speech token:', error);
        throw error;
    }
}

export class AzureSpeechRecognizer {
    constructor() {
        this.recognizer = null;
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this.isRecording = false;
        this.finalTranscript = '';
        this.SpeechSDK = window.SpeechSDK;
        
        if (!this.SpeechSDK) {
            console.error('Azure Speech SDK not loaded. Add script tag to index.html');
        }
    }

    async start() {
        if (!this.SpeechSDK) {
            if (this.onerror) {
                this.onerror({ error: 'sdk-not-loaded' });
            }
            return;
        }

        try {
            // Get token from backend (secure)
            const { token, region } = await getAzureSpeechToken();
            
            // Configure speech recognition with token
            const speechConfig = this.SpeechSDK.SpeechConfig.fromAuthorizationToken(
                token,
                region
            );
            speechConfig.speechRecognitionLanguage = 'en-US';
            
            // Configure audio input from microphone
            const audioConfig = this.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            
            // Create speech recognizer
            this.recognizer = new this.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
            
            // Reset transcript
            this.finalTranscript = '';
            
            // Set up event handlers
            this.recognizer.recognizing = (s, e) => {
                if (e.result.reason === this.SpeechSDK.ResultReason.RecognizingSpeech) {
                    // Emit ONLY interim text (not accumulated)
                    if (this.onresult) {
                        const event = {
                            results: [{
                                transcript: e.result.text,
                                isFinal: false
                            }],
                            resultIndex: 0
                        };
                        this.onresult(event);
                    }
                }
            };
            
            this.recognizer.recognized = (s, e) => {
                if (e.result.reason === this.SpeechSDK.ResultReason.RecognizedSpeech && e.result.text) {
                    // Emit ONLY the final recognized text (not accumulated)
                    if (this.onresult) {
                        const event = {
                            results: [{
                                transcript: e.result.text,
                                isFinal: true
                            }],
                            resultIndex: 0
                        };
                        this.onresult(event);
                    }
                } else if (e.result.reason === this.SpeechSDK.ResultReason.NoMatch) {
                    console.log('No speech could be recognized');
                }
            };
            
            this.recognizer.canceled = (s, e) => {
                console.error('Recognition canceled:', e);
                if (this.onerror) {
                    this.onerror({ error: e.errorDetails || 'canceled' });
                }
                this.stop();
            };
            
            this.recognizer.sessionStopped = (s, e) => {
                console.log('Session stopped');
                if (this.onend) {
                    this.onend();
                }
            };
            
            // Start continuous recognition
            this.recognizer.startContinuousRecognitionAsync(
                () => {
                    console.log('Azure recognition started');
                    this.isRecording = true;
                    if (this.onstart) {
                        this.onstart();
                    }
                },
                (err) => {
                    console.error('Failed to start recognition:', err);
                    if (this.onerror) {
                        this.onerror({ error: err });
                    }
                }
            );
            
        } catch (error) {
            console.error('Error starting Azure Speech Recognition:', error);
            if (this.onerror) {
                this.onerror({ error: error.message });
            }
        }
    }

    stop() {
        if (this.recognizer && this.isRecording) {
            this.recognizer.stopContinuousRecognitionAsync(
                () => {
                    console.log('Azure recognition stopped');
                    this.isRecording = false;
                    if (this.recognizer) {
                        this.recognizer.close();
                        this.recognizer = null;
                    }
                    if (this.onend) {
                        this.onend();
                    }
                },
                (err) => {
                    console.error('Error stopping recognition:', err);
                    this.isRecording = false;
                    if (this.recognizer) {
                        this.recognizer.close();
                        this.recognizer = null;
                    }
                }
            );
        }
    }

    abort() {
        this.stop();
    }
}

// Check if Azure Speech SDK is available
export function isAzureSpeechAvailable() {
    return typeof window.SpeechSDK !== 'undefined';
}

// Fallback to webkit if Azure not available
export function createSpeechRecognizer() {
    if (isAzureSpeechAvailable()) {
        console.log('Using Azure Speech Recognition');
        return new AzureSpeechRecognizer();
    } else if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        console.log('Using WebKit Speech Recognition (fallback)');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        return recognition;
    } else {
        throw new Error('No speech recognition available');
    }
}

// Text-to-Speech using Azure Speech SDK
export async function speakText(text, voiceName = 'en-US-JennyNeural') {
    return new Promise(async (resolve, reject) => {
        if (!isAzureSpeechAvailable()) {
            reject(new Error('Azure Speech SDK not available'));
            return;
        }

        try {
            const SpeechSDK = window.SpeechSDK;
            
            // Get token from backend (secure)
            const { token, region } = await getAzureSpeechToken();
            
            // Configure speech synthesis with token
            const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
                token,
                region
            );
            speechConfig.speechSynthesisVoiceName = voiceName;
            
            // Create synthesizer with default speaker output
            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
            
            // Speak the text
            synthesizer.speakTextAsync(
                text,
                result => {
                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        console.log('Speech synthesis completed');
                        synthesizer.close();
                        resolve();
                    } else {
                        console.error('Speech synthesis failed:', result.errorDetails);
                        synthesizer.close();
                        reject(new Error(result.errorDetails || 'Speech synthesis failed'));
                    }
                },
                error => {
                    console.error('Speech synthesis error:', error);
                    synthesizer.close();
                    reject(error);
                }
            );
        } catch (error) {
            console.error('Error in speakText:', error);
            reject(error);
        }
    });
}
