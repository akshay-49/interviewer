<<<<<<< HEAD
import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const ReportScreen = () => {
    const { navigateTo } = useInterview();
    const [expandedQuestion, setExpandedQuestion] = useState(0);

    const questions = [
        {
            id: 1,
            question: 'Explain the concept of closures in JavaScript and how they relate to scope.',
            duration: '02:14',
            status: 'excellent',
            fillerWords: { um: 3, basically: 2, pace: '145 wpm' },
            strengths: [
                'Excellent definition of lexical scoping context.',
                'Correctly identified the primary use case for data privacy.',
            ],
            improvements: [
                'Could articulate the memory management implications more clearly.',
                'Avoid using filler words like "basically" at the start of sentences.',
                'Synonym Tip: Try varying your vocabulary. Instead of repeating "use", consider "leverage" or "implement" to sound more polished.',
            ],
        },
        {
            id: 2,
            question: 'What is the difference between specificity in CSS and inheritance?',
            duration: '01:45',
            status: 'strong',
            fillerWords: { um: 1, like: 1 },
        },
        {
            id: 3,
            question: 'How do you handle error boundaries in React components?',
            duration: '00:58',
            status: 'needs-review',
            fillerWords: { um: 5, 'you know': 3 },
        },
        {
            id: 4,
            question: 'Describe a situation where you had to optimize a slow-loading web page.',
            duration: '02:12',
            status: 'strong',
            fillerWords: { um: 0 },
        },
    ];

    const getStatusBadge = (status) => {
=======
import React, { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { historyApi } from '../../utils/api';

const ReportScreen = () => {
    const { navigateTo, currentParams } = useInterview();
    const [expandedQuestion, setExpandedQuestion] = useState(0);
    const [sessionData, setSessionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    const loadSessionData = async () => {
        try {
            setLoading(true);
            const sessionId = currentParams?.sessionId;
            
            if (!sessionId) {
                setError('No session ID provided');
                setLoading(false);
                return;
            }

            console.log('Loading session data for:', sessionId);
            const session = await historyApi.getSessionDetails(sessionId);
            console.log('Session data loaded:', session);
            setSessionData(session);
            setError(null);
        } catch (err) {
            console.error('Failed to load session:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (score) => {
>>>>>>> two
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
<<<<<<< HEAD
        return { badge: badges[status], label: labels[status] };
    };

    return (
        <div className="bg-white dark:bg-slate-900 font-display h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-600/10 p-1.5 rounded-lg text-slate-600 dark:text-slate-400">
                                <span className="material-symbols-outlined">mic_none</span>
                            </div>
                            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                InterviewPrep.ai
                            </span>
                        </div>
                        <button
                            onClick={() => navigateTo('history')}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumb & Heading */}
                    <div className="mb-8">
                        <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3 space-x-2">
                            <button
                                onClick={() => navigateTo('history')}
                                className="hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                History
                            </button>
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">Session Review #42</span>
                        </nav>
=======
        
        let status = 'needs-review';
        if (score >= 8) status = 'excellent';
        else if (score >= 6) status = 'strong';
        
        return { badge: badges[status], label: labels[status], status };
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
                <p className="text-red-600">{error || 'Failed to load session'}</p>
                <button
                    onClick={() => navigateTo('history')}
                    className="mt-4 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                    Back to History
                </button>
            </div>
        );
    }

    const questions = sessionData.question_wise_feedback || [];
    const summary = sessionData.summary || {};
    const overallScore = sessionData.overall_score || 0;

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
                                    onClick={() => navigateTo('history')}
                                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                                >
                                    History
                                </button>
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    {sessionData.job_title || 'Interview Session'}
                                </span>
                            </nav>
                            <button
                                onClick={() => navigateTo('history')}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
>>>>>>> two
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    Session Review
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
<<<<<<< HEAD
                                    Completed on Oct 24, 2023 • 15m 30s Duration
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm">
                                    <span className="material-symbols-outlined text-[20px]">ios_share</span>
                                    Share
                                </button>
                                <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                                    Download PDF Report
                                </button>
=======
                                    Completed on {new Date(sessionData.completed_at).toLocaleDateString(undefined, { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })} • {sessionData.duration_seconds ? Math.round(sessionData.duration_seconds / 60) : 0}m Duration
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
>>>>>>> two
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Questions Section */}
                        <div className="lg:col-span-8 space-y-4">
<<<<<<< HEAD
                            {questions.map((q, index) => {
                                const { badge, label } = getStatusBadge(q.status);
                                const isExpanded = expandedQuestion === q.id;

                                return (
                                    <div
                                        key={q.id}
                                        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden group"
                                    >
                                        <div
                                            onClick={() =>
                                                setExpandedQuestion(isExpanded ? null : q.id)
                                            }
                                            className="p-5 flex items-start gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700"
                                        >
                                            <div className={`flex-shrink-0 size-8 rounded-full ${badge} flex items-center justify-center font-bold text-sm border`}>
                                                Q{q.id}
                                            </div>
                                            <div className="flex-grow pt-1">
                                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                                                    {q.question}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge}`}>
                                                        {label}
                                                    </span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                                        • {q.duration}
                                                    </span>
                                                    {Object.entries(q.fillerWords).map(([word, count]) => (
                                                        <span
                                                            key={word}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold border border-gray-200 dark:border-slate-600"
                                                        >
                                                            {word}: {count}x
                                                        </span>
                                                    ))}
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
                                        {isExpanded && q.strengths && (
                                            <div className="p-6 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700">
                                                {/* Waveform & Audio */}
                                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 mb-6">
                                                    <button className="size-12 rounded-full bg-slate-600 hover:bg-slate-700 text-white flex items-center justify-center transition-colors shadow-lg flex-shrink-0">
                                                        <span className="material-symbols-outlined text-[28px] ml-1">
                                                            play_arrow
                                                        </span>
                                                    </button>
                                                    <div className="flex-grow w-full">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                                Your Answer
                                                            </span>
                                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                                00:00 / {q.duration}
                                                            </span>
                                                        </div>
                                                        <div className="h-10 flex items-center justify-center gap-1 opacity-80">
                                                            {[40, 70, 50, 90, 60, 30, 80, 50, 100, 60, 40, 30, 50, 20, 40, 60, 30, 40].map(
                                                                (height, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="w-1.5 bg-slate-600 dark:bg-slate-400 rounded-full"
                                                                        style={{
                                                                            height: `${height}%`,
                                                                        }}
                                                                    ></div>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold bg-white dark:bg-slate-800 px-3 py-1.5 rounded border border-gray-200 dark:border-slate-600 transition-colors">
                                                        1.5x
                                                    </button>
                                                </div>

                                                {/* Strengths & Improvements */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="material-symbols-outlined text-green-700 dark:text-green-400">
                                                                check_circle
                                                            </span>
                                                            <h4 className="font-bold text-green-700 dark:text-green-400 text-sm uppercase tracking-wide">
                                                                Strengths
                                                            </h4>
                                                        </div>
                                                        <ul className="space-y-3">
                                                            {q.strengths.map((strength, i) => (
                                                                <li
                                                                    key={i}
                                                                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                                                                >
                                                                    <span className="mt-1.5 size-1.5 rounded-full bg-green-600 dark:bg-green-400 flex-shrink-0"></span>
                                                                    <span>{strength}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-5">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <span className="material-symbols-outlined text-amber-700 dark:text-amber-400">
                                                                lightbulb
                                                            </span>
                                                            <h4 className="font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wide">
                                                                Improvements
                                                            </h4>
                                                        </div>
                                                        <ul className="space-y-3">
                                                            {q.improvements.map((improvement, i) => (
                                                                <li
                                                                    key={i}
                                                                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                                                                >
                                                                    <span className="mt-1.5 size-1.5 rounded-full bg-amber-600 dark:bg-amber-400 flex-shrink-0"></span>
                                                                    <span>{improvement}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 mr-auto">
                                                        Recorded via Microphone
                                                    </span>
                                                    <button className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            replay
                                                        </span>
                                                        Retake this Question
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
=======
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
>>>>>>> two
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
<<<<<<< HEAD
                                                    strokeDasharray="80, 100"
=======
                                                        strokeDasharray={`${Math.round(overallScore * 10)}, 100`}
>>>>>>> two
                                                    strokeLinecap="round"
                                                    strokeWidth="2.5"
                                                ></path>
                                            </svg>
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                                <div className="text-3xl font-bold text-slate-600 dark:text-slate-400">
<<<<<<< HEAD
                                                    8.0
=======
                                                        {overallScore.toFixed(1)}
>>>>>>> two
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                                    Score
                                                </div>
                                            </div>
                                        </div>
                                        <p className="mt-4 text-center text-sm font-medium text-slate-900 dark:text-white">
<<<<<<< HEAD
                                            Strong Technical Aptitude
                                        </p>
                                        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            Top 15% of candidates
=======
                                                {overallScore >= 8 ? 'Excellent Performance' : overallScore >= 6 ? 'Strong Performance' : 'Good Attempt'}
                                        </p>
                                        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {questions.length} Questions Answered
>>>>>>> two
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
<<<<<<< HEAD
                                                    Frontend Intern
=======
                                                        {sessionData.job_title || 'Interview'}
>>>>>>> two
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
<<<<<<< HEAD
                                                4/5
=======
                                                    {questions.length}/{sessionData.total_questions || questions.length}
>>>>>>> two
                                            </p>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-lg text-center">
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
<<<<<<< HEAD
                                                Avg Pace
                                            </p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                130wpm
=======
                                                    Duration
                                            </p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                    {sessionData.duration_seconds ? `${Math.round(sessionData.duration_seconds / 60)}m` : 'N/A'}
>>>>>>> two
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
<<<<<<< HEAD
                                            "Great job articulating complex concepts in Q1. Focus on reducing filler words in Q3 to improve clarity and confidence."
                                        </p>
=======
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
>>>>>>> two
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
