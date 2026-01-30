// API Client for Backend Communication
const API_BASE_URL = 'http://localhost:8000';

export const api = {
    // Start a new interview session
    async startInterview(role, experience) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role,
                    experience
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to start interview:', error);
            throw error;
        }
    },

    // Submit an answer to the current question
    async submitAnswer(sessionId, answer) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    answer
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to submit answer:', error);
            throw error;
        }
    },

    // Health check
    async healthCheck() {
        try {
            const response = await fetch(`${API_BASE_URL}/`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return null;
        }
    }
};

// Utility to decode base64 audio and play it
export function playAudioFromBase64(base64Audio) {
    return new Promise((resolve, reject) => {
        try {
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.decodeAudioData(bytes.buffer, (audioBuffer) => {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start(0);
                
                source.onended = resolve;
            }, reject);
        } catch (error) {
            reject(error);
        }
    });
}

// Speech to text using Web Speech API
export async function recordAudio(maxDuration = 30000) {
    return new Promise((resolve, reject) => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        let transcript = '';
        let timeout;
        
        recognition.onstart = () => {
            console.log('Recording started...');
            timeout = setTimeout(() => {
                recognition.stop();
            }, maxDuration);
        };
        
        recognition.onresult = (event) => {
            transcript = event.results[0][0].transcript;
            console.log('Transcript:', transcript);
        };
        
        recognition.onerror = (event) => {
            clearTimeout(timeout);
            reject(new Error(`Speech recognition error: ${event.error}`));
        };
        
        recognition.onend = () => {
            clearTimeout(timeout);
            if (transcript) {
                resolve(transcript);
            } else {
                reject(new Error('No speech detected'));
            }
        };
        
        recognition.start();
    });
}
