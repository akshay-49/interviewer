import { stopSpeechPlayback } from './azureSpeech';

// API Client for Backend Communication
const API_BASE_URL = 'http://localhost:8000';

let currentBase64Audio = null;

export const api = {
    // Start a new interview session
    async startInterview(
        role,
        experience,
        roleDescription,
        persona = 'strict',
        recordingMode = 'audio',
        options = {}
    ) {
        try {
            const { userId, email, inviteCode } = options;
            const response = await fetch(`${API_BASE_URL}/interview/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role,
                    experience,
                    role_description: roleDescription || '',
                    persona,
                    recording_mode: recordingMode,
                    user_id: userId,
                    email,
                    invite_code: inviteCode
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
    async submitAnswer(
        sessionId,
        answer,
        skip = false,
        recordingBlobUrl = null,
        questionStartedAt = null,
        questionStartOffsetSeconds = null
    ) {
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
                    recording_blob_url: recordingBlobUrl,
                    question_started_at: questionStartedAt,
                    question_start_offset_seconds: questionStartOffsetSeconds
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
    async endSession(sessionId, questionWiseFeedback = []) {
        try {
            const response = await fetch(`${API_BASE_URL}/interview/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    question_wise_feedback: questionWiseFeedback
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
    },

    // Upload audio recording to blob storage
    async uploadRecording(sessionId, mediaBlob, questionNumber = 0, recordingMode = 'audio') {
        try {
            const formData = new FormData();
            // Generate descriptive filename with question number, mode, and timestamp
            const timestamp = Date.now();
            const extension = 'webm';
            // Format: q1_audio_1707123456.webm or q1_video_1707123456.webm
            const filename = `q${questionNumber}_${recordingMode}_${timestamp}.${extension}`;
            formData.append('file', mediaBlob, filename);

            const response = await fetch(`${API_BASE_URL}/recordings/upload?session_id=${sessionId}`, {
                method: 'POST',
                body: formData,
                credentials: 'include'  // Include httpOnly cookie for auth
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`[${recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] Recording saved: ${filename}`, data);
            return data.recording?.url || null;
        } catch (error) {
            console.error(`Failed to upload ${recordingMode} recording:`, error);
            return null;
        }
    },

    // Upload full interview recording to blob storage
    async uploadSessionRecording(sessionId, mediaBlob, recordingMode = 'audio') {
        try {
            const formData = new FormData();
            const timestamp = Date.now();
            const extension = 'webm';
            const filename = `session_${recordingMode}_${timestamp}.${extension}`;
            formData.append('file', mediaBlob, filename);

            const response = await fetch(`${API_BASE_URL}/recordings/upload-session?session_id=${sessionId}`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`[${recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] Session recording saved: ${filename}`, data);
            return data.recording?.url || null;
        } catch (error) {
            console.error(`Failed to upload ${recordingMode} session recording:`, error);
            return null;
        }
    },

    // Convert a direct blob URL to SAS URL if needed for access
    async getBlobUrlWithSAS(blobUrl) {
        if (!blobUrl) return null;
        
        // If URL already has SAS token (has ?), return as-is
        if (blobUrl.includes('?')) {
            return blobUrl;
        }
        
        try {
            // Extract path components from URL
            // Format: https://account.blob.core.windows.net/container/user_id/session_id/filename
            const url = new URL(blobUrl);
            const pathParts = url.pathname.split('/').filter(p => p);
            
            if (pathParts.length < 4) {
                console.warn('Invalid blob URL format:', blobUrl);
                return blobUrl;
            }
            
            const container = pathParts[0];
            const userId = pathParts[1];
            const sessionId = pathParts[2];
            const fileName = pathParts.slice(3).join('/');
            
            // Request SAS URL from backend
            const sasResponse = await fetch(
                `${API_BASE_URL}/recordings/sas-url?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}&file_name=${encodeURIComponent(fileName)}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                }
            );
            
            if (sasResponse.ok) {
                const data = await sasResponse.json();
                console.log('✅ Got SAS URL for blob playback');
                return data.sas_url;
            } else {
                console.warn('Failed to get SAS URL, falling back to direct URL:', sasResponse.status);
                return blobUrl;
            }
        } catch (error) {
            console.error('Error converting blob URL to SAS URL:', error);
            // Fallback to original URL - might fail but worth trying
            return blobUrl;
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

// Record audio using MediaRecorder API and return as blob
export async function recordAudio(maxDuration = 30000) {
    return new Promise(async (resolve, reject) => {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
            const audioChunks = [];

            // Collect audio data
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            // When recording stops, create blob and clean up
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
                
                console.log(`Recording complete: ${audioBlob.size} bytes`);
                resolve(audioBlob);
            };

            // Handle errors
            mediaRecorder.onerror = (event) => {
                stream.getTracks().forEach(track => track.stop());
                reject(new Error(`MediaRecorder error: ${event.error}`));
            };

            // Start recording
            console.log('Starting audio recording...');
            mediaRecorder.start();

            // Stop recording after max duration
            const timeout = setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, maxDuration);

            // Store timeout ID for cleanup if needed
            mediaRecorder._timeout = timeout;

        } catch (error) {
            console.error('Failed to start recording:', error);
            if (error.name === 'NotAllowedError') {
                reject(new Error('Microphone access denied. Please allow microphone access and try again.'));
            } else if (error.name === 'NotFoundError') {
                reject(new Error('No microphone found. Please check your audio device.'));
            } else {
                reject(error);
            }
        }
    });
}

export const historyApi = {
    // Save completed session results to Cosmos DB
    async saveSessionResults(sessionData) {
        try {
            const response = await fetch(`${API_BASE_URL}/session/save-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // Send httpOnly cookie
                body: JSON.stringify(sessionData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to save session results:', error);
            throw error;
        }
    },

    // Get user session history from Cosmos DB
    async getUserHistory(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/session/user-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // Send httpOnly cookie
                body: JSON.stringify({ user_id: userId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.sessions || [];
        } catch (error) {
            console.error('Failed to fetch user history:', error);
            return [];
        }
    },

    // Get all sessions for current user
    async getUserSessions(limit = 50) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/user-sessions?limit=${limit}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'  // Send httpOnly cookie
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

    // Save user profile to Cosmos DB
    async saveUserProfile(profileData) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/save-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profileData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to save user profile:', error);
            throw error;
        }
    },

    // Get user profile from Cosmos DB
    async getUserProfile(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/user/get-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.profile || null;
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            return null;
        }
    },

    // Get detailed session information
    async getSessionDetails(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/session/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'  // Send httpOnly cookie
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

    // Get detailed session information (Admin access - can view any user's session)
    async getSessionDetailsAdmin(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/admin/session/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'  // Send httpOnly cookie
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Session not found');
                }
                if (response.status === 403) {
                    throw new Error('Unauthorized - Admin access required');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch admin session details:', error);
            throw error;
        }
    },

    // Get session details via public endpoint (no auth required, for expired sessions)
    async getSessionDetailsPublic(sessionId) {
        try {
            const response = await fetch(`${API_BASE_URL}/history/session-public/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Session not found');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch public session details:', error);
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
                },
                credentials: 'include'  // Send httpOnly cookie
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
