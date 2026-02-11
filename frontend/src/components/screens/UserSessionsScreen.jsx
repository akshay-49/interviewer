import React, { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';

const UserSessionsScreen = () => {
    const { navigateTo, currentParams } = useInterview();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        loadUserSessions();
    }, [currentParams?.userId]);

    const loadUserSessions = async () => {
        try {
            setLoading(true);
            const userId = currentParams?.userId;
            
            if (!userId) {
                setError('No user ID provided');
                setLoading(false);
                return;
            }

            console.log('Loading sessions for user:', userId);

            const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

            // Fetch user info (admin, fallback to cosmos)
            let userData = null;
            const userResponse = await fetch(`${apiBaseUrl}/auth/admin/users`, {
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (userResponse.ok) {
                userData = await userResponse.json();
            } else {
                const cosmosResponse = await fetch(`${apiBaseUrl}/admin/users-cosmos`);
                if (cosmosResponse.ok) {
                    userData = await cosmosResponse.json();
                }
            }
            if (userData?.users) {
                const user = userData.users.find(u => u.id === userId);
                setUserInfo(user);
            }
            
            // Fetch user sessions
            let response = await fetch(`${apiBaseUrl}/history/admin/user-sessions/${userId}?limit=50`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (response.status === 403) {
                response = await fetch(`${apiBaseUrl}/session/user-history`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId })
                });
            }

            if (!response.ok) {
                throw new Error('Failed to load sessions');
            }

            const data = await response.json();
            console.log('Received sessions:', data);
            
            // Transform sessions
            const transformedSessions = (data || []).map((session, index) => {
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
                    score: Math.round(session.overall_score || 0),
                    verdict: getVerdictForScore(session.overall_score || 0),
                    scoreColor: getScoreColor(session.overall_score || 0),
                    duration: session.duration_seconds ? `${Math.round(session.duration_seconds / 60)}m` : 'N/A',
                    fullData: session
                };
            });
            
            setSessions(transformedSessions);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load sessions:', err);
        } finally {
            setLoading(false);
        }
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

    const avgScore = sessions.length > 0 
        ? Math.round((sessions.reduce((sum, s) => sum + s.score, 0) / sessions.length) * 10)
        : 0;

    return (
        <div className="min-h-screen bg-[#f6f8f8]">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 w-full border-b border-[#e7f1f3] bg-white px-4 md:px-10 py-3 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigateTo('admin-dashboard')}
                            className="p-2 hover:bg-[#e7f1f3] rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <img src="/accellor-logo.svg" alt="Accellor" className="h-8"/>
                            <div className="h-6 w-px bg-[#e7f1f3]"></div>
                            <h2 className="text-[#0d191b] text-lg font-bold">User Sessions</h2>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-10">
                {loading ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                            <p className="mt-4 text-[#4c8e9a] font-semibold">Loading sessions...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-5xl text-red-500">error</span>
                            <p className="mt-4 text-red-600 font-semibold">{error}</p>
                            <button
                                onClick={() => navigateTo('admin-dashboard')}
                                className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* User Info Header */}
                        {userInfo && (
                            <div className="bg-white rounded-xl border border-[#e7f1f3] p-6 mb-6 shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                                        {userInfo.full_name ? userInfo.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '??'}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-[#0d191b]">{userInfo.full_name || 'Unknown User'}</h2>
                                        <p className="text-[#4c8e9a]">{userInfo.email}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            {userInfo.job_title && (
                                                <span className="text-xs bg-[#e7f1f3] px-2 py-1 rounded">
                                                    {userInfo.job_title}
                                                </span>
                                            )}
                                            {userInfo.experience_level && (
                                                <span className="text-xs bg-[#e7f1f3] px-2 py-1 rounded">
                                                    {userInfo.experience_level}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-1 rounded ${userInfo.is_admin ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-700'}`}>
                                                {userInfo.is_admin ? 'Admin' : 'User'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Total Sessions</p>
                                <h3 className="text-3xl font-black mt-2 text-[#0d191b]">{sessions.length}</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Avg. Score</p>
                                <h3 className="text-3xl font-black mt-2 text-[#0d191b]">{avgScore}%</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Best Score</p>
                                <h3 className="text-3xl font-black mt-2 text-primary">
                                    {sessions.length > 0 ? Math.round(Math.max(...sessions.map(s => s.score)) * 10) : 0}%
                                </h3>
                            </div>
                        </div>

                        {/* Sessions Table */}
                        {sessions.length === 0 ? (
                            <div className="bg-white rounded-xl border border-[#e7f1f3] p-12 text-center">
                                <span className="material-symbols-outlined text-5xl text-[#4c8e9a] mb-4">history</span>
                                <h3 className="text-lg font-bold text-[#0d191b] mb-2">No sessions yet</h3>
                                <p className="text-[#4c8e9a]">This user hasn't completed any interviews.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-[#e7f1f3] shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-[#e7f1f3] bg-[#f8fbfc]">
                                    <h3 className="font-bold text-[#0d191b]">Session History</h3>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-[#e7f1f3] bg-[#f8fbfc] text-[#4c8e9a] text-xs font-bold uppercase">
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Job Role</th>
                                                <th className="px-6 py-4">Overall Score</th>
                                                <th className="px-6 py-4">Duration</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e7f1f3]">
                                            {sessions.map((session) => (
                                                <tr key={session.id} className="hover:bg-primary/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-[#0d191b]">
                                                                {session.date}
                                                            </span>
                                                            <span className="text-xs text-[#4c8e9a]">
                                                                {session.time}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-medium text-[#0d191b]">
                                                            {session.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${session.scoreColor} border border-current border-opacity-20`}>
                                                            <span className="size-1.5 rounded-full bg-current opacity-50"></span>
                                                            {session.score}/10 ({session.verdict})
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-[#4c8e9a] flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                                                        {session.duration}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => navigateTo('report', { sessionId: session.session_id })}
                                                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-[#cfe4e7] text-[#4c8e9a] text-xs font-bold hover:bg-primary/5 hover:text-primary transition-all shadow-sm"
                                                        >
                                                            View Report
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default UserSessionsScreen;
