import React, { useEffect, useState, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { api, speakText } from '../../utils/api';
import { createSpeechRecognizer } from '../../utils/azureSpeech';

// Toggle test mode: set to true for testing with text input, false for production (mic only)
const FOR_TEST = false;

const InterviewScreen = () => {
    const { interview, updateInterview, navigateTo, theme, toggleTheme } = useInterview();
    const [panelState, setPanelState] = useState('speaking'); // 'speaking', 'listening', 'evaluating', 'skipping', 'coach-feedback'
    const [transcript, setTranscript] = useState('');
    const [endingSession, setEndingSession] = useState(false);
    const [hint, setHint] = useState(null);
    const [hintLoading, setHintLoading] = useState(false);
    const [hintError, setHintError] = useState(null);
    const [isLoadingResults, setIsLoadingResults] = useState(false);
    const [questionWiseFeedback, setQuestionWiseFeedback] = useState([]);
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const transcriptRef = useRef(''); // Store current transcript value for onend handler
    const userStoppedRef = useRef(false);
    const audioPlayedRef = useRef(false);

    // Speak question text when component mounts or when new question arrives
    useEffect(() => {
        if (interview.questionText && !interview.audioPlaying && !audioPlayedRef.current) {
            console.log('Speaking question:', interview.questionNumber);
            audioPlayedRef.current = true;
            updateInterview({ audioPlaying: true });
            speakText(interview.questionText)
                .then(() => {
                    console.log('Question speech finished');
                    updateInterview({ audioPlaying: false, questionText: null });
                    setPanelState('listening');
                    startRecording();
                })
                .catch((error) => {
                    console.warn('Failed to speak question:', error);
                    updateInterview({ audioPlaying: false });
                    setPanelState('listening');
                    startRecording();
                });
        } else if (!interview.questionText && panelState === 'speaking' && !audioPlayedRef.current) {
            // If no text to speak, go straight to listening
            console.log('No question to speak, starting recording immediately');
            audioPlayedRef.current = true;
            setPanelState('listening');
            setTimeout(() => startRecording(), 500);
        }
    }, [interview.questionText]);

    // Cleanup: stop recording when component unmounts
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    // Keep transcriptRef in sync with transcript state
    useEffect(() => {
        transcriptRef.current = transcript;
    }, [transcript]);

    const startRecording = () => {
        console.log('startRecording called');
        
        // Prevent starting if already recording (but allow reinitializing if ref is null)
        if (recognitionRef.current && interview.isRecording) {
            console.log('Already recording, skipping');
            return;
        }
        
        try {
            const recognition = createSpeechRecognizer();
            
            finalTranscriptRef.current = '';
            transcriptRef.current = '';
            setTranscript('');
            userStoppedRef.current = false;

            recognition.onstart = () => {
                console.log('Speech recognition started');
                updateInterview({ isRecording: true });
                setPanelState('listening');
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcriptPiece = result.transcript || result[0]?.transcript || '';
                    const isFinal = result.isFinal !== undefined ? result.isFinal : result[0]?.isFinal;
                    
                    if (isFinal) {
                        finalTranscriptRef.current += transcriptPiece + ' ';
                    } else {
                        interimTranscript += transcriptPiece;
                    }
                }
                
                const updatedTranscript = finalTranscriptRef.current + interimTranscript;
                transcriptRef.current = updatedTranscript;
                setTranscript(updatedTranscript);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'not-allowed' || event.error.includes('not-allowed')) {
                    alert('Microphone access denied. Please allow microphone access and refresh the page.');
                } else {
                    alert('Speech recognition error: ' + event.error);
                }
                updateInterview({ isRecording: false });
                setPanelState('listening'); // Stay in listening state
            };


            recognition.onend = () => {
                console.log('Speech recognition ended, userStopped:', userStoppedRef.current);
                console.log('Final transcript ref:', finalTranscriptRef.current);
                console.log('Transcript ref:', transcriptRef.current);
                
                // Only submit if user manually stopped
                if (userStoppedRef.current) {
                    updateInterview({ isRecording: false });
                    const answerToSend = finalTranscriptRef.current.trim() || transcriptRef.current.trim();
                    console.log('Submitting answer:', answerToSend);
                    
                    // Reset the flag after submission
                    userStoppedRef.current = false;
                    // Clear the ref so we know to reinitialize
                    recognitionRef.current = null;
                    submitAnswer(answerToSend);
                } else {
                    // Recognition ended unexpectedly (silence, etc), restart it
                    console.log('Recognition ended unexpectedly, restarting...');
                    if (panelState === 'listening') {
                        // Need to reinitialize and restart since stopped object can't be restarted
                        try {
                            startRecording();
                        } catch (error) {
                            console.error('Failed to restart recognition:', error);
                            updateInterview({ isRecording: false });
                        }
                    }
                }
            };

            recognitionRef.current = recognition;
            
            console.log('Starting speech recognition...');
            recognition.start();
        } catch (error) {
            console.error('Error starting recognition:', error);
            alert('Failed to start speech recognition: ' + error.message);
            updateInterview({ isRecording: false });
        }
    };

    const handleDoneSpeaking = () => {
        console.log('User clicked Done Speaking, about to submit');
        console.log('Current panelState:', panelState);
        console.log('Recognition ref:', recognitionRef.current);
        userStoppedRef.current = true;
        if (recognitionRef.current) {
            console.log('Stopping recognition...');
            try {
                recognitionRef.current.stop();
            } catch (err) {
                console.error('Error stopping recognition:', err);
            }
        } else {
            console.warn('Recognition ref not available!');
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
                await playAudioFromBase64(result.audio);
                // Ensure recognition is still active after hint audio finishes
                if (recognitionRef.current && panelState === 'listening') {
                    console.log('Hint audio finished, recognition still active');
                }
            }
        } catch (error) {
            console.error('Failed to get hint:', error);
            setHintError('Could not fetch hint.');
        } finally {
            setHintLoading(false);
        }
    };

    const submitAnswer = async (answerText, isSkip = false) => {
        console.log('Submitting answer:', answerText);
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
            const result = await api.submitAnswer(interview.sessionId, answerText);
            console.log('Answer submitted, response:', result);

            // Store the answer
            const updatedAnswers = [...interview.answers, {
                question: interview.currentQuestion,
                answer: answerText
            }];

            if (!result.final && result.step === 'feedback') {
                // Coach persona: show feedback screen and wait for proceed
                console.log('Coach feedback step');
                console.log('Result:', result);
                console.log('Result.evaluation:', result.evaluation);
                audioPlayedRef.current = false;
                setHint(null); // Clear hint for next question
                
                // Capture evaluation data for question-wise feedback
                if (result.evaluation) {
                    console.log('Capturing evaluation data:', result.evaluation);
                    const feedbackEntry = {
                        questionNumber: interview.questionNumber,
                        question: interview.currentQuestion,
                        answer: answerText,
                        score: result.evaluation.score,
                        topic: result.evaluation.topic,
                        strengths: result.evaluation.strengths || [],
                        weaknesses: result.evaluation.weaknesses || [],
                        feedback: result.feedback || ''
                    };
                    console.log('Feedback entry:', feedbackEntry);
                    setQuestionWiseFeedback(prev => {
                        const updated = [...prev, feedbackEntry];
                        console.log('Updated questionWiseFeedback:', updated);
                        return updated;
                    });
                } else {
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
                console.log('Result:', result);
                console.log('Result.evaluation:', result.evaluation);
                audioPlayedRef.current = false; // Reset for next question
                setHint(null); // Clear hint for next question
                
                // Capture evaluation data for question-wise feedback (from strict persona or after coach proceed)
                if (result.evaluation) {
                    console.log('Capturing evaluation data (strict/next):', result.evaluation);
                    const feedbackEntry = {
                        questionNumber: interview.questionNumber,
                        question: interview.currentQuestion,
                        answer: answerText,
                        score: result.evaluation.score,
                        topic: result.evaluation.topic,
                        strengths: result.evaluation.strengths || [],
                        weaknesses: result.evaluation.weaknesses || [],
                        feedback: result.feedback || 'No additional feedback provided'
                    };
                    console.log('Feedback entry (strict):', feedbackEntry);
                    setQuestionWiseFeedback(prev => {
                        const updated = [...prev, feedbackEntry];
                        console.log('Updated questionWiseFeedback:', updated);
                        return updated;
                    });
                } else {
                    console.warn('No evaluation data in result (strict/next)');
                }
                
                // Reset transcripts and refs for new question
                finalTranscriptRef.current = '';
                transcriptRef.current = '';
                userStoppedRef.current = false;
                setTranscript('');
                // Clear recognition so it will be reinitialized when listening starts
                if (recognitionRef.current) {
                    try {
                        recognitionRef.current.stop();
                    } catch (e) {
                        console.log('Recognition already stopped');
                    }
                }
                recognitionRef.current = null;
                updateInterview({
                    currentQuestion: result.question,
                    questionText: result.question,
                    questionNumber: interview.questionNumber + 1,
                    audioPlaying: false,
                    answers: updatedAnswers,
                });
                setPanelState('speaking');
            } else {
                // Interview complete
                console.log('Interview complete');
                console.log('Result:', result);
                
                // Capture evaluation for the LAST question if it exists
                let finalFeedback = [...questionWiseFeedback];
                if (result.evaluation) {
                    console.log('Capturing final question evaluation:', result.evaluation);
                    const lastFeedbackEntry = {
                        questionNumber: interview.questionNumber,
                        question: interview.currentQuestion,
                        answer: answerText,
                        score: result.evaluation.score,
                        topic: result.evaluation.topic,
                        strengths: result.evaluation.strengths || [],
                        weaknesses: result.evaluation.weaknesses || [],
                        feedback: result.feedback || ''
                    };
                    finalFeedback = [...questionWiseFeedback, lastFeedbackEntry];
                    console.log('Final feedback with last question:', finalFeedback);
                }
                
                console.log('questionWiseFeedback:', finalFeedback);
                console.log('hintsUsed:', interview.hintsUsed);
                console.log('questionsSkipped:', interview.questionsSkipped);
                updateInterview({ 
                    summary: result.summary, 
                    answers: updatedAnswers,
                    questionWiseFeedback: finalFeedback,
                });
                navigateTo('results');
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
            alert('Failed to submit answer. Please try again.');
        }
    };

    const proceedAfterFeedback = async () => {
        try {
            const result = await api.continue(interview.sessionId);
            console.log('Proceeded after feedback, response:', result);
            audioPlayedRef.current = false;
            setHint(null); // Clear hint for next question
            updateInterview({
                feedbackText: null,
                currentQuestion: result.question,
                questionText: result.question,
                questionNumber: interview.questionNumber + 1,
                audioPlaying: false,
            });
            setPanelState('speaking');
        } catch (error) {
            console.error('Error proceeding after feedback:', error);
            alert('Failed to proceed to next question.');
        }
    };

    const tryAgainSameQuestion = () => {
        // Replay same question and re-enter listening with typing/mic
        userStoppedRef.current = false;
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

    const progressPercentage = (interview.questionNumber / interview.totalQuestions) * 100;

    const skipQuestion = async () => {
        console.log('Skipping question');
        // Stop recording if active
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        // Reset refs and state for skip
        userStoppedRef.current = false;
        finalTranscriptRef.current = '';
        transcriptRef.current = '';
        setTranscript('');
        const newQuestionsSkipped = (interview.questionsSkipped || 0) + 1;
        console.log('Questions skipped updated:', newQuestionsSkipped);
        updateInterview({ questionsSkipped: newQuestionsSkipped });
        // Submit empty answer to skip (without showing evaluating state)
        await submitAnswer('', true);
    };

    const endSession = () => {
        console.log('Ending session early');
        setEndingSession(true);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        // Call backend to end session and get feedback
        api.endSession(interview.sessionId)
            .then((result) => {
                console.log('Session ended, response:', result);
                if (result.final && result.summary) {
                    updateInterview({ 
                        summary: result.summary
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
            // End the interview silently and navigate to welcome
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
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
        <div className="bg-background-light dark:bg-background-dark text-[#121617] dark:text-[#f0f0f0] font-display min-h-screen flex flex-col transition-colors duration-300">
            {/* Header */}
            <header className="w-full border-b border-[#ebefef] dark:border-gray-800 bg-white/50 dark:bg-[#22252a]/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button onClick={handleLogoClick} className="flex items-center gap-3 hover:opacity-70 transition-opacity cursor-pointer">
                        <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-xl">graphic_eq</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight">InterviewPrep AI</h2>
                    </button>
                    <div className="hidden md:flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="inline-flex items-center justify-center size-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 text-gray-700 dark:text-gray-200 shadow-sm hover:shadow transition-all"
                            aria-label="Toggle color theme"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            <span className="material-symbols-outlined text-lg">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                        </button>
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {interview.roleDisplay}
                        </span>
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <button 
                            onClick={endSession} 
                            disabled={endingSession}
                            className="text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {endingSession && (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {endingSession ? 'Ending Session...' : 'End Session'}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-center p-6 sm:p-10 relative">
                {panelState === 'coach-feedback' && (
                    <div className="w-full max-w-5xl">
                        <div className="flex flex-col items-center w-full text-center mb-8">
                            <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 dark:bg-primary/20 border border-primary/10 dark:border-primary/30">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                                <span className="text-xs font-bold uppercase tracking-widest text-primary dark:text-teal-300">Feedback Analysis</span>
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
                            <button onClick={tryAgainSameQuestion} className="group relative flex items-center justify-center gap-3 bg-white dark:bg-transparent border-2 border-primary hover:bg-primary/5 text-primary dark:text-teal-300 text-sm md:text-lg font-bold px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all min-w-[200px] w-full md:w-auto">
                                <span className="material-symbols-outlined text-xl md:text-2xl">mic</span>
                                <span>Try Again</span>
                            </button>
                            <button onClick={proceedAfterFeedback} className="group relative flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-white text-sm md:text-lg font-bold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all min-w-[220px] w-full md:w-auto">
                                <span>Next Question</span>
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
                                    Q{interview.questionNumber}/{interview.totalQuestions}
                                </span>
                                <span className="text-gray-400 dark:text-gray-500 text-xs font-semibold">Technical</span>
                            </div>
                            <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{width: `${progressPercentage}%`}}></div>
                            </div>
                        </div>

                        {/* The Question */}
                        <div className="flex-grow flex flex-col justify-center min-h-0">
                            <h1 className="text-lg md:text-xl lg:text-2xl font-bold leading-snug tracking-tight text-gray-900 dark:text-gray-50">
                                {interview.currentQuestion}
                            </h1>
                            <p className="mt-3 text-gray-500 dark:text-gray-400 text-sm md:text-base leading-relaxed">
                                {transcript || (panelState === 'listening' ? 'Start speaking...' : '')}
                            </p>
                        </div>

                        {/* Hint/Skip Controls */}
                        <div className="mt-3 flex gap-3 pt-2">
                            <button 
                                onClick={handleGetHint}
                                disabled={hintLoading || panelState === 'speaking'}
                                className={`text-sm font-semibold flex items-center gap-2 transition-all ${
                                    hintLoading || panelState === 'speaking'
                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                                        : 'text-gray-400 dark:text-gray-500 hover:text-primary cursor-pointer'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                {hintLoading ? 'Getting hint...' : 'Get a hint'}
                            </button>
                            <button 
                                onClick={skipQuestion} 
                                disabled={panelState === 'speaking'}
                                className={`text-sm font-semibold flex items-center gap-2 transition-all ${
                                    panelState === 'speaking' 
                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50' 
                                        : 'text-gray-400 dark:text-gray-500 hover:text-primary cursor-pointer'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">skip_next</span>
                                Skip question
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
                        {panelState === 'speaking' && (
                            <SpeakingPanel />
                        )}
                        {panelState === 'listening' && (
                            <ListeningPanel onDone={handleDoneSpeaking} transcript={transcript} setTranscript={setTranscript} />
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

// Speaking Panel Component
const SpeakingPanel = () => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div aria-hidden="true" className="h-32 flex items-center justify-center gap-2 mb-6">
                <div className="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-12 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-20 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-16 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style={{animationDelay: '0.3s'}}></div>
                <div className="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-24 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-10 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style={{animationDelay: '0.4s'}}></div>
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
            <div className="relative flex items-center justify-center mb-10">
                {/* SVG Ring */}
                <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100">
                    {/* Track */}
                    <circle className="text-gray-200 dark:text-gray-800 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeWidth="4"></circle>
                    {/* Progress (Animated) */}
                    <circle className="progress-ring-circle text-primary dark:text-teal-400 stroke-current" cx="50" cy="50" fill="transparent" r="40" strokeLinecap="round" strokeWidth="4" strokeDasharray="251"></circle>
                </svg>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-teal-400 shadow-sm backdrop-blur-sm">
                        <span className="material-symbols-outlined text-5xl animate-spin">sync</span>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            <p className="text-lg md:text-xl font-medium text-gray-600 dark:text-gray-400">
                {isLoadingResults ? 'Loading results...' : 'Generating next question...'}
            </p>
            <p className="text-sm md:text-base text-gray-400 dark:text-gray-500 mt-2">
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
const ListeningPanel = ({ onDone, transcript, setTranscript }) => (
    <>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div aria-hidden="true" className="h-24 flex items-center justify-center gap-1.5 mb-3">
                <div className="w-2 bg-primary/80 dark:bg-primary/90 rounded-full h-8 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 bg-primary/80 dark:bg-primary/90 rounded-full h-14 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 bg-primary/80 dark:bg-primary/90 rounded-full h-10 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style={{animationDelay: '0.3s'}}></div>
                <div className="w-2 bg-primary/80 dark:bg-primary/90 rounded-full h-16 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 bg-primary/80 dark:bg-primary/90 rounded-full h-6 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style={{animationDelay: '0.4s'}}></div>
            </div>
            <p className="text-primary font-bold text-base animate-pulse">Listening...</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Speak clearly</p>
            {FOR_TEST && (
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">or type below</p>
            )}
        </div>
        
        {/* Text Input Option (Test Mode Only) */}
        {FOR_TEST && (
            <div className="w-full px-2 mb-2">
                <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Type answer (TEST MODE)..."
                    className="w-full p-2 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-yellow-600 dark:placeholder-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    rows="2"
                />
            </div>
        )}
        {!FOR_TEST && (
            <div className="w-full px-2 mb-2 text-xs text-gray-500 dark:text-gray-400 text-center italic">
                Speak into your microphone
            </div>
        )}
        
        <div className="mt-auto pt-4 w-full flex flex-col items-center gap-2 relative z-20 pointer-events-auto">
            <button onClick={onDone} className="relative z-20 px-4 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg pointer-events-auto">
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
