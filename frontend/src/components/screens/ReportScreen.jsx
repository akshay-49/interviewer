import React, { useState, useEffect, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { api, historyApi } from '../../utils/api';

const ReportScreen = () => {
    const { navigateTo, currentParams } = useInterview();
    const [expandedQuestion, setExpandedQuestion] = useState(0);
    const [sessionData, setSessionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sessionRecordingUrl, setSessionRecordingUrl] = useState(null);
    const recordingMediaRef = useRef(null);

    const handleShare = () => {
        const shareText = `Interview Report - ${sessionData.job_title || 'Session'}\nScore: ${sessionData.overall_score.toFixed(1)}/10\nCompleted: ${new Date(sessionData.completed_at).toLocaleDateString()}`;
        const shareUrl = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: 'Interview Report',
                text: shareText,
                url: shareUrl
            }).catch(err => console.log('Share cancelled'));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
                .then(() => alert('Report link copied to clipboard!'))
                .catch(() => alert('Unable to share'));
        }
    };

    useEffect(() => {
        loadSessionData();
    }, [currentParams?.sessionId]);

    useEffect(() => {
        if (!sessionData?.session_recording_blob_url) {
            setSessionRecordingUrl(null);
            return;
        }

        if (sessionData.session_recording_blob_url.includes('?')) {
            setSessionRecordingUrl(sessionData.session_recording_blob_url);
            return;
        }

        api.getBlobUrlWithSAS(sessionData.session_recording_blob_url)
            .then((url) => setSessionRecordingUrl(url || sessionData.session_recording_blob_url))
            .catch(() => setSessionRecordingUrl(sessionData.session_recording_blob_url));
    }, [sessionData]);

    useEffect(() => {
        const mediaEl = recordingMediaRef.current;
        if (!mediaEl || !sessionRecordingUrl) return;

        const handleLoadedMetadata = () => {
            if (Number.isFinite(mediaEl.duration)) {
                return;
            }
            // WebM files can report Infinity duration; seek to force duration calculation.
            const seekToEnd = () => {
                mediaEl.currentTime = 1e101;
            };
            const handleTimeUpdate = () => {
                mediaEl.currentTime = 0;
                mediaEl.removeEventListener('timeupdate', handleTimeUpdate);
            };
            mediaEl.addEventListener('timeupdate', handleTimeUpdate, { once: true });
            seekToEnd();
        };

        mediaEl.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => {
            mediaEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
    }, [sessionRecordingUrl]);

    const loadSessionData = async () => {
        try {
            setLoading(true);
            const sessionId = currentParams?.sessionId;
            const isAdmin = currentParams?.isAdmin;
            
            if (!sessionId) {
                setError('No session ID provided');
                setLoading(false);
                return;
            }

            console.log('Loading session data for:', sessionId, 'isAdmin:', isAdmin);
            let session;
            let lastError = null;
            
            try {
                if (isAdmin) {
                    // Use admin endpoint
                    session = await historyApi.getSessionDetailsAdmin(sessionId);
                } else {
                    // Use regular endpoint (user's own sessions)
                    session = await historyApi.getSessionDetails(sessionId);
                }
            } catch (err) {
                lastError = err;
                console.warn('First attempt failed:', err.message);
                // If not admin and got auth error, try public endpoint as fallback
                if (!isAdmin && err.message && err.message.includes('401')) {
                    console.log('Auth failed on user endpoint, trying public endpoint...');
                    try {
                        session = await historyApi.getSessionDetailsPublic(sessionId);
                        console.log('Public endpoint succeeded');
                    } catch (publicErr) {
                        console.error('Public fallback also failed:', publicErr);
                        // Try admin endpoint as last resort
                        try {
                            session = await historyApi.getSessionDetailsAdmin(sessionId);
                            console.log('Admin endpoint succeeded as last resort');
                        } catch (adminErr) {
                            console.error('All endpoints failed:', adminErr);
                            throw lastError; // Throw original error
                        }
                    }
                } else if (isAdmin) {
                    // Admin endpoint failed, try public as fallback
                    console.log('Admin endpoint failed, trying public endpoint...');
                    try {
                        session = await historyApi.getSessionDetailsPublic(sessionId);
                        console.log('Public endpoint succeeded');
                    } catch (publicErr) {
                        console.error('Public fallback also failed:', publicErr);
                        throw err;
                    }
                } else {
                    throw err;
                }
            }
            
            console.log('Session data loaded:', session);
            console.log('Recording mode:', session.recording_mode || 'audio (default)');
            console.log('question_wise_feedback from API:', session.question_wise_feedback);
            console.log('question_wise_feedback length:', session.question_wise_feedback?.length);
            setSessionData(session);
            setError(null);
        } catch (err) {
            console.error('Failed to load session:', err);
            setError(err.message || 'Failed to load session. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (score) => {
        const badges = {
            excellent: 'bg-green-50 text-green-700 border-green-100',
            strong: 'bg-green-50 text-green-700 border-green-100',
            'needs-review': 'bg-amber-50 text-amber-700 border-amber-100',
        };
        const labels = {
            excellent: 'Excellent Answer',
            strong: 'Strong Answer',
            'needs-review': 'Needs Review',
        };
        
        let status = 'needs-review';
        if (score >= 8) status = 'excellent';
        else if (score >= 6) status = 'strong';
        
        return { badge: badges[status], label: labels[status], status };
    };

    const parseDateTime = (value) => {
        if (!value) return null;
        if (typeof value === 'string') {
            const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
            if (!hasTimezone && value.includes('T')) {
                return new Date(`${value}Z`);
            }
        }
        return new Date(value);
    };

    const formatDateTime = (value) => {
        const date = parseDateTime(value);
        if (!date || isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatOffset = (seconds) => {
        if (!Number.isFinite(seconds)) return 'N/A';
        const total = Math.max(Math.floor(seconds), 0);
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        const pad = (value) => String(value).padStart(2, '0');
        return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
    };

    const getQuestionOffset = (question) => {
        if (Number.isFinite(question?.question_start_offset_seconds)) {
            return question.question_start_offset_seconds;
        }
        if (question?.question_started_at && sessionData?.started_at) {
            const sessionStart = Date.parse(sessionData.started_at);
            const questionStart = Date.parse(question.question_started_at);
            if (Number.isFinite(sessionStart) && Number.isFinite(questionStart)) {
                return Math.max((questionStart - sessionStart) / 1000, 0);
            }
        }
        return null;
    };

    const handleJumpToOffset = (offsetSeconds) => {
        const mediaEl = recordingMediaRef.current;
        if (!mediaEl || !Number.isFinite(offsetSeconds)) return;
        mediaEl.currentTime = Math.max(offsetSeconds, 0);
        mediaEl.play().catch(() => {});
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 font-display h-full flex flex-col items-center justify-center">
                <div className="animate-spin">
                    <span className="material-symbols-outlined text-4xl text-slate-600">autorenew</span>
                </div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Loading session details...</p>
            </div>
        );
    }

    if (error || !sessionData) {
        return (
            <div className="bg-white dark:bg-slate-900 font-display h-full flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error</span>
                <p className="text-red-600 font-semibold mb-2">{error || 'Failed to load session'}</p>
                <p className="text-gray-600 text-sm mb-6">
                    {error?.includes('401') || error?.includes('Unauthorized') 
                        ? 'Your session may have expired. Please log in again.'
                        : ''}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigateTo('history')}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Back to History
                    </button>
                    {(error?.includes('401') || error?.includes('Unauthorized')) && (
                        <button
                            onClick={() => navigateTo('welcome')}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Login Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const questions = sessionData.question_wise_feedback || [];
    const summary = sessionData.summary || {};
    const overallScore = sessionData.overall_score || 0;
    const hasSessionRecording = !!sessionData.session_recording_blob_url;

    // Debug logging
    console.log('ReportScreen - questions.length:', questions.length);
    console.log('ReportScreen - sessionData keys:', Object.keys(sessionData || {}));
    console.log('ReportScreen - sessionData.question_wise_feedback:', sessionData?.question_wise_feedback);

    return (
        <div className="bg-white dark:bg-slate-900 font-display h-full flex flex-col overflow-hidden">
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Close Button & Breadcrumb */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                            <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-2">
                                <button
                                    onClick={() => currentParams?.isAdmin ? navigateTo('admin-dashboard') : navigateTo('history')}
                                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    {currentParams?.isAdmin ? 'Dashboard' : 'History'}
                                </button>
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    {sessionData.job_title || 'Interview Session'}
                                </span>
                            </nav>
                            <button
                                onClick={() => currentParams?.isAdmin ? navigateTo('admin-dashboard') : navigateTo('history')}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    Session Review
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                    Completed on {formatDateTime(sessionData.completed_at)} • {sessionData.duration_seconds ? Math.round(sessionData.duration_seconds / 60) : 0}m Duration
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={handleShare}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
                                >
                                    <span className="material-symbols-outlined text-[20px]">ios_share</span>
                                    Share
                                </button>
                            </div>
                        </div>
                    </div>

                    {hasSessionRecording && (
                        <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="material-symbols-outlined text-primary text-2xl">
                                    {sessionData.recording_mode === 'video' ? 'video_library' : 'hearing'}
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Full Interview Recording</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Playback from start to finish</p>
                                </div>
                            </div>
                            {sessionRecordingUrl ? (
                                sessionData.recording_mode === 'video' ? (
                                    <video
                                        controls
                                        ref={recordingMediaRef}
                                        className="w-full rounded-lg bg-black"
                                        style={{ maxHeight: '480px' }}
                                    >
                                        <source src={sessionRecordingUrl} type="video/webm" />
                                        Your browser does not support the video element.
                                    </video>
                                ) : (
                                    <audio controls ref={recordingMediaRef} className="w-full">
                                        <source src={sessionRecordingUrl} type="audio/webm" />
                                        Your browser does not support the audio element.
                                    </audio>
                                )
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
                                    Preparing recording playback...
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Questions Section */}
                        <div className="lg:col-span-8 space-y-4">
                            {questions.length === 0 ? (
                                <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                                    <span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">list_alt</span>
                                    <p className="text-gray-500 dark:text-gray-400">No questions answered in this session</p>
                                </div>
                            ) : (
                                questions.map((q, index) => {
                                    const score = q.score || 0;
                                    const { badge, label } = getStatusBadge(score);
                                    const isExpanded = expandedQuestion === index;
                                    const questionOffsetSeconds = getQuestionOffset(q);
                                    const questionOffsetLabel = formatOffset(questionOffsetSeconds);

                                    return (
                                        <div
                                            key={index}
                                            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden group"
                                        >
                                            <div
                                                onClick={() =>
                                                    setExpandedQuestion(isExpanded ? null : index)
                                                }
                                                className="p-5 flex items-start gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700"
                                            >
                                                <div className={`flex-shrink-0 size-8 rounded-full ${badge} flex items-center justify-center font-bold text-sm border`}>
                                                    Q{index + 1}
                                                </div>
                                                <div className="flex-grow pt-1">
                                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                                                        {q.question || 'Question text not available'}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge}`}>
                                                            {label}
                                                        </span>
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            • Score: {score}/10
                                                        </span>
                                                        {hasSessionRecording && Number.isFinite(questionOffsetSeconds) && (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleJumpToOffset(questionOffsetSeconds);
                                                                }}
                                                                className="text-xs text-primary font-semibold hover:underline"
                                                                title="Jump to this question in the full recording"
                                                            >
                                                                • Jump to {questionOffsetLabel}
                                                            </button>
                                                        )}
                                                        {hasSessionRecording && !Number.isFinite(questionOffsetSeconds) && (
                                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                                • Time: N/A
                                                            </span>
                                                        )}
                                                        {q.topic && (
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                • {q.topic}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`material-symbols-outlined text-gray-400 transition-transform ${
                                                        isExpanded ? 'rotate-180' : ''
                                                    }`}
                                                >
                                                    expand_more
                                                </span>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="p-6 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
                                                    {/* Answer Section */}
                                                    <div className="mb-6">
                                                        <h4 className="text-sm font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3">Your Answer</h4>
                                                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base bg-gray-50 dark:bg-slate-700/50 p-3 rounded">
                                                            {q.answer || 'No answer recorded'}
                                                        </p>
                                                    </div>

                                                    {/* Recording Playback Section */}
                                                    {q.recordingUrl && (
                                                        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl">
                                                                    {sessionData.recording_mode === 'video' ? 'videocam' : 'record_voice_over'}
                                                                </span>
                                                                <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                                                                    Your {sessionData.recording_mode === 'video' ? 'Video' : 'Audio'} Recording
                                                                </h4>
                                                            </div>
                                                            {sessionData.recording_mode === 'video' ? (
                                                                <video 
                                                                    controls 
                                                                    className="w-full rounded bg-black"
                                                                    style={{
                                                                        maxHeight: '400px',
                                                                    }}
                                                                >
                                                                    <source src={q.recordingUrl} type="video/webm" />
                                                                    Your browser does not support the video element.
                                                                </video>
                                                            ) : (
                                                                <audio 
                                                                    controls 
                                                                    className="w-full h-10 rounded"
                                                                    style={{
                                                                        accentColor: '#a855f7',
                                                                    }}
                                                                >
                                                                    <source src={q.recordingUrl} type="audio/webm" />
                                                                    Your browser does not support the audio element.
                                                                </audio>
                                                            )}
                                                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                                                                Click play to {sessionData.recording_mode === 'video' ? 'watch' : 'listen to'} your recorded answer
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Score Display */}
                                                    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Score</span>
                                                            <span className="text-2xl font-bold text-slate-900 dark:text-white">{score}/10</span>
                                                        </div>
                                                    </div>

                                                    {/* Strengths Section */}
                                                    {q.strengths && q.strengths.length > 0 && (
                                                        <div className="rounded-xl border border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 p-4 mb-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[20px]">check_circle</span>
                                                                <h4 className="font-bold text-green-700 dark:text-green-400 text-sm uppercase tracking-wide">Strengths</h4>
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {q.strengths.map((strength, idx) => (
                                                                    <li key={idx} className="text-sm text-green-700 dark:text-green-300 flex gap-2">
                                                                        <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                                                                        {strength}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Weaknesses Section */}
                                                    {q.weaknesses && q.weaknesses.length > 0 && (
                                                        <div className="rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">warning</span>
                                                                <h4 className="font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">Areas for Improvement</h4>
                                                            </div>
                                                            <ul className="space-y-2">
                                                                {q.weaknesses.map((weakness, idx) => (
                                                                    <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 flex gap-2">
                                                                        <span className="text-amber-600 dark:text-amber-400 font-bold">!</span>
                                                                        {weakness}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Feedback Section */}
                                                    {q.feedback && (
                                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg">
                                                            <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">Feedback</h4>
                                                            <p className="text-sm text-blue-700 dark:text-blue-300">{q.feedback}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Right Sidebar */}
                        <div className="lg:col-span-4">
                            <div className="sticky top-24 space-y-6">
                                {/* Session Summary */}
                                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                            Session Summary
                                        </h2>
                                        <span className="material-symbols-outlined text-gray-400 dark:text-gray-500">
                                            info
                                        </span>
                                    </div>

                                    {/* Circular Score */}
                                    <div className="flex flex-col items-center justify-center mb-6">
                                        <div className="relative size-32">
                                            <svg
                                                className="size-full -rotate-90"
                                                viewBox="0 0 36 36"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    className="text-gray-200 dark:text-slate-700"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                ></path>
                                                <path
                                                    className="text-slate-600 dark:text-slate-400"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none"
                                                    stroke="currentColor"
                                                        strokeDasharray={`${Math.round(overallScore * 10)}, 100`}
                                                    strokeLinecap="round"
                                                    strokeWidth="2.5"
                                                ></path>
                                            </svg>
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                                <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">
                                                        {overallScore.toFixed(1)}
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                                    Score
                                                </div>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-center text-sm font-medium text-slate-900 dark:text-white">
                                                {overallScore >= 8 ? 'Excellent Performance' : overallScore >= 6 ? 'Strong Performance' : 'Good Attempt'}
                                        </p>
                                        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {questions.length} Questions Answered
                                        </p>
                                    </div>

                                    {/* Role Info */}
                                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 border border-gray-100 dark:border-slate-700 mb-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-white dark:bg-slate-800 p-1.5 rounded-md shadow-sm border border-gray-100 dark:border-slate-700">
                                                <span className="material-symbols-outlined text-slate-600 dark:text-slate-400 text-[20px]">
                                                    code
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">
                                                    Target Role
                                                </p>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                        {sessionData.job_title || 'Interview'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-lg text-center">
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                                                Questions
                                            </p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {questions.length}/{sessionData.total_questions || questions.length}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-lg text-center">
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                                                    Duration
                                            </p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {sessionData.duration_seconds ? `${Math.round(sessionData.duration_seconds / 60)}m` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Coach's Note */}
                                <div className="bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-700 dark:to-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 -mr-8 -mt-8 size-32 rounded-full bg-white opacity-5"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-yellow-300">
                                                auto_awesome
                                            </span>
                                            <h3 className="font-bold text-sm tracking-wide text-yellow-100 uppercase">
                                                Coach's Note
                                            </h3>
                                        </div>
                                        <p className="text-sm leading-relaxed text-white/90">
                                            {summary.verdict || (overallScore >= 8 ? 'Excellent performance! You demonstrated strong technical knowledge and clear communication.' : overallScore >= 6 ? 'Good attempt with room for improvement. Focus on the areas highlighted below.' : 'Keep practicing! Review the feedback and strengthen your fundamentals.')}
                                        </p>
                                        {summary.areas_for_improvement && summary.areas_for_improvement.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/20">
                                                <p className="text-xs text-yellow-100 font-semibold mb-2">Focus Areas:</p>
                                                <ul className="text-xs space-y-1 text-white/80">
                                                    {summary.areas_for_improvement.slice(0, 2).map((area, idx) => (
                                                        <li key={idx}>• {area}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CTA Button */}
                                <button
                                    onClick={() => navigateTo('welcome')}
                                    className="w-full flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-slate-600/20 transition-all transform active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined">add_circle</span>
                                    Start New Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportScreen;

