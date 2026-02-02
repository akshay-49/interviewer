import { stopSpeechPlayback } from './azureSpeech';

// API Client for Backend Communication
const API_BASE_URL = 'http://localhost:8000';

let currentBase64Audio = null;

export const api = {
    // Start a new interview session
    async startInterview(role, experience, roleDescription, persona = 'strict') {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role,
                    experience,
                    role_description: roleDescription || '',
                    persona
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
    async submitAnswer(sessionId, answer, skip = false, recordingBlobUrl = null) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    answer,
                    skip,
                    recording_blob_url: recordingBlobUrl
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

    // End interview session early
    async endSession(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to end session:', error);
            throw error;
        }
    },

    // Proceed after feedback (coach persona)
    async continue(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/continue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to proceed after feedback:', error);
            throw error;
        }
    },

    // Get a hint for the current question
    async getHint(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/hint`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get hint:', error);
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

// Utility to speak text using Azure TTS (replaces base64 audio playback)
export async function speakText(text) {
    try {
        // Import dynamically to avoid circular dependencies
        const { speakText: azureSpeakText } = await import('./azureSpeech.js');
        return await azureSpeakText(text);
    } catch (error) {
        console.error('Failed to speak text:', error);
        throw error;
    }
}

// Play base64 audio returned by backend (hint audio, etc.)
export function playAudioFromBase64(base64Audio) {
    return new Promise((resolve, reject) => {
        try {
            const tryPlay = (src) => {
                const audio = new Audio(src);
                currentBase64Audio = audio;
                audio.onended = () => resolve();
                audio.onerror = (e) => reject(e);
                audio.play().catch(reject);
            };

            if (base64Audio.startsWith('data:')) {
                tryPlay(base64Audio);
                return;
            }

            // Try wav first, then mp3 if it fails
            const wavSrc = `data:audio/wav;base64,${base64Audio}`;
            const mp3Src = `data:audio/mpeg;base64,${base64Audio}`;

            const audio = new Audio(wavSrc);
            currentBase64Audio = audio;
            audio.onended = () => resolve();
            audio.onerror = () => {
                tryPlay(mp3Src);
            };
            audio.play().catch(() => {
                tryPlay(mp3Src);
            });
        } catch (error) {
            console.error('Failed to play base64 audio:', error);
            reject(error);
        }
    });
}

// Stop any currently playing audio (base64 or Azure TTS)
export function stopAudioPlayback() {
    if (currentBase64Audio) {
        try {
            currentBase64Audio.pause();
            currentBase64Audio.currentTime = 0;
        } catch (e) {
            console.warn('Error stopping base64 audio:', e);
        }
        currentBase64Audio = null;
    }
    stopSpeechPlayback();
}

// History/Sessions API
export const historyApi = {
    // Get all sessions for current user
    async getUserSessions(limit = 50) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/user-sessions?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized - please login');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch user sessions:', error);
            throw error;
        }
    },

    // Get detailed session information
    async getSessionDetails(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/session/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Session not found');
                }
                if (response.status === 403) {
                    throw new Error('Unauthorized access to session');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch session details:', error);
            throw error;
        }
    },

    // Delete a session
    async deleteSession(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/session/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Session not found');
                }
                if (response.status === 403) {
                    throw new Error('Unauthorized to delete session');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to delete session:', error);
            throw error;
        }
    }
};
