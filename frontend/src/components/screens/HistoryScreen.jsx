import React, { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { historyApi } from '../../utils/api';

const HistoryScreen = () => {
    const { navigateTo, theme } = useInterview();
    const [expandedRow, setExpandedRow] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [allSessions, setAllSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeFilter, setTimeFilter] = useState('all');
    const [showDropdown, setShowDropdown] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(true);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setLoading(true);
            const data = await historyApi.getUserSessions();
            
            console.log('Received from Cosmos DB:', data);
            
            // Transform Cosmos DB data to match UI format
            const transformedSessions = (data || []).map((session, index) => {
                console.log('Transforming session:', session);
                const sessionDate = new Date(session.completed_at || session.started_at);
                return {
                    id: index + 1,
                    session_id: session.session_id,
                    date: sessionDate.toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    }),
                    time: sessionDate.toLocaleTimeString(undefined, { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true
                    }),
                    role: session.job_title || 'Interview',
                    icon: getIconForRole(session.job_title),
                    color: getColorForRole(session.job_title),
                    score: Math.round(session.overall_score || 0),
                    verdict: getVerdictForScore(session.overall_score || 0),
                    scoreColor: getScoreColor(session.overall_score || 0),
                    duration: session.duration_seconds ? `${Math.round(session.duration_seconds / 60)}m` : 'N/A',
                    fullData: session // Store full session data for detail view
                };
            });
            
            console.log('Transformed sessions:', transformedSessions);
            setAllSessions(transformedSessions);
            setSessions(transformedSessions);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const getIconForRole = (role) => {
        if (!role) return 'code';
        if (role.toLowerCase().includes('backend')) return 'dns';
        if (role.toLowerCase().includes('fullstack')) return 'layers';
        if (role.toLowerCase().includes('devops')) return 'cloud_circle';
        if (role.toLowerCase().includes('system')) return 'architecture';
        return 'code';
    };

    const getColorForRole = (role) => {
        if (!role) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
        if (role.toLowerCase().includes('backend')) return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
        if (role.toLowerCase().includes('fullstack')) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
        if (role.toLowerCase().includes('devops')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400';
        if (role.toLowerCase().includes('system')) return 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400';
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    };

    const getVerdictForScore = (score) => {
        if (score >= 9) return 'Excellent';
        if (score >= 8) return 'Great';
        if (score >= 7) return 'Good';
        if (score >= 6) return 'Average';
        return 'Needs Improvement';
    };

    const getScoreColor = (score) => {
        if (score >= 8.5) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
        if (score >= 7) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
        if (score >= 6) return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    };

    const filterByTime = (filter) => {
        setTimeFilter(filter);
        setShowDropdown(false);
        
        if (filter === 'all') {
            setSessions(allSessions);
            return;
        }
        
        const now = new Date();
        const filtered = allSessions.filter(session => {
            const sessionDate = new Date(session.fullData.completed_at || session.fullData.started_at);
            const daysDiff = (now - sessionDate) / (1000 * 60 * 60 * 24);
            
            if (filter === '7d') return daysDiff <= 7;
            if (filter === '30d') return daysDiff <= 30;
            if (filter === '90d') return daysDiff <= 90;
            return true;
        });
        
        setSessions(filtered);
    };

    const getFilterLabel = () => {
        if (timeFilter === '7d') return 'Last 7 Days';
        if (timeFilter === '30d') return 'Last 30 Days';
        if (timeFilter === '90d') return 'Last 90 Days';
        return 'All Time';
    };

    const avgScore = sessions.length > 0 
        ? Math.round((sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length) * 10)
        : 0;

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-y-auto">
                <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-8 w-full">
                    {/* Page Heading */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                Practice History
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-base max-w-xl">
                                Review your past interview sessions, track your scores, and analyze performance reports.
                            </p>
                        </div>
                        <div className="relative">
                            <button 
                                onClick={() => setShowDropdown(!showDropdown)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:border-primary/50 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px] text-slate-400">
                                    calendar_month
                                </span>
                                {getFilterLabel()}
                                <span className="material-symbols-outlined text-[20px] text-slate-400">
                                    arrow_drop_down
                                </span>
                            </button>
                            {showDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                                    {['7d', '30d', '90d', 'all'].map(filter => (
                                        <button
                                            key={filter}
                                            onClick={() => filterByTime(filter)}
                                            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                                timeFilter === filter 
                                                    ? 'bg-primary/10 text-primary dark:text-teal-300' 
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            {filter === '7d' ? 'Last 7 Days' : filter === '30d' ? 'Last 30 Days' : filter === '90d' ? 'Last 90 Days' : 'All Time'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                            Error loading sessions: {error}
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="inline-block">
                                <div className="animate-spin">
                                    <span className="material-symbols-outlined text-4xl text-primary">
                                        autorenew
                                    </span>
                                </div>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mt-4">Loading your interview history...</p>
                        </div>
                    ) : sessions.length === 0 ? (
                        // Empty State
                        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 inline-block mb-4">
                                history
                            </span>
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No interviews yet</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">Start your first interview to see it here.</p>
                            <button
                                onClick={() => navigateTo('welcome')}
                                className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                            >
                                Start Interview
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            {showAnalytics && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                                {/* Total Sessions */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-[80px] text-slate-400">
                                            analytics
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 relative z-10">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">
                                            Total Sessions
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-4xl font-black text-slate-900 dark:text-white">
                                                {sessions.length}
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Average Score */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-[80px] text-slate-400">
                                            donut_large
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 relative z-10">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">
                                            Avg. Score
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-4xl font-black text-slate-900 dark:text-white">
                                                {avgScore}
                                                <span className="text-2xl text-slate-400">%</span>
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Best Score */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <span className="material-symbols-outlined text-[80px] text-slate-400">
                                            emoji_events
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 relative z-10">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">
                                            Best Score
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="text-4xl font-black text-slate-900 dark:text-white">
                                                {Math.round(Math.max(...sessions.map(s => s.score)) * 10)}
                                                <span className="text-2xl text-slate-400">%</span>
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}
                        </>
                    )}

                    {/* Data Table Section */}
                    {!loading && sessions.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Recent Sessions</h3>
                                <button 
                                    onClick={() => setShowAnalytics(!showAnalytics)}
                                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors"
                                >
                                    {showAnalytics ? 'Hide' : 'Show'} Analytics{' '}
                                    <span className="material-symbols-outlined text-[16px]">
                                        {showAnalytics ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20">
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%]">
                                                Date
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[25%]">
                                                Job Role
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%]">
                                                Overall Score
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[15%]">
                                                Duration
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[20%] text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {sessions.map((session) => (
                                            <tr key={session.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                            {session.date}
                                                        </span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {session.time}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg ${session.color}`}>
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                {session.icon}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                            {session.role}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${session.scoreColor} border border-current border-opacity-20`}>
                                                        <span className="size-1.5 rounded-full bg-current opacity-50"></span>
                                                        {session.score}/10 ({session.verdict})
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        schedule
                                                    </span>
                                                    {session.duration}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => navigateTo('report', { sessionId: session.session_id })}
                                                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
                                                    >
                                                        View Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                                <button 
                                    onClick={loadSessions}
                                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold transition-colors"
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default HistoryScreen;
