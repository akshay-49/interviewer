// Azure Speech SDK Wrapper for Interview Application
// Load SDK from CDN: Add to index.html:
// <script src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle.min.js"></script>

// Token cache to avoid fetching new token for every request
let cachedToken = null;
let tokenExpiry = null;

// Keep track of current synthesizer to stop previous audio
let currentSynthesizer = null;

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
            
            this.recognizer.recognizing = (s, e) => {
                console.log('Interim result:', e.result.text);
                if (this.onresult) {
                    this.onresult({
                        results: [{
                            transcript: e.result.text,
                            isFinal: false
                        }],
                        resultIndex: 0
                    });
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
            
            // Add timeout to auto-stop after max recording time (5 minutes)
            setTimeout(() => {
                if (this.isRecording) {
                    console.log('Max recording time reached, stopping...');
                    this.stop();
                }
            }, 5 * 60 * 1000);
        } catch (error) {
            console.error('Error starting recognition:', error);
            alert('Failed to start speech recognition: ' + error.message);
            if (this.onerror) {
                this.onerror({ error });
            }
        }
    }

    stop() {
        if (!this.recognizer) return;
        
        try {
            this.recognizer.stopContinuousRecognitionAsync(
                () => {
                    console.log('Recognition stopped');
                    this.isRecording = false;
                },
                (err) => {
                    console.error('Error stopping recognition:', err);
                    this.isRecording = false;
                }
            );
        } catch (error) {
            console.error('Error in stop():', error);
            this.isRecording = false;
        }
    }

    abort() {
        if (!this.recognizer) return;
        try {
            this.recognizer.stopContinuousRecognitionAsync();
            this.recognizer.close();
        } catch (error) {
            console.error('Error aborting:', error);
        }
        this.isRecording = false;
    }
}

// Fallback Web Speech API Recognizer
export class WebSpeechRecognizer {
    constructor() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            throw new Error('Web Speech API not supported');
        }
        
        this.recognizer = new SpeechRecognition();
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this.isRecording = false;
        
        this.recognizer.continuous = true;
        this.recognizer.interimResults = true;
        this.recognizer.language = 'en-US';
        
        this.recognizer.onstart = () => {
            this.isRecording = true;
            console.log('Web Speech API recognition started');
            if (this.onstart) this.onstart();
        };
        
        this.recognizer.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Emit final results
            if (finalTranscript) {
                if (this.onresult) {
                    this.onresult({
                        results: [{
                            transcript: finalTranscript.trim(),
                            isFinal: true
                        }],
                        resultIndex: 0
                    });
                }
            } else if (interimTranscript) {
                // Emit interim results
                if (this.onresult) {
                    this.onresult({
                        results: [{
                            transcript: interimTranscript,
                            isFinal: false
                        }],
                        resultIndex: 0
                    });
                }
            }
        };
        
        this.recognizer.onerror = (event) => {
            console.error('Web Speech API error:', event.error);
            if (this.onerror) {
                this.onerror({ error: event.error });
            }
        };
        
        this.recognizer.onend = () => {
            this.isRecording = false;
            console.log('Web Speech API recognition ended');
            if (this.onend) this.onend();
        };
    }
    
    start() {
        try {
            this.recognizer.start();
        } catch (error) {
            console.error('Error starting Web Speech API:', error);
            if (this.onerror) this.onerror({ error });
        }
    }
    
    stop() {
        try {
            this.recognizer.stop();
        } catch (error) {
            console.error('Error stopping Web Speech API:', error);
        }
    }
    
    abort() {
        try {
            this.recognizer.abort();
        } catch (error) {
            console.error('Error aborting Web Speech API:', error);
        }
    }
}

function isAzureSpeechAvailable() {
    return !!window.SpeechSDK;
}

// Create recognizer based on provider choice (no automatic fallback)
export function createSpeechRecognizer(forceWebSpeech = false) {
    if (forceWebSpeech) {
        // Web Speech API explicitly requested
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            console.log('Using Web Speech API (requested)');
            return new WebSpeechRecognizer();
        } else {
            throw new Error('Web Speech API not available in this browser');
        }
    } else {
        // Azure Speech requested - no fallback
        if (isAzureSpeechAvailable()) {
            console.log('Using Azure Speech Recognition');
            return new AzureSpeechRecognizer();
        } else {
            throw new Error('Azure Speech SDK not available. Please load the SDK or switch to Web Speech API.');
        }
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
            
            // Stop any currently playing audio
            if (currentSynthesizer) {
                console.log('Stopping previous audio playback');
                try {
                    currentSynthesizer.close();
                } catch (e) {
                    console.warn('Error closing previous synthesizer:', e);
                }
                currentSynthesizer = null;
            }
            
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
            currentSynthesizer = synthesizer;
            
            let audioPlaybackStarted = false;
            
            // Estimate audio duration: ~80ms per character (typical speech rate ~150 WPM = 2.5 words/sec)
            // Average word length is 5 chars, so: (text.length / 5 chars/word) / 2.5 words/sec * 1000 ms/sec = text.length * 80 ms
            // Add 500ms buffer to ensure audio finishes playing before transitioning
            const estimatedDurationMs = Math.max(text.length * 80, 1500); // At least 1.5 seconds to ensure audio plays
            console.log(`Estimated audio duration: ${estimatedDurationMs}ms for text length: ${text.length} chars, text: "${text.substring(0, 50)}..."`);
            
            // Speak the text
            synthesizer.speakTextAsync(
                text,
                result => {
                    if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                        audioPlaybackStarted = true;
                        console.log(`Speech synthesis completed, will wait ${estimatedDurationMs}ms before transitioning...`);
                        
                        // Wait for estimated audio duration to ensure audio has played
                        // Use a timeout to guarantee we wait long enough for playback to finish
                        const startTime = Date.now();
                        setTimeout(() => {
                            const elapsedTime = Date.now() - startTime;
                            console.log(`Audio playback timeout complete after ${elapsedTime}ms, resolving`);
                            synthesizer.close();
                            if (currentSynthesizer === synthesizer) {
                                currentSynthesizer = null;
                            }
                            resolve();
                        }, estimatedDurationMs);
                    } else {
                        console.error('Speech synthesis failed:', result.errorDetails);
                        synthesizer.close();
                        if (currentSynthesizer === synthesizer) {
                            currentSynthesizer = null;
                        }
                        reject(new Error(result.errorDetails || 'Speech synthesis failed'));
                    }
                },
                error => {
                    console.error('Speech synthesis error:', error);
                    synthesizer.close();
                    if (currentSynthesizer === synthesizer) {
                        currentSynthesizer = null;
                    }
                    reject(error);
                }
            );
        } catch (error) {
            console.error('Error in speakText:', error);
            reject(error);
        }
    });
}

export function stopSpeechPlayback() {
    if (currentSynthesizer) {
        try {
            currentSynthesizer.close();
        } catch (e) {
            console.warn('Error closing synthesizer:', e);
        }
        currentSynthesizer = null;
    }
}
