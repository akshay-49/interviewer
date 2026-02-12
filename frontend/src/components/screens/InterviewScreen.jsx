import React, { useEffect, useState, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { api, speakText, playAudioFromBase64, recordAudio } from '../../utils/api';
import { createSpeechRecognizer } from '../../utils/azureSpeech';

const InterviewScreen = () => {
    const { interview, updateInterview, navigateTo, theme, toggleTheme, registerStopRecordingCallback, currentParams, user } = useInterview();
    const [panelState, setPanelState] = useState('loading'); // 'loading', 'speaking', 'listening', 'evaluating', 'skipping', 'coach-feedback'
    const [transcript, setTranscript] = useState('');
    const [endingSession, setEndingSession] = useState(false);
    const [hint, setHint] = useState(null);
    const [hintLoading, setHintLoading] = useState(false);
    const [hintError, setHintError] = useState(null);
    const [isLoadingResults, setIsLoadingResults] = useState(false);
    const [questionWiseFeedback, setQuestionWiseFeedback] = useState([]);

    const mergeFeedback = (prev, entry) => {
        if (!entry) return prev;
        const exists = prev.some(item => item.questionNumber === entry.questionNumber);
        return exists ? prev : [...prev, entry];
    };

    const syncQuestionWiseFeedback = (entry) => {
        const merged = mergeFeedback(questionWiseFeedback, entry);
        if (merged !== questionWiseFeedback) {
            setQuestionWiseFeedback(merged);
            updateInterview({ questionWiseFeedback: merged });
        }
        return merged;
    };
    const [isRecordingLocal, setIsRecordingLocal] = useState(false); // Local tracking for recording state
    const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-click on submit/skip/proceed
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingPreviewRef = useRef(null); // Video preview during recording
    // Speech recognition refs
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const interimTranscriptRef = useRef('');
    const audioPlayedRef = useRef(false);
    const panelStateRef = useRef(panelState);
    const allowRecordingRef = useRef(false);

    // Speak question text when component mounts or when new question arrives
    useEffect(() => {
        if (interview.questionText && !interview.audioPlaying && !audioPlayedRef.current) {
            audioPlayedRef.current = true;
            updateInterview({ audioPlaying: true });
            setPanelState('speaking');
            allowRecordingRef.current = false; // Disable recording while speaking

            speakText(interview.questionText)
                .then(() => {
                    updateInterview({ audioPlaying: false, questionText: null });
                    allowRecordingRef.current = true;
                    // Question finished -> transition to listening (recording starts via panelState effect)
                    setPanelState('listening');
                })
                .catch(() => {
                    updateInterview({ audioPlaying: false });
                    allowRecordingRef.current = true;
                    setPanelState('listening');
                });
        }
    }, [interview.questionText]);

    const stopAllRecording = () => {
        console.log('stopAllRecording called');
        allowRecordingRef.current = false;
        
        // Stop speech recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                console.log('Speech recognition stopped');
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
            recognitionRef.current = null;
        }
        
        // Stop media recorder if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            try {
                mediaRecorderRef.current.stop();
                console.log('MediaRecorder stopped');
            } catch (error) {
                console.error('Error stopping mediaRecorder:', error);
            }
            mediaRecorderRef.current = null;
        }
        
        // Stop all audio tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        // Cleanup video preview
        if (recordingPreviewRef.current) {
            recordingPreviewRef.current.srcObject = null;
        }
        
        audioChunksRef.current = [];
        setIsRecordingLocal(false);
        updateInterview({ isRecording: false });
    };

    // Keep panelStateRef in sync with panelState
    useEffect(() => {
        panelStateRef.current = panelState;
    }, [panelState]);

    // Start/stop recording strictly based on listening state
    useEffect(() => {
        let isMounted = true;
        
        const handleRecording = async () => {
            if (panelState === 'listening') {
                try {
                    await startRecording();
                } catch (error) {
                    console.error('Error in startRecording:', error);
                    // Don't change state here - let the UI handle the error
                }
            } else {
                stopAllRecording();
            }
        };

        handleRecording();

        return () => {
            isMounted = false;
        };
    }, [panelState]);

    // Cleanup: stop recording when component unmounts
    useEffect(() => {
        // Register the callback to stop recording when navigating away
        if (registerStopRecordingCallback) {
            registerStopRecordingCallback(() => {
                stopAllRecording();
            });
        }

        return () => {
            console.log('InterviewScreen unmounting, stopping recording');
            stopAllRecording();
        };
    }, []); // Empty dependencies - run only on mount/unmount

    const startRecording = async () => {
        if (panelStateRef.current !== 'listening') {
            console.log('Not in listening state, skipping startRecording');
            return;
        }

        // Prevent starting if already recording
        if (isRecordingLocal && mediaRecorderRef.current) {
            console.log('Already recording, skipping');
            return;
        }

        try {
            allowRecordingRef.current = true;
            console.log('Requesting media access and starting recording + STT...');
            console.log('Recording mode:', interview.recordingMode);
            
            // Request microphone (and camera if video mode)
            const isVideoMode = interview.recordingMode === 'video';
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };
            
            if (isVideoMode) {
                // Use simple video constraints - just ask for any video
                // Avoid strict constraints that might cause stream to stop
                constraints.video = {
                    facingMode: 'user'
                };
                console.log('Video mode: requesting camera and microphone with basic constraints');
            } else {
                console.log('Audio mode: requesting microphone only');
            }
            
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log(`✓ Media access granted (${isVideoMode ? 'video+audio' : 'audio only'})`);
            } catch (error) {
                console.error(`✗ Failed to get media stream:`, error.name, error.message);
                if (isVideoMode && error.name === 'NotFoundError') {
                    console.warn('[📹 VIDEO] Camera not found, falling back to audio only');
                    // Fallback to audio only
                    const audioConstraints = { audio: constraints.audio };
                    stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                    updateInterview({ recordingMode: 'audio' });
                } else {
                    throw error;
                }
            }

            console.log('Media access granted');
            mediaStreamRef.current = stream;
            audioChunksRef.current = [];
            
            // Monitor video track status in video mode
            if (isVideoMode) {
                const videoTrack = stream.getVideoTracks()[0];
                const audioTrack = stream.getAudioTracks()[0];
                
                if (videoTrack) {
                    console.log('[📹 VIDEO] Video track ready, label:', videoTrack.label, 'state:', videoTrack.readyState);
                    
                    videoTrack.onended = () => {
                        console.warn('[📹 VIDEO] ⚠️ Video track ended unexpectedly!');
                        setIsRecordingLocal(false);
                        setPanelState('listening');
                    };
                    
                    // Monitor track settings changes
                    videoTrack.onmute = () => {
                        console.warn('[📹 VIDEO] Video track muted');
                    };
                    videoTrack.onunmute = () => {
                        console.log('[📹 VIDEO] Video track unmuted');
                    };
                }
                
                if (audioTrack) {
                    console.log('[🎤 AUDIO] Audio track ready, label:', audioTrack.label, 'state:', audioTrack.readyState);
                }
            }
            
            // Attach video preview if in video mode
            if (isVideoMode && recordingPreviewRef.current) {
                recordingPreviewRef.current.srcObject = stream;
                console.log('[📹 VIDEO] Preview stream attached');
            }
            finalTranscriptRef.current = '';
            interimTranscriptRef.current = '';

            // ======================
            // 1. START MEDIA RECORDING (AUDIO OR VIDEO)
            // ======================
            let mimeType;
            
            if (isVideoMode) {
                // Video mode: prefer webm with VP9 or VP8 + Opus
                const videoMimeTypes = [
                    'video/webm;codecs=vp9,opus',
                    'video/webm;codecs=vp8,opus',
                    'video/webm'
                ];
                
                for (const type of videoMimeTypes) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        mimeType = type;
                        break;
                    }
                }
                
                if (!mimeType) {
                    console.warn('No supported video MIME types, using default');
                    mimeType = '';
                }
                console.log('Video recording MIME type:', mimeType || 'default');
            } else {
                // Audio mode: prefer webm with opus
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    console.warn('audio/webm not supported, falling back to audio/mp4');
                    mimeType = 'audio/mp4';
                }
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    console.warn('audio/mp4 not supported, using default');
                    mimeType = '';
                }
                console.log('Audio recording MIME type:', mimeType || 'default');
            }

            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            console.log('MediaRecorder created');

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log(`${isVideoMode ? 'Video' : 'Audio'} chunk received:`, event.data.size);
                }
            };

            mediaRecorder.onstop = () => {
                console.log(`${isVideoMode ? 'Video' : 'Audio'} recording stopped, chunks:`, audioChunksRef.current.length);
                // Don't stop tracks here - let stopAllRecording handle cleanup
                // This prevents the video preview from stopping prematurely
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                // Don't stop tracks immediately - let error handler clean up properly
                updateInterview({ isRecording: false });
                setIsRecordingLocal(false);
            };

            mediaRecorderRef.current = mediaRecorder;
            console.log(`Starting ${isVideoMode ? 'video' : 'audio'} recording...`);
            mediaRecorder.start();

            // Auto-stop after 30 seconds (max answer duration)
            setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    console.log('Auto-stopping recording after 30s timeout');
                    mediaRecorderRef.current.stop();
                }
            }, 30000);

            // ======================
            // 2. START SPEECH RECOGNITION (STT)
            // ======================
            const recognition = createSpeechRecognizer(false); // Use Azure Speech API (false = Azure)
            
            recognition.onstart = () => {
                console.log('Speech recognition started');
                setIsRecordingLocal(true);
                updateInterview({ isRecording: true });
            };

            recognition.onresult = (event) => {
                let interim = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcriptPiece = result.transcript || result[0]?.transcript || '';
                    const isFinal = result.isFinal !== undefined ? result.isFinal : result[0]?.isFinal;
                    
                    if (isFinal) {
                        finalTranscriptRef.current += transcriptPiece + ' ';
                    } else {
                        interim += transcriptPiece;
                    }
                }
                
                const combined = finalTranscriptRef.current + interim;
                interimTranscriptRef.current = interim;
                setTranscript(combined);
                console.log('Transcript updated:', combined);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed') {
                    alert('Microphone access denied for speech recognition.');
                } else if (event.error === 'network') {
                    alert('Network error in speech recognition. Check your connection.');
                }
            };

            recognition.onend = () => {
                console.log('Speech recognition ended');
                console.log('Final transcript:', finalTranscriptRef.current);
            };

            recognitionRef.current = recognition;
            console.log('Starting speech recognition...');
            recognition.start();

        } catch (error) {
            console.error('Error starting recording/STT:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            
            setIsRecordingLocal(false);
            updateInterview({ isRecording: false });
            
            if (error.name === 'NotAllowedError') {
                alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please check your audio device is connected.');
            } else if (error.name === 'NotReadableError') {
                alert('Microphone is already in use by another application. Please close other apps and try again.');
            } else {
                alert('Failed to start recording/STT: ' + error.message);
            }
        }
    };

    const handleDoneSpeaking = async () => {
        console.log('User clicked Done Speaking, stopping recording/STT and uploading');
        allowRecordingRef.current = false;

        // Stop speech recognition (synchronous)
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                console.log('Speech recognition stopped');
            } catch (err) {
                console.error('Error stopping speech recognition:', err);
            }
            recognitionRef.current = null;
        }

        // Stop media recorder and WAIT for it to finish collecting audio chunks
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            const mediaRecorder = mediaRecorderRef.current;
            
            // Wait for the 'stop' event which fires after all chunks are collected
            return new Promise((resolve) => {
                const onStopHandler = async () => {
                    mediaRecorder.removeEventListener('stop', onStopHandler);
                    console.log(`MediaRecorder stopped, collected ${audioChunksRef.current.length} chunks`);
                    
                    // Now proceed with the submission (chunks are ready)
                    await proceedWithSubmission();
                    resolve();
                };
                
                mediaRecorder.addEventListener('stop', onStopHandler);
                
                try {
                    console.log('Stopping MediaRecorder...');
                    mediaRecorder.stop();
                } catch (err) {
                    console.error('Error stopping mediaRecorder:', err);
                    // Run handler anyway to proceed
                    onStopHandler();
                }
            });
        } else {
            // Not recording, proceed immediately
            await proceedWithSubmission();
        }

        async function proceedWithSubmission() {
            // Stop all audio tracks
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                mediaStreamRef.current = null;
            }

            mediaRecorderRef.current = null;

            // Get transcript from STT
            const transcriptToSend = (finalTranscriptRef.current + interimTranscriptRef.current).trim();
            console.log('Transcript to send:', transcriptToSend);

            // Create media blob from chunks (audio or video depending on mode)
            let mediaBlob = null;
            if (audioChunksRef.current.length > 0) {
                // Determine MIME type based on recording mode
                const mimeType = interview.recordingMode === 'video' ? 'video/webm' : 'audio/webm';
                mediaBlob = new Blob(audioChunksRef.current, { type: mimeType });
                const sizeKB = (mediaBlob.size / 1024).toFixed(2);
                console.log(`[${interview.recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] Blob created: ${sizeKB} KB (${mimeType})`);
            } else {
                console.warn('No media chunks collected');
            }
            
            audioChunksRef.current = [];
            setIsRecordingLocal(false);

            // Upload recording to blob storage if we have media
            console.log(`[${interview.recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] Uploading to blob storage...`);
            let recordingBlobUrl = null;
            if (mediaBlob && mediaBlob.size > 0) {
                try {
                    recordingBlobUrl = await api.uploadRecording(interview.sessionId, mediaBlob, interview.questionNumber, interview.recordingMode);
                    console.log(`[${interview.recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] ✓ Uploaded successfully! Blob URL:`, recordingBlobUrl);
                } catch (error) {
                    console.error(`[${interview.recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] ✗ Upload failed:`, error);
                    // Don't fail - proceed with transcript anyway
                }
            }

            // Submit answer with BOTH transcript AND recording blob URL
            console.log(`[${interview.recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] Submitting answer for Q${interview.questionNumber}`);
            submitAnswer(transcriptToSend, false, recordingBlobUrl);
        }
    };

    const handleGetHint = async () => {
        if (!interview.sessionId) return;
        setHintLoading(true);
        setHintError(null);
        try {
            const result = await api.getHint(interview.sessionId);
            setHint(result.hint || 'No hint available');
            const newHintsUsed = (interview.hintsUsed || 0) + 1;
            console.log('Hints used updated:', newHintsUsed);
            updateInterview({ hintsUsed: newHintsUsed });
            if (result.audio) {
                try {
                    await playAudioFromBase64(result.audio);
                } catch (audioError) {
                    console.warn('Hint audio playback failed, falling back to TTS:', audioError);
                    if (result.hint) {
                        await speakText(result.hint);
                    }
                }
            } else if (result.hint) {
                await speakText(result.hint);
            }
        } catch (error) {
            console.error('Failed to get hint:', error);
            setHintError('Could not fetch hint.');
        } finally {
            setHintLoading(false);
        }
    };

    const submitAnswer = async (answerText, isSkip = false, recordingBlobUrl = null) => {
        if (isSubmitting) {
            console.log('Already submitting, ignoring click');
            return;
        }
        
        console.log('Submitting answer:', answerText, 'isSkip:', isSkip, 'recordingBlobUrl:', recordingBlobUrl);
        setIsSubmitting(true);
        
        // Check if this is the last question (max 5 questions)
        const isLastQuestion = interview.questionNumber >= 5;
        if (isSkip) {
            setPanelState('skipping');
        } else {
            setPanelState('evaluating');
            // Show evaluating animation for 2 seconds, then switch to generating
            setTimeout(() => {
                setIsLoadingResults(isLastQuestion);
                setPanelState('generating');
            }, 2000);
        }
        setTranscript('');

        try {
            const result = await api.submitAnswer(interview.sessionId, answerText, isSkip, recordingBlobUrl);
            console.log('Answer submitted, response:', result);

            // Store the answer
            const updatedAnswers = [...interview.answers, {
                question: interview.currentQuestion,
                answer: answerText
            }];

            // Build feedback entry if evaluation exists (works for all personas)
            const feedbackEntry = result.evaluation ? {
                questionNumber: interview.questionNumber,
                question: interview.currentQuestion,
                answer: answerText,
                score: result.evaluation.score,
                topic: result.evaluation.topic,
                strengths: result.evaluation.strengths || [],
                weaknesses: result.evaluation.weaknesses || [],
                feedback: result.feedback || '',
                recordingUrl: recordingBlobUrl  // Track recording for this question
            } : null;

            let currentFeedback = questionWiseFeedback;
            if (feedbackEntry) {
                console.log('Captured evaluation data:', feedbackEntry);
                console.log('syncQuestionWiseFeedback called with feedbackEntry');
                currentFeedback = syncQuestionWiseFeedback(feedbackEntry);
                console.log('After syncQuestionWiseFeedback, currentFeedback length:', currentFeedback?.length);
                console.log('After syncQuestionWiseFeedback, currentFeedback content:', currentFeedback);
            }

            if (!result.final && result.step === 'feedback') {
                // Coach persona: show feedback screen and wait for proceed
                console.log('Coach feedback step');
                console.log('Result:', JSON.stringify(result, null, 2));
                console.log('Result.evaluation:', result.evaluation);
                audioPlayedRef.current = false;
                setHint(null); // Clear hint for next question
                
                if (!result.evaluation) {
                    console.warn('No evaluation data in result');
                }
                
                // Immediately show feedback panel and start speech playback without waiting
                setPanelState('coach-feedback');
                updateInterview({
                    feedbackText: result.feedback || '',
                    currentQuestion: result.question || interview.currentQuestion,
                    questionText: result.question || interview.currentQuestion,
                    audioPlaying: true,
                    answers: updatedAnswers,
                });
                // Fire-and-forget speech synthesis; don't block UI
                speakText(result.feedback || '')
                    .then(() => {
                        updateInterview({ audioPlaying: false });
                    })
                    .catch((e) => {
                        console.warn('Failed to speak feedback', e);
                        updateInterview({ audioPlaying: false });
                    });
            } else if (!result.final && result.question) {
                // Next question
                console.log('Getting next question...');
                console.log('Result:', JSON.stringify(result, null, 2));
                console.log('Result.evaluation:', result.evaluation);
                audioPlayedRef.current = false; // Reset for next question
                setHint(null); // Clear hint for next question
                
                // Reset audio chunks and transcript refs for new question
                audioChunksRef.current = [];
                finalTranscriptRef.current = '';
                interimTranscriptRef.current = '';
                allowRecordingRef.current = false; // Disable recording until speech finishes
                setTranscript('');
                
                // Stop speech recognition
                if (recognitionRef.current) {
                    try {
                        recognitionRef.current.stop();
                    } catch (e) {
                        console.log('Speech recognition already stopped');
                    }
                    recognitionRef.current = null;
                }
                
                // Stop media recorder and cleanup audio
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    try {
                        mediaRecorderRef.current.stop();
                    } catch (e) {
                        console.log('MediaRecorder already stopped');
                    }
                }
                mediaRecorderRef.current = null;
                
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(track => track.stop());
                    mediaStreamRef.current = null;
                }
                
                updateInterview({
                    currentQuestion: result.question,
                    questionText: result.question,
                    questionNumber: interview.questionNumber + 1,
                    audioPlaying: false,
                    answers: updatedAnswers,
                });
                // Don't set panelState here - let the effect handle the flow
            } else {
                // Interview complete
                console.log('Interview complete');
                console.log('Result:', JSON.stringify(result, null, 2));
                console.log('Final feedback state at completion:', currentFeedback);
                console.log('currentFeedback length at completion:', currentFeedback?.length);
                console.log('hintsUsed:', interview.hintsUsed);
                console.log('questionsSkipped:', interview.questionsSkipped);
                updateInterview({ 
                    summary: result.summary, 
                    answers: updatedAnswers,
                    questionWiseFeedback: currentFeedback,
                });
                console.log('Updated interview context with questionWiseFeedback, array length:', currentFeedback?.length);
                navigateTo('results');
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
            alert('Failed to submit answer. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const proceedAfterFeedback = async () => {
        if (isSubmitting) {
            console.log('Already processing, ignoring click');
            return;
        }
        
        setIsSubmitting(true);
        try {
            // Stop any active recording immediately
            stopAllRecording();
            
            const result = await api.continue(interview.sessionId);
            console.log('Proceeded after feedback, response:', result);
            // Reset refs BEFORE updating state to ensure effect triggers correctly
            audioPlayedRef.current = false;
            setHint(null); // Clear hint for next question
            updateInterview({
                feedbackText: null,
                currentQuestion: result.question,
                questionText: result.question,
                questionNumber: interview.questionNumber + 1,
                audioPlaying: false,
            });
            // Don't set panelState here - let the effect handle the speaking->listening flow
        } catch (error) {
            console.error('Error proceeding after feedback:', error);
            alert('Failed to proceed to next question.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const tryAgainSameQuestion = () => {
        // Replay same question and re-enter listening with typing/mic
        audioPlayedRef.current = false;
        const questionToSpeak = interview.currentQuestion;

        // Clear feedback state
        updateInterview({
            feedbackText: null,
            audioPlaying: !!questionToSpeak,
        });

        const startListen = () => {
            setPanelState('listening');
            setTimeout(() => startRecording(), 200);
        };

        if (questionToSpeak) {
            setPanelState('speaking');
            speakText(questionToSpeak)
                .catch((e) => console.warn('Failed to speak retry question', e))
                .finally(() => {
                    updateInterview({ audioPlaying: false });
                    startListen();
                });
        } else {
            startListen();
        }
    };

    const progressPercentage = interview.totalQuestions > 0 
        ? (interview.questionNumber / interview.totalQuestions) * 100 
        : 0;

    const skipQuestion = async () => {
        if (isSubmitting) {
            console.log('Already processing, ignoring skip click');
            return;
        }
        
        console.log('Skipping question');
        
        // Stop speech recognition
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        
        // Stop recording if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        // Cleanup audio stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        audioChunksRef.current = [];
        finalTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        
        setTranscript('');
        const newQuestionsSkipped = (interview.questionsSkipped || 0) + 1;
        console.log('Questions skipped updated:', newQuestionsSkipped);
        updateInterview({ questionsSkipped: newQuestionsSkipped });
        // Submit empty answer to skip with skip flag
        await submitAnswer('', true);
    };

    const endSession = () => {
        console.log('Ending session early');
        console.log('Current questionWiseFeedback:', questionWiseFeedback);
        setEndingSession(true);
        
        // Stop speech recognition
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        
        // Stop recording if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        // Cleanup audio stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        // Call backend to end session and get feedback
        api.endSession(interview.sessionId, questionWiseFeedback)
            .then((result) => {
                console.log('Session ended, response:', result);
                if (result.final && result.summary) {
                    updateInterview({ 
                        summary: result.summary,
                        questionWiseFeedback: questionWiseFeedback
                    });
                }
                navigateTo('results');
            })
            .catch((error) => {
                console.error('Error ending session:', error);
                setEndingSession(false);
                alert('Failed to end session. Please try again.');
            });
    };

    const handleLogoClick = () => {
        const confirmed = window.confirm('Are you sure you want to exit the interview? Your progress will not be saved.');
        if (confirmed) {
            // End recording if active
            stopAllRecording();
            
            // Attempt to notify backend but don't wait for response
            api.endSession(interview.sessionId).catch(err => console.log('Session cleanup:', err));
            
            // Reset interview state and go home
            updateInterview({
                sessionId: null,
                role: null,
                roleDisplay: '',
                persona: 'strict',
                experience: null,
                currentQuestion: null,
                questionText: null,
                feedbackText: null,
                audioPlaying: false,
                isRecording: false,
                questionNumber: 0,
                answers: [],
                summary: null,
            });
            navigateTo('welcome');
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-[#121617] dark:text-[#f0f0f0] font-display h-full flex flex-col transition-colors duration-300">
            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-10 relative">
                {panelState === 'coach-feedback' && (
                    <div className="w-full max-w-5xl">
                        <div className="flex flex-col items-center w-full text-center mb-8">
                            <div className="flex items-center justify-between w-full mb-4">
                                <div></div>
                                <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 dark:bg-primary/20 border border-primary/10 dark:border-primary/30">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </span>
                                    <span className="text-xs font-bold uppercase tracking-widest text-primary dark:text-teal-300">Feedback Analysis</span>
                                </div>
                                <button 
                                    onClick={endSession}
                                    disabled={endingSession}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="End the interview session"
                                >
                                    <span className="material-symbols-outlined">{endingSession ? 'pending' : 'exit_to_app'}</span>
                                </button>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-bold leading-tight mb-2">Here is my feedback on your answer.</h3>
                            <p className="text-sm md:text-base text-gray-600 dark:text-gray-300">Question: {interview.currentQuestion || 'Question unavailable'}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
                            {/* Feedback Overview */}
                            <div className="group relative bg-white dark:bg-[#2C3035] rounded-xl p-6 md:p-8 shadow-soft hover:shadow-lg transition-all border-t-4 border-teal-600/80 md:col-span-2">
                                <div className="absolute top-4 right-4 text-teal-600 opacity-20 group-hover:opacity-100 transition-opacity">
                                    <span className="material-symbols-outlined text-3xl">comment</span>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-teal-600/10 text-teal-700 dark:text-teal-300">
                                        <span className="material-symbols-outlined">feedback</span>
                                    </div>
                                    <h4 className="text-lg font-bold">Feedback</h4>
                                </div>
                                <p className="text-sm md:text-base text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                    {interview.feedbackText || 'Feedback will appear here...'}
                                </p>
                            </div>
                        </div>

                        {/* Bottom actions */}
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full">
                            <button 
                                onClick={tryAgainSameQuestion} 
                                disabled={isSubmitting}
                                className={`group relative flex items-center justify-center gap-3 border-2 text-sm md:text-lg font-bold px-6 py-3 rounded-full shadow-lg transition-all min-w-[200px] w-full md:w-auto ${
                                    isSubmitting 
                                        ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                                        : 'bg-white dark:bg-transparent border-primary hover:bg-primary/5 text-primary dark:text-teal-300 hover:shadow-xl'
                                }`}
                            >
                                <span className="material-symbols-outlined text-xl md:text-2xl">mic</span>
                                <span>Try Again</span>
                            </button>
                            <button 
                                onClick={proceedAfterFeedback} 
                                disabled={isSubmitting}
                                className={`group relative flex items-center justify-center gap-3 text-sm md:text-lg font-bold px-8 py-3 rounded-full shadow-lg transition-all min-w-[220px] w-full md:w-auto ${
                                    isSubmitting
                                        ? 'bg-gray-400 dark:bg-gray-700 text-gray-200 cursor-not-allowed opacity-50'
                                        : 'bg-primary hover:bg-primary-hover text-white hover:shadow-xl'
                                }`}
                            >
                                <span>{isSubmitting ? 'Processing...' : 'Next Question'}</span>
                                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                )}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                {/* Main Card */}
                <div className="w-full max-w-4xl rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden flex flex-col md:flex-row min-h-[450px] max-h-[calc(100vh-200px)] bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800">
                    {/* Left Panel: Question */}
                    <div className="flex-1 p-4 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e2126] overflow-y-auto">
                        {/* Progress Header */}
                        <div className="flex flex-col gap-2 mb-4">
                            <div className="flex justify-between items-center">
                                <span className="text-primary font-bold text-xs uppercase tracking-wider">
                                    Q{interview.questionNumber || 0}/{interview.totalQuestions || 5}
                                </span>
                                <span className="text-gray-400 dark:text-gray-500 text-xs font-semibold">
                                    {interview.roleDisplay || 'Technical'}
                                </span>
                            </div>
                            <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{width: `${progressPercentage}%`}}></div>
                            </div>
                        </div>

                        {/* The Question */}
                        <div className="flex-grow flex flex-col justify-center min-h-0 overflow-y-auto">
                            <h1 className="text-lg md:text-xl lg:text-2xl font-bold leading-snug tracking-tight text-gray-900 dark:text-gray-50 overflow-y-auto max-h-[300px] pr-2">
                                {panelState === 'generating'
                                    ? (isLoadingResults ? 'Loading results...' : 'Generating next question...')
                                    : (interview.currentQuestion || 'Loading question...')}
                            </h1>
                            <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm md:text-base leading-relaxed">
                                {transcript || (panelState === 'listening' ? 'Start speaking...' : '')}
                            </p>
                        </div>

                        {/* Hint/Skip Controls */}
                        <div className="mt-3 flex gap-3 pt-2 justify-between items-center">
                            <div className="flex gap-3">
                                <button 
                                    onClick={handleGetHint}
                                    disabled={hintLoading || panelState === 'speaking' || isSubmitting}
                                    className={`text-sm font-semibold flex items-center gap-2 transition-all ${
                                        hintLoading || panelState === 'speaking' || isSubmitting
                                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                                            : 'text-gray-400 dark:text-gray-500 hover:text-primary cursor-pointer'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                    {hintLoading ? 'Getting hint...' : 'Get a hint'}
                                </button>
                                <button 
                                    onClick={skipQuestion} 
                                    disabled={panelState === 'speaking' || isSubmitting}
                                    className={`text-sm font-semibold flex items-center gap-2 transition-all ${
                                        panelState === 'speaking' || isSubmitting
                                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50' 
                                            : 'text-gray-400 dark:text-gray-500 hover:text-primary cursor-pointer'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">skip_next</span>
                                    Skip question
                                </button>
                            </div>
                            <button 
                                onClick={endSession}
                                disabled={endingSession}
                                className="text-sm font-semibold flex items-center gap-2 px-3 py-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="End the interview session"
                            >
                                <span className="material-symbols-outlined text-[18px]">exit_to_app</span>
                                {endingSession ? 'Ending...' : 'End session'}
                            </button>
                        </div>

                        {hint && (
                            <div className="mt-4 p-3 bg-primary/5 dark:bg-primary/10 rounded-lg text-sm text-gray-800 dark:text-gray-100 border border-primary/10">
                                <strong className="text-primary">Hint:</strong> {hint}
                            </div>
                        )}
                        {hintError && (
                            <div className="mt-4 text-sm text-red-500">{hintError}</div>
                        )}
                    </div>

                    {/* Right Panel: Status Panel */}
                    <div className="w-full md:w-[280px] bg-gray-50 dark:bg-[#1a1d21] p-4 md:p-6 flex flex-col items-center justify-center text-center relative overflow-y-auto">
                        {panelState === 'loading' && (
                            <LoadingPanel />
                        )}
                        {panelState === 'speaking' && (
                            <SpeakingPanel />
                        )}
                        {panelState === 'listening' && (
                            <ListeningPanel 
                                onDone={handleDoneSpeaking} 
                                transcript={transcript} 
                                setTranscript={setTranscript}
                                recordingMode={interview.recordingMode}
                                videoPreviewRef={recordingPreviewRef}
                            />
                        )}
                        {panelState === 'evaluating' && (
                            <EvaluatingPanel />
                        )}
                        {panelState === 'generating' && (
                            <GeneratingPanel isLoadingResults={isLoadingResults} />
                        )}
                        {panelState === 'skipping' && (
                            <SkippingPanel />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

// Loading Panel Component
const LoadingPanel = () => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-primary">hourglass_empty</span>
                </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Getting Ready...</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading your interview</p>
        </div>
    </>
);

// Speaking Panel Component
const SpeakingPanel = () => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div aria-hidden="true" className="h-32 flex items-center justify-center gap-2 mb-6">
                <div className="w-2.5 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-12 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2.5 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-20 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2.5 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-16 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style={{animationDelay: '0.3s'}}></div>
                <div className="w-2.5 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-24 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2.5 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-10 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style={{animationDelay: '0.4s'}}></div>
            </div>
            <p className="text-primary font-bold text-lg animate-pulse">Interviewer is speaking...</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Please wait until they finish.</p>
        </div>
        <div className="mt-auto pt-8 w-full flex flex-col items-center gap-4">
            <div className="relative group cursor-not-allowed opacity-50 grayscale transition-all duration-300">
                <div className="absolute -inset-1 bg-gray-200 dark:bg-gray-700 rounded-full blur opacity-25"></div>
                <button className="relative size-16 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm" disabled>
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-3xl">mic_off</span>
                </button>
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mic Disabled</span>
        </div>

        <style>{`
            @keyframes wave {
                0%, 100% { height: 10px; }
                50% { height: 100%; }
            }
        `}</style>
    </>
);

// Generating Panel Component
const GeneratingPanel = ({ isLoadingResults }) => (
    <>
        <style>{`
            @keyframes countdown {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: 251; }
            }
            .progress-ring-circle {
                animation: countdown 2s linear forwards;
                transform: rotate(-90deg);
                transform-origin: 50% 50%;
                transition: stroke-dashoffset 0.35s;
            }
        `}</style>
        
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Circular Progress Timer & Icon */}
            <div className="relative flex items-center justify-center mb-8">
                {/* SVG Ring */}
                <svg className="w-24 h-24 md:w-28 md:h-28" viewBox="0 0 100 100">
                    {/* Track */}
                    <circle className="text-gray-200 dark:text-gray-800 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="4"></circle>
                    {/* Progress (Animated) */}
                    <circle className="progress-ring-circle text-primary dark:text-teal-400 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeLinecap="round" strokeWidth="4" strokeDasharray="251"></circle>
                </svg>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-teal-400 shadow-sm backdrop-blur-sm">
                        <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            <p className="text-base md:text-lg font-medium text-gray-600 dark:text-gray-400">
                {isLoadingResults ? 'Loading results...' : 'Generating next question...'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Please wait a moment
            </p>
        </div>

        <div className="mt-auto pt-8 w-full flex flex-col items-center gap-4">
            <div className="relative group cursor-not-allowed opacity-50 grayscale transition-all duration-300">
                <div className="absolute -inset-1 bg-gray-200 dark:bg-gray-700 rounded-full blur opacity-25"></div>
                <button className="relative size-16 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm" disabled>
                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-3xl">mic_off</span>
                </button>
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mic Disabled</span>
        </div>
    </>
);

// Listening Panel Component
const ListeningPanel = ({ onDone, transcript, setTranscript, recordingMode = 'audio', videoPreviewRef = null }) => (
    <>
        {recordingMode === 'video' && videoPreviewRef ? (
            // Video mode: show video preview
            <div className="flex-1 flex flex-col items-center justify-center w-full mb-4">
                <div className="relative w-full max-w-sm">
                    {/* Video Preview */}
                    <video 
                        ref={videoPreviewRef} 
                        autoPlay 
                        muted 
                        className="w-full rounded-lg bg-black shadow-lg border-2 border-primary/50"
                        style={{maxHeight: '300px'}}
                    />
                    {/* Recording Indicator Overlay */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold">REC</span>
                    </div>
                </div>
                <p className="text-primary font-bold text-lg mt-4 animate-pulse">Recording Video...</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Speak clearly and look at the camera</p>
            </div>
        ) : (
            // Audio mode: show listening visualization
            <div className="flex-1 flex flex-col items-center justify-center w-full">
                <div aria-hidden="true" className="h-24 flex items-center justify-center gap-1.5 mb-3">
                    <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-8 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-14 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-10 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style={{animationDelay: '0.3s'}}></div>
                    <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-16 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-6 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style={{animationDelay: '0.4s'}}></div>
                </div>
                <p className="text-primary font-bold text-lg md:text-xl animate-pulse">Listening...</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm md:text-base mt-2">Speak clearly</p>
            </div>
        )}
        
        <div className="w-full px-2 mb-2 text-xs text-gray-500 dark:text-gray-400 text-center italic">
            {recordingMode === 'video' ? 'Make sure your camera is visible' : 'Speak into your microphone'}
        </div>
        
        <div className="mt-auto pt-4 w-full flex flex-col items-center gap-2 relative z-20 pointer-events-auto">
            <button onClick={() => onDone()} className="relative z-20 px-4 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg pointer-events-auto">
                Done
            </button>
            <div className="relative group">
                <div className="absolute -inset-1 bg-primary/20 rounded-full blur animate-pulse"></div>
                <div className="relative size-10 flex items-center justify-center rounded-full bg-primary shadow-lg">
                    <span className="material-symbols-outlined text-white text-xl">mic</span>
                </div>
            </div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">Recording</span>
        </div>

        <style>{`
            @keyframes wave {
                0%, 100% { height: 10px; }
                50% { height: 100%; }
            }
        `}</style>
    </>
);

// Skipping Panel Component
const SkippingPanel = () => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Circular Progress Ring */}
            <div className="relative flex items-center justify-center mb-8">
                <svg className="w-32 h-32 transform" viewBox="0 0 100 100">
                    {/* Track */}
                    <circle
                        className="text-gray-200 dark:text-gray-800 stroke-current"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="40"
                        strokeWidth="4"
                    />
                    {/* Progress (Animated) */}
                    <circle
                        className="text-primary dark:text-secondary stroke-current animate-countdown"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="40"
                        strokeWidth="4"
                        strokeLinecap="round"
                        style={{ strokeDasharray: 251, strokeDashoffset: 0 }}
                    />
                </svg>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 dark:bg-secondary/20 text-primary dark:text-secondary shadow-sm backdrop-blur-sm">
                        <span className="material-symbols-outlined text-5xl">check</span>
                    </div>
                </div>
            </div>
            {/* Generating Message */}
            <div className="flex flex-col items-center gap-2">
                <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-full border border-gray-100 dark:border-gray-700">
                    <span className="material-symbols-outlined text-primary dark:text-secondary text-sm animate-spin">sync</span>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Generating next question...</span>
                </div>
            </div>
        </div>
        <style>{`
            @keyframes countdown {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: 251; }
            }
            .animate-countdown {
                animation: countdown 2s linear forwards;
            }
        `}</style>
    </>
);

// Evaluating Panel Component
const EvaluatingPanel = () => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full p-6">
            <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                <div className="absolute w-20 h-20 bg-gradient-to-tr from-primary/10 to-transparent rounded-full backdrop-blur-sm z-10 flex items-center justify-center border border-primary/20">
                    <span className="material-symbols-outlined text-3xl text-primary dark:text-[#5F9479] animate-pulse">psychology</span>
                </div>
                <div className="absolute w-24 h-24 rounded-full border border-dashed border-primary/30 orbit-cw">
                    <div className="absolute top-1/2 -right-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(54,92,99,0.6)]"></div>
                </div>
                <div className="absolute w-32 h-32 rounded-full border border-gray-100 dark:border-gray-700 orbit-ccw">
                    <div className="absolute bottom-1/2 -left-1.5 w-3 h-3 bg-teal-400 rounded-full shadow-[0_0_10px_rgba(95,148,121,0.6)]"></div>
                </div>
            </div>
            <h3 className="text-lg font-bold text-primary dark:text-teal-400 mb-2">Evaluating...</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Analyzing clarity, correctness, and depth</p>
        </div>

        <style>{`
            @keyframes orbit-cw {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes orbit-ccw {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(-360deg); }
            }
            .orbit-cw {
                animation: orbit-cw 8s linear infinite;
            }
            .orbit-ccw {
                animation: orbit-ccw 12s linear infinite;
            }
        `}</style>
    </>
);

export default InterviewScreen;

