import React, { useEffect, useState, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { api, speakText, playAudioFromBase64 } from '../../utils/api';
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
    const activeStreamsRef = useRef(new Set());
    const sessionRecordingChunksRef = useRef([]);
    const recordingPreviewRef = useRef(null); // Video preview during recording
    const previewContainerRef = useRef(null);
    // Speech recognition refs
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const interimTranscriptRef = useRef('');
    const audioPlayedRef = useRef(false);
    const questionStartAtRef = useRef(null);
    const questionStartOffsetRef = useRef(null);
    const panelStateRef = useRef(panelState);
    const allowRecordingRef = useRef(false);
    const [isSessionRecording, setIsSessionRecording] = useState(false);
    const [sessionRecordingEnabled, setSessionRecordingEnabled] = useState(true);
    const [previewPosition, setPreviewPosition] = useState({ x: 24, y: 24 });
    const previewDragRef = useRef({ isDragging: false, offsetX: 0, offsetY: 0 });

    // Initialize interview from navigation params
    useEffect(() => {
        if (currentParams?.sessionId && currentParams?.firstQuestion) {
            console.log('Initializing interview with sessionId:', currentParams.sessionId);
            console.log('First question:', currentParams.firstQuestion);
            updateInterview({
                sessionId: currentParams.sessionId,
                currentQuestion: currentParams.firstQuestion,
                questionText: currentParams.firstQuestion,
                questionNumber: 1,
                startedAt: interview.startedAt || new Date().toISOString()
            });
        }
    }, [currentParams?.sessionId, currentParams?.firstQuestion]);

    useEffect(() => {
        if (currentParams?.recordingMode) {
            updateInterview({ recordingMode: currentParams.recordingMode });
        }
    }, [currentParams?.recordingMode]);

    useEffect(() => {
        if (interview.recordingMode !== 'video' || !isSessionRecording) {
            return;
        }
        if (recordingPreviewRef.current && mediaStreamRef.current) {
            recordingPreviewRef.current.srcObject = mediaStreamRef.current;
        }
    }, [interview.recordingMode, isSessionRecording]);

    // Speak question text when component mounts or when new question arrives
    useEffect(() => {
        if (interview.questionText && !interview.audioPlaying && !audioPlayedRef.current) {
            const nowIso = new Date().toISOString();
            questionStartAtRef.current = nowIso;
            if (interview.startedAt) {
                const offsetMs = Date.parse(nowIso) - Date.parse(interview.startedAt);
                questionStartOffsetRef.current = Number.isFinite(offsetMs) ? Math.max(offsetMs / 1000, 0) : null;
            } else {
                questionStartOffsetRef.current = null;
            }
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

    const stopSpeechRecognition = () => {
        if (recognitionRef.current) {
            try {
                if (typeof recognitionRef.current.close === 'function') {
                    recognitionRef.current.close();
                    console.log('Speech recognition closed');
                } else if (typeof recognitionRef.current.abort === 'function') {
                    recognitionRef.current.abort();
                    console.log('Speech recognition aborted');
                } else {
                    recognitionRef.current.stop();
                    console.log('Speech recognition stopped');
                }
            } catch (error) {
                console.error('Error stopping speech recognition:', error);
            }
            recognitionRef.current = null;
        }
        setIsRecordingLocal(false);
        updateInterview({ isRecording: false });
    };

    const registerStream = (stream) => {
        if (!stream) return;
        activeStreamsRef.current.add(stream);
    };

    const stopAllStreams = () => {
        activeStreamsRef.current.forEach((stream) => {
            try {
                stream.getTracks().forEach((track) => {
                    try {
                        track.stop();
                    } catch (error) {
                        console.warn('Error stopping track:', error);
                    }
                });
            } catch (error) {
                console.warn('Error stopping stream:', error);
            }
        });
        activeStreamsRef.current.clear();
    };

    const forceStopMediaTracks = () => {
        if (!mediaStreamRef.current) {
            stopAllStreams();
            return;
        }

        try {
            mediaStreamRef.current.getTracks().forEach((track) => {
                try {
                    track.stop();
                } catch (error) {
                    console.warn('Error stopping track:', error);
                }
            });
        } finally {
            mediaStreamRef.current = null;
        }

        if (recordingPreviewRef.current) {
            recordingPreviewRef.current.srcObject = null;
        }

        stopAllStreams();
    };

    const stopSessionRecording = async ({ clearChunks = false } = {}) => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            try {
                recorder.requestData();
            } catch (error) {
                console.warn('MediaRecorder requestData failed:', error);
            }
        }

        if (recorder && recorder.state === 'recording') {
            await new Promise((resolve) => {
                const onStopHandler = () => {
                    recorder.removeEventListener('stop', onStopHandler);
                    resolve();
                };
                recorder.addEventListener('stop', onStopHandler);
                try {
                    recorder.stop();
                } catch (error) {
                    console.error('Error stopping MediaRecorder:', error);
                    resolve();
                }
            });
        }

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        mediaRecorderRef.current = null;

        if (recordingPreviewRef.current) {
            recordingPreviewRef.current.srcObject = null;
        }

        setIsSessionRecording(false);

        if (clearChunks) {
            sessionRecordingChunksRef.current = [];
        }
    };

    const stopAllRecording = () => {
        console.log('stopAllRecording called');
        allowRecordingRef.current = false;
        setSessionRecordingEnabled(false);
        stopSpeechRecognition();
        forceStopMediaTracks();
        stopSessionRecording({ clearChunks: true });
        setIsRecordingLocal(false);
        updateInterview({ isRecording: false });
    };

    const startSessionRecording = async () => {
        if (mediaRecorderRef.current || isSessionRecording) {
            return;
        }

        try {
            console.log('Starting full-session recording...');
            const isVideoMode = interview.recordingMode === 'video';
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            if (isVideoMode) {
                constraints.video = { facingMode: 'user' };
            }

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                if (isVideoMode && error.name === 'NotFoundError') {
                    console.warn('[📹 VIDEO] Camera not found, falling back to audio only');
                    stream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
                    updateInterview({ recordingMode: 'audio' });
                } else {
                    throw error;
                }
            }
            mediaStreamRef.current = stream;
            registerStream(stream);
            sessionRecordingChunksRef.current = [];

            if (isVideoMode && recordingPreviewRef.current) {
                recordingPreviewRef.current.srcObject = stream;
            }

            let mimeType = '';
            if (isVideoMode) {
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
            } else {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                }
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = '';
                }
            }

            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    sessionRecordingChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                console.log('Session recording stopped, chunks:', sessionRecordingChunksRef.current.length);
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                setIsSessionRecording(false);
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsSessionRecording(true);
        } catch (error) {
            console.error('Error starting session recording:', error);
            alert('Failed to start recording. Please check your camera and microphone permissions.');
        }
    };

    const finalizeSessionRecording = async () => {
        if (mediaRecorderRef.current) {
            await stopSessionRecording();
        }

        if (sessionRecordingChunksRef.current.length === 0) {
            return null;
        }

        const mimeType = interview.recordingMode === 'video' ? 'video/webm' : 'audio/webm';
        const mediaBlob = new Blob(sessionRecordingChunksRef.current, { type: mimeType });
        sessionRecordingChunksRef.current = [];

        const recordingUrl = await api.uploadSessionRecording(interview.sessionId, mediaBlob, interview.recordingMode);
        if (recordingUrl) {
            updateInterview({ sessionRecordingUrl: recordingUrl });
        }
        return recordingUrl;
    };

    // Keep panelStateRef in sync with panelState
    useEffect(() => {
        panelStateRef.current = panelState;
    }, [panelState]);

    // Start/stop speech recognition based on listening state
    useEffect(() => {
        if (panelState === 'listening') {
            startRecording().catch((error) => {
                console.error('Error in startRecording:', error);
            });
        } else {
            stopSpeechRecognition();
        }
    }, [panelState]);

    useEffect(() => {
        if (!interview.sessionId || !sessionRecordingEnabled || isSessionRecording || mediaRecorderRef.current) {
            return;
        }
        startSessionRecording();
    }, [interview.sessionId, interview.recordingMode, isSessionRecording, sessionRecordingEnabled]);

    useEffect(() => {
        if (interview.sessionId) {
            setSessionRecordingEnabled(true);
        }
    }, [interview.sessionId]);

    // Cleanup: stop recording when component unmounts
    useEffect(() => {
        // Register the callback to stop recording when navigating away
        if (registerStopRecordingCallback) {
            registerStopRecordingCallback(() => {
                stopAllRecording();
            });
        }

        const handlePageHide = () => {
            stopAllRecording();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                stopAllRecording();
            }
        };

        window.addEventListener('pagehide', handlePageHide);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            console.log('InterviewScreen unmounting, stopping recording');
            window.removeEventListener('pagehide', handlePageHide);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopAllRecording();
        };
    }, []); // Empty dependencies - run only on mount/unmount

    const startRecording = async () => {
        if (panelStateRef.current !== 'listening') {
            console.log('Not in listening state, skipping startRecording');
            return;
        }

        // Prevent starting if already recording
        if (isRecordingLocal && recognitionRef.current) {
            console.log('Already recording, skipping');
            return;
        }

        try {
            allowRecordingRef.current = true;
            finalTranscriptRef.current = '';
            interimTranscriptRef.current = '';
            // ======================
            // START SPEECH RECOGNITION (STT)
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
            console.error('Error starting speech recognition:', error);
            setIsRecordingLocal(false);
            updateInterview({ isRecording: false });
            alert('Failed to start speech recognition. Please check your microphone permissions.');
        }
    };

    const handleDoneSpeaking = async () => {
        console.log('User clicked Done Speaking, stopping STT and submitting');
        allowRecordingRef.current = false;

        stopSpeechRecognition();
        await proceedWithSubmission();

        async function proceedWithSubmission() {
            // Get transcript from STT
            const transcriptToSend = (finalTranscriptRef.current + interimTranscriptRef.current).trim();
            console.log('Transcript to send:', transcriptToSend);
            setIsRecordingLocal(false);

            console.log(`[${interview.recordingMode === 'video' ? '📹 VIDEO' : '🎤 AUDIO'}] Submitting answer for Q${interview.questionNumber}`);
            submitAnswer(
                transcriptToSend,
                false,
                null,
                questionStartAtRef.current,
                questionStartOffsetRef.current
            );
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

    const submitAnswer = async (
        answerText,
        isSkip = false,
        recordingBlobUrl = null,
        questionStartedAt = null,
        questionStartOffsetSeconds = null
    ) => {
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
            const result = await api.submitAnswer(
                interview.sessionId,
                answerText,
                isSkip,
                recordingBlobUrl,
                questionStartedAt,
                questionStartOffsetSeconds
            );
            console.log('Answer submitted, response:', result);
            console.log('Response structure:', {
                final: result.final,
                step: result.step,
                hasQuestion: !!result.question,
                hasSummary: !!result.summary,
                hasEvaluation: !!result.evaluation,
                allKeys: Object.keys(result)
            });

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
            } else if (!result.final && (result.step === 'question' || result.question)) {
                // Next question
                console.log('Getting next question...');
                console.log('Result:', JSON.stringify(result, null, 2));
                console.log('Result.evaluation:', result.evaluation);
                
                if (!result.question) {
                    console.error('ERROR: Backend returned step=question but no question field!', result);
                    alert('Error: Backend did not return the next question. Please try submitting again.');
                    setIsSubmitting(false);
                    setPanelState('listening');
                    return;
                }
                
                audioPlayedRef.current = false; // Reset for next question
                setHint(null); // Clear hint for next question
                
                // Reset audio chunks and transcript refs for new question
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
                
                updateInterview({
                    currentQuestion: result.question,
                    questionText: result.question,
                    questionNumber: interview.questionNumber + 1,
                    audioPlaying: false,
                    answers: updatedAnswers,
                });
                // Reset panelState to allow the effect to trigger and speak the new question
                setPanelState('loading');
            } else {
                // Interview complete or unexpected response
                console.log('Unknown response state:', {
                    final: result.final,
                    step: result.step,
                    hasSummary: !!result.summary,
                    hasQuestion: !!result.question,
                    allKeys: Object.keys(result)
                });
                
                // Default to checking for summary (interview complete)
                if (result.final || result.summary) {
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
                    setSessionRecordingEnabled(false);
                    await finalizeSessionRecording();
                    stopAllRecording();
                    navigateTo('results');
                } else {
                    console.error('ERROR: Unexpected response format from server:', result);
                    alert('Unexpected server response. Please refresh and try again.');
                    setIsSubmitting(false);
                    setPanelState('listening');
                }
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
            setIsSubmitting(false);
            setPanelState('listening'); // Reset panel state on error
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
            // Stop speech recognition immediately
            stopSpeechRecognition();
            
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

    const handlePreviewPointerDown = (event) => {
        const container = previewContainerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        previewDragRef.current.isDragging = true;
        previewDragRef.current.offsetX = event.clientX - rect.left;
        previewDragRef.current.offsetY = event.clientY - rect.top;

        container.setPointerCapture(event.pointerId);
    };

    const handlePreviewPointerMove = (event) => {
        if (!previewDragRef.current.isDragging) return;

        const container = previewContainerRef.current;
        const width = container?.offsetWidth || 0;
        const height = container?.offsetHeight || 0;
        const padding = 12;

        const maxX = Math.max(padding, window.innerWidth - width - padding);
        const maxY = Math.max(padding, window.innerHeight - height - padding);

        const nextX = Math.min(Math.max(event.clientX - previewDragRef.current.offsetX, padding), maxX);
        const nextY = Math.min(Math.max(event.clientY - previewDragRef.current.offsetY, padding), maxY);

        setPreviewPosition({ x: nextX, y: nextY });
    };

    const handlePreviewPointerUp = (event) => {
        if (!previewDragRef.current.isDragging) return;
        previewDragRef.current.isDragging = false;
        const container = previewContainerRef.current;
        if (container) {
            container.releasePointerCapture(event.pointerId);
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
        stopSpeechRecognition();
        finalTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        
        setTranscript('');
        const newQuestionsSkipped = (interview.questionsSkipped || 0) + 1;
        console.log('Questions skipped updated:', newQuestionsSkipped);
        updateInterview({ questionsSkipped: newQuestionsSkipped });
        // Submit empty answer to skip with skip flag
        await submitAnswer('', true);
    };

    const endSession = async () => {
        console.log('Ending session early');
        console.log('Current questionWiseFeedback:', questionWiseFeedback);
        setEndingSession(true);
        setSessionRecordingEnabled(false);
        
        stopSpeechRecognition();

        try {
            await finalizeSessionRecording();
            stopAllRecording();
            const result = await api.endSession(interview.sessionId, questionWiseFeedback);
            console.log('Session ended, response:', result);
            if (result.final && result.summary) {
                updateInterview({
                    summary: result.summary,
                    questionWiseFeedback: questionWiseFeedback
                });
            }
            navigateTo('results');
        } catch (error) {
            console.error('Error ending session:', error);
            setEndingSession(false);
            alert('Failed to end session. Please try again.');
        }
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
            {endingSession && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d191b]/90 text-white">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl">done_all</span>
                            </div>
                        </div>
                        <p className="text-lg font-semibold tracking-wide">Wrapping up your interview...</p>
                        <p className="text-sm text-white/70">Finalizing your results</p>
                    </div>
                </div>
            )}
            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-10 relative">
                {interview.recordingMode === 'video' && isSessionRecording && (
                    <div
                        ref={previewContainerRef}
                        onPointerMove={handlePreviewPointerMove}
                        onPointerUp={handlePreviewPointerUp}
                        onPointerCancel={handlePreviewPointerUp}
                        className="fixed z-50 w-56 md:w-64 rounded-xl shadow-xl border border-primary/30 bg-white/90 dark:bg-[#1e2126]/90 backdrop-blur-lg cursor-move"
                        style={{
                            left: `${previewPosition.x}px`,
                            top: `${previewPosition.y}px`,
                            touchAction: 'none',
                            userSelect: 'none'
                        }}
                    >
                        <div
                            onPointerDown={handlePreviewPointerDown}
                            className="flex items-center justify-between px-3 py-2 border-b border-primary/20 text-xs font-bold uppercase tracking-wider text-primary cursor-move"
                        >
                            <span>Live Recording</span>
                            <span className="flex items-center gap-1 text-red-600">
                                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                REC
                            </span>
                        </div>
                        <video
                            ref={recordingPreviewRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full rounded-b-xl bg-black pointer-events-none"
                        />
                    </div>
                )}
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
const ListeningPanel = ({ onDone, transcript, setTranscript, recordingMode = 'audio' }) => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            {recordingMode === 'video' ? (
                <>
                    <span className="material-symbols-outlined text-5xl text-primary mb-3">videocam</span>
                    <p className="text-primary font-bold text-lg md:text-xl animate-pulse">Recording Video...</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm md:text-base mt-2">Speak clearly and look at the camera</p>
                </>
            ) : (
                <>
                    <div aria-hidden="true" className="h-24 flex items-center justify-center gap-1.5 mb-3">
                        <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-8 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-14 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-10 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style={{animationDelay: '0.3s'}}></div>
                        <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-16 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 bg-[#2f86de]/80 dark:bg-[#2f86de]/90 rounded-full h-6 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style={{animationDelay: '0.4s'}}></div>
                    </div>
                    <p className="text-primary font-bold text-lg md:text-xl animate-pulse">Listening...</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm md:text-base mt-2">Speak clearly</p>
                </>
            )}
        </div>
        
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

