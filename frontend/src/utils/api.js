// API Client for Backend Communication
const API_BASE_URL = 'http://localhost:8000';

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

// Legacy function kept for backward compatibility (now uses Azure TTS)
export function playAudioFromBase64(base64Audio) {
    console.warn('playAudioFromBase64 is deprecated. Audio is now synthesized directly in frontend.');
    return Promise.resolve();
}

