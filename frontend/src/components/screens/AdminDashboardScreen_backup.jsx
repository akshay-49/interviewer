import React, { useEffect, useState } from 'react';

const AdminDashboardScreen = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState('');

    const loadUsers = async (signal) => {
        setUsersLoading(true);
        setUsersError('');
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://localhost:8000/auth/admin/users', {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                signal,
            });

            if (!response.ok) {
                throw new Error('Failed to load users');
            }

            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            if (err.name !== 'AbortError') {
                setUsersError(err.message || 'Failed to load users');
            }
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        loadUsers(controller.signal);
        return () => controller.abort();
    }, []);

    return (
        <div className="bg-background-light text-text-main transition-colors duration-200 h-full">
            <div className="flex h-full overflow-hidden">
                <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} bg-sidebar-light border-r border-card-border flex flex-col transition-all duration-300`}>
                    <div className="p-6">
                        <div className="mb-10 flex items-center justify-between">
                            <div className={sidebarCollapsed ? 'hidden' : ''}>
                                <img 
                                    src="/accellor-logo.svg" 
                                    alt="Accellor" 
                                    className="h-10 mb-2"
                                />
                                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">Admin</p>
                            </div>
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="text-text-muted hover:text-text-main transition-colors p-1 rounded-lg hover:bg-white/50"
                                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            >
                                <span className="material-symbols-outlined">
                                    {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
                                </span>
                            </button>
                        </div>
                        <nav className="flex flex-col gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:bg-white/50 hover:text-text-main'}`}
                                title="Overview"
                            >
                                <span className="material-symbols-outlined">dashboard</span>
                                {!sidebarCollapsed && <span className={`text-sm ${activeTab === 'overview' ? 'font-bold' : 'font-semibold'}`}>Overview</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('users')}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${activeTab === 'users' ? 'bg-white text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:bg-white/50 hover:text-text-main'}`}
                                title="User Management"
                            >
                                <span className="material-symbols-outlined">group</span>
                                {!sidebarCollapsed && <span className={`text-sm ${activeTab === 'users' ? 'font-bold' : 'font-semibold'}`}>User Management</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('questions')}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${activeTab === 'questions' ? 'bg-white text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:bg-white/50 hover:text-text-main'}`}
                                title="Question Bank"
                            >
                                <span className="material-symbols-outlined">quiz</span>
                                {!sidebarCollapsed && <span className={`text-sm ${activeTab === 'questions' ? 'font-bold' : 'font-semibold'}`}>Question Bank</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('analytics')}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-white text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:bg-white/50 hover:text-text-main'}`}
                                title="Analytics"
                            >
                                <span className="material-symbols-outlined">bar_chart</span>
                                {!sidebarCollapsed && <span className={`text-sm ${activeTab === 'analytics' ? 'font-bold' : 'font-semibold'}`}>Analytics</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('settings')}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white text-primary shadow-sm border border-card-border/50' : 'text-text-muted hover:bg-white/50 hover:text-text-main'}`}
                                title="System Settings"
                            >
                                <span className="material-symbols-outlined">settings</span>
                                {!sidebarCollapsed && <span className={`text-sm ${activeTab === 'settings' ? 'font-bold' : 'font-semibold'}`}>System Settings</span>}
                            </button>
                        </nav>
                    </div>
                    <div className="mt-auto p-6 border-t border-card-border">
                        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                            <div
                                className="size-10 rounded-full bg-cover bg-center border-2 border-white shadow-sm"
                                style={{
                                    backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDTC4ZpPhiK_8GYbt5ZXQ2pbqRyLvqnoEpQLGewX7qSLE5aR2jT9_mwEvuq8vrkp9N8gERgzWNE9dcSHnZ-TZgu97z8xT3kuceUnH1K_PBEGH8AecP8MQZv5yM4LhLYZT0DM470gzH1vPLfjxP5otS-fE2gKnsL2DEKZpBPsJifazeBM7_YnDV6-6h6pREwptbiDfLuz90GOSzfAUzJGVou2T2I-vhxwZ8804TK3OD7WlwmNaPBhrCSQ-sg1b6tZM72xgXfnQbXkon7")'
                                }}
                            ></div>
                            {!sidebarCollapsed && (
                                <>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-text-main">Alex Johnson</span>
                                        <span className="text-xs text-text-muted">System Admin</span>
                                    </div>
                                    <button className="ml-auto text-text-muted hover:text-red-500 transition-colors">
                                        <span className="material-symbols-outlined">logout</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </aside>
                <main className="flex-1 flex flex-col overflow-y-auto bg-background-light">
                    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-md border-b border-card-border">
                        <div className="flex items-center gap-6 flex-1">
                            <h2 className="text-xl font-extrabold text-text-main hidden md:block">
                                {activeTab === 'overview' && 'Dashboard Overview'}
                                {activeTab === 'users' && 'User Management'}
                                {activeTab === 'questions' && 'Question Bank'}
                                {activeTab === 'analytics' && 'Analytics'}
                                {activeTab === 'settings' && 'System Settings'}
                            </h2>
                            <div className="relative max-w-md w-full">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">search</span>
                                <input className="w-full bg-slate-100 border-none rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary/50 text-sm transition-all text-text-main placeholder-text-muted/60" placeholder="Search users, sessions, or reports..." type="text" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button className="relative p-2 bg-slate-100 rounded-lg text-text-muted hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                            <button className="p-2 bg-slate-100 rounded-lg text-text-muted hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">help_outline</span>
                            </button>
                            <div className="h-8 w-px bg-card-border"></div>
                            <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/25 hover:brightness-105 transition-all">
                                <span className="material-symbols-outlined text-sm">add</span>
                                <span>New Interview</span>
                            </button>
                        </div>
                    </header>
                    <div className="p-8 space-y-10 max-w-[1600px] mx-auto w-full">
                        {activeTab === 'overview' && (
                            <>
                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-3xl font-black tracking-tight text-text-main">Platform Insights</p>
                                        <p className="text-text-muted font-medium">Real-time performance metrics and active voice sessions.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-text-main hover:bg-slate-50 shadow-sm transition-all">
                                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                                            <span>Last 30 Days</span>
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-card-border rounded-lg text-sm font-bold text-text-main hover:bg-slate-50 shadow-sm transition-all">
                                            <span className="material-symbols-outlined text-sm">download</span>
                                            <span>Export Data</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="bg-white p-6 rounded-xl border border-card-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                <span className="material-symbols-outlined">person</span>
                                            </div>
                                            <span className="text-[#059669] text-xs font-bold px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full">+12.5%</span>
                                        </div>
                                        <p className="text-text-muted text-sm font-semibold mb-1">Total Users</p>
                                        <p className="text-3xl font-bold tracking-tight text-text-main">24,892</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl border border-card-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                                <span className="material-symbols-outlined">mic</span>
                                            </div>
                                            <span className="text-[#059669] text-xs font-bold px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full">+8.2%</span>
                                        </div>
                                        <p className="text-text-muted text-sm font-semibold mb-1">Interviews Conducted</p>
                                        <p className="text-3xl font-bold tracking-tight text-text-main">12,450</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl border border-card-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                                <span className="material-symbols-outlined">star</span>
                                            </div>
                                            <span className="text-[#dc2626] text-xs font-bold px-2.5 py-1 bg-red-50 border border-red-100 rounded-full">-2.1%</span>
                                        </div>
                                        <p className="text-text-muted text-sm font-semibold mb-1">Avg. Performance Score</p>
                                        <p className="text-3xl font-bold tracking-tight text-text-main">82.4%</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl border border-card-border shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                                <span className="material-symbols-outlined">dns</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                <span className="text-emerald-700 text-xs font-bold uppercase tracking-wider">Stable</span>
                                            </div>
                                        </div>
                                        <p className="text-text-muted text-sm font-semibold mb-1">System Health</p>
                                        <p className="text-3xl font-bold tracking-tight text-text-main">99.98%</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 bg-white rounded-xl border border-card-border p-6 shadow-sm">
                                        <div className="flex items-center justify-between mb-8">
                                            <div>
                                                <h3 className="text-lg font-bold text-text-main">Interview Trends</h3>
                                                <p className="text-sm text-text-muted">Weekly growth in voice-first sessions</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-3xl font-bold text-primary">3,420</p>
                                                <p className="text-xs text-emerald-600 font-bold uppercase tracking-tighter">Sessions this week</p>
                                            </div>
                                        </div>
                                        <div className="relative h-64 w-full">
                                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                                                <defs>
                                                    <linearGradient id="gradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                                        <stop offset="0%" stopColor="#13cbec" stopOpacity="0.3"></stop>
                                                        <stop offset="100%" stopColor="#13cbec" stopOpacity="0"></stop>
                                                    </linearGradient>
                                                </defs>
                                                <path d="M0,40 L0,25 C10,22 15,35 25,30 C35,25 45,10 55,15 C65,20 75,5 85,8 C95,11 100,2 100,2 L100,40 Z" fill="url(#gradient)"></path>
                                                <path d="M0,25 C10,22 15,35 25,30 C35,25 45,10 55,15 C65,20 75,5 85,8 C95,11 100,2 100,2" fill="none" stroke="#13cbec" strokeLinecap="round" strokeWidth="1.5"></path>
                                            </svg>
                                        </div>
                                        <div className="flex justify-between mt-6 px-2">
                                            <span className="text-xs font-bold text-text-muted">Mon</span>
                                            <span className="text-xs font-bold text-text-muted">Tue</span>
                                            <span className="text-xs font-bold text-text-muted">Wed</span>
                                            <span className="text-xs font-bold text-text-muted">Thu</span>
                                            <span className="text-xs font-bold text-text-muted">Fri</span>
                                            <span className="text-xs font-bold text-text-muted">Sat</span>
                                            <span className="text-xs font-bold text-text-muted">Sun</span>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl border border-card-border p-6 shadow-sm flex flex-col">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-text-main">Recent Activity</h3>
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded">Live Feed</span>
                                        </div>
                                        <div className="space-y-6 overflow-y-auto max-h-[420px] pr-2">
                                            <div className="flex gap-4">
                                                <div className="size-10 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                                    <span className="material-symbols-outlined text-sm">person_add</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-text-main">New user signup</p>
                                                    <p className="text-xs text-text-muted leading-relaxed">Sarah Williams joined the platform as a Candidate.</p>
                                                    <span className="text-[10px] text-slate-400 font-semibold mt-1">2 mins ago</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="size-10 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-text-main">Interview Completed</p>
                                                    <p className="text-xs text-text-muted leading-relaxed">Jordan Smith finished Senior Developer interview with 88% score.</p>
                                                    <span className="text-[10px] text-slate-400 font-semibold mt-1">15 mins ago</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="size-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                                                    <span className="material-symbols-outlined text-sm">mic</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-text-main">Session Started</p>
                                                    <p className="text-xs text-text-muted leading-relaxed">Active session: AI Voice screening for UX Research role.</p>
                                                    <span className="text-[10px] text-slate-400 font-semibold mt-1">42 mins ago</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="size-10 shrink-0 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                                                    <span className="material-symbols-outlined text-sm">warning</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-text-main">System Maintenance</p>
                                                    <p className="text-xs text-text-muted leading-relaxed">Database cleanup scheduled for tonight at 02:00 AM.</p>
                                                    <span className="text-[10px] text-slate-400 font-semibold mt-1">1 hour ago</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="mt-auto pt-6 w-full py-2 bg-slate-50 text-xs font-bold text-text-muted rounded-lg border border-card-border hover:bg-slate-100 transition-colors">
                                            View All Activity
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl border border-card-border p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-main">Live AI Interviews</h3>
                                            <p className="text-sm text-text-muted">Real-time status of ongoing candidate screenings</p>
                                        </div>
                                        <span className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-4 py-1.5 rounded-full">
                                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                            Live Now: 14
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="text-[11px] text-text-muted uppercase font-bold tracking-widest border-b border-card-border">
                                                <tr>
                                                    <th className="pb-4 pr-4">Candidate</th>
                                                    <th className="pb-4 px-4">Role</th>
                                                    <th className="pb-4 px-4">Stage</th>
                                                    <th className="pb-4 px-4">Voice Quality</th>
                                                    <th className="pb-4 pl-4 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-card-border">
                                                <tr className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-5 pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="size-10 rounded-full bg-slate-100 bg-cover bg-center border border-card-border shadow-sm"
                                                                style={{
                                                                    backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAL7-Hbn0GdzGrfagqKvdZY5vZI7I0wujgzuXpHTuHCsDQMmoX5N72j64En2hcYs-2-iXroB6lJWm2lgMmvjHTuRKmccRzSoQErOl8ZvXVcFjk8wh90BtnwalZvwx0GFiNC3OwRsyOUglxuBNiLSAfQztmG4wpG9epXzut241fjYVwFFt2Jt9GyPxDx8L6zLf9mqc0IOw1mcDzGpC59x087ekGfKAt7p4k6kX5C57KRvX8j3tL2n7Ts7KhIcMBgMbV9SLm0vDOFqsk3")'
                                                                }}
                                                            ></div>
                                                            <div>
                                                                <p className="text-sm font-bold text-text-main">Eleanor Pena</p>
                                                                <p className="text-[10px] text-text-muted font-medium">Joined 4m ago</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-4 text-sm font-medium text-text-main">Product Manager</td>
                                                    <td className="py-5 px-4">
                                                        <span className="text-[10px] font-bold px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md uppercase tracking-wider">Speaking</span>
                                                    </td>
                                                    <td className="py-5 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary" style={{ width: '75%' }}></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-text-main">75%</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 pl-4 text-right">
                                                        <button className="text-text-muted hover:text-primary transition-colors p-2 rounded-lg hover:bg-white shadow-sm hover:shadow-md">
                                                            <span className="material-symbols-outlined">monitoring</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                                <tr className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-5 pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="size-10 rounded-full bg-slate-100 bg-cover bg-center border border-card-border shadow-sm"
                                                                style={{
                                                                    backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB0g43r2Q1IxWKG-Ct7gtGzix_tzl3SNPTj-hNismD4mY0qiMg8FfYY7ghpif8LjmHozAiWmneMDjqSUdXCdDebN58OyJ0cW5ntrFCRQOC0hCVbVHpDB-26l-oHndO3Pn7A1AOqEufqyNzRF0IuNMstRnhju-Txw2sMAPmWHVwQgeq0BcdlbnjF9InWd8s2ylT1cpxao_FErEWH6pa4Ax0_3o_tJHP_brzZHLG-dEudK8h6yEtuirnWoILGq__ugIzlQsVjkM8cbdeO")'
                                                                }}
                                                            ></div>
                                                            <div>
                                                                <p className="text-sm font-bold text-text-main">Robert Fox</p>
                                                                <p className="text-[10px] text-text-muted font-medium">Joined 12m ago</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-4 text-sm font-medium text-text-main">Data Analyst</td>
                                                    <td className="py-5 px-4">
                                                        <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-md uppercase tracking-wider">Processing</span>
                                                    </td>
                                                    <td className="py-5 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary" style={{ width: '92%' }}></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-text-main">92%</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 pl-4 text-right">
                                                        <button className="text-text-muted hover:text-primary transition-colors p-2 rounded-lg hover:bg-white shadow-sm hover:shadow-md">
                                                            <span className="material-symbols-outlined">monitoring</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'users' && (
                            <div className="space-y-6">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-2xl font-black tracking-tight text-text-main">User Management</h3>
                                    <p className="text-text-muted font-medium">Invite candidates and manage existing users.</p>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                    <aside className="lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-card-border p-6 shadow-sm">
                                        <div className="flex items-center gap-2 mb-6">
                                            <span className="material-symbols-outlined text-primary">person_add</span>
                                            <h2 className="text-xl font-bold">Invite New Candidate</h2>
                                        </div>
                                        <form className="flex flex-col gap-5">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-text-main">Full Name</label>
                                                <input className="w-full h-12 px-4 rounded-lg border border-card-border bg-slate-50 text-text-main focus:ring-2 focus:ring-primary focus:border-primary transition-all" placeholder="Sarah Jenkins" type="text" />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-text-main">Email Address</label>
                                                <input className="w-full h-12 px-4 rounded-lg border border-card-border bg-slate-50 text-text-main focus:ring-2 focus:ring-primary focus:border-primary transition-all" placeholder="sarah.j@example.com" type="email" />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-text-main">Seniority Level</label>
                                                <div className="relative">
                                                    <select className="w-full h-12 pl-4 pr-10 appearance-none rounded-lg border border-card-border bg-slate-50 text-text-main focus:ring-2 focus:ring-primary focus:border-primary transition-all">
                                                        <option>Junior</option>
                                                        <option>Middle</option>
                                                        <option selected>Senior</option>
                                                        <option>Lead</option>
                                                    </select>
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-text-muted pointer-events-none">unfold_more</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-text-main">Interview Type</label>
                                                <div className="flex gap-4">
                                                    <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all group">
                                                        <input defaultChecked className="text-primary focus:ring-primary" name="int-type" type="radio" />
                                                        <span className="material-symbols-outlined text-primary">videocam</span>
                                                        <span className="text-sm font-semibold">Video Call</span>
                                                    </label>
                                                    <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-card-border cursor-pointer hover:bg-slate-50 transition-all group">
                                                        <input className="text-primary focus:ring-primary" name="int-type" type="radio" />
                                                        <span className="material-symbols-outlined text-text-muted">call</span>
                                                        <span className="text-sm font-semibold text-text-muted">Audio Call</span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-bold text-text-main">Job Description / Notes</label>
                                                <textarea className="w-full h-32 p-4 rounded-lg border border-card-border bg-slate-50 text-text-main focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none" placeholder="Paste the JD here or add specific interview notes for the recruiter..."></textarea>
                                                <button className="flex items-center gap-2 text-primary text-xs font-bold hover:underline" type="button">
                                                    <span className="material-symbols-outlined text-sm">upload_file</span>
                                                    Upload JD Document instead
                                                </button>
                                            </div>
                                            <button className="w-full h-14 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-lg mt-2" type="submit">
                                                <span className="material-symbols-outlined">send</span>
                                                Send Invitation
                                            </button>
                                        </form>
                                    </aside>
                                    <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="bg-white p-5 rounded-xl border border-card-border shadow-sm">
                                                <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Total Users</p>
                                                <h3 className="text-2xl font-black mt-1">{users.length}</h3>
                                            </div>
                                            <div className="bg-white p-5 rounded-xl border border-card-border shadow-sm">
                                                <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Admins</p>
                                                <h3 className="text-2xl font-black mt-1 text-primary">
                                                    {users.filter((u) => u.is_admin).length}
                                                </h3>
                                            </div>
                                            <div className="bg-white p-5 rounded-xl border border-card-border shadow-sm">
                                                <p className="text-text-muted text-xs font-bold uppercase tracking-wider">Active</p>
                                                <h3 className="text-2xl font-black mt-1 text-green-500">
                                                    {users.filter((u) => u.is_active).length}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-xl border border-card-border overflow-hidden shadow-sm">
                                            <div className="p-6 border-b border-card-border flex flex-col sm:flex-row justify-between items-center gap-4">
                                                <h3 className="text-lg font-bold">Current Users</h3>
                                                <div className="flex gap-2">
                                                    <button className="p-2 border border-card-border rounded hover:bg-slate-50">
                                                        <span className="material-symbols-outlined text-xl">filter_list</span>
                                                    </button>
                                                    <button 
                                                        className="p-2 border border-card-border rounded hover:bg-slate-50"
                                                        onClick={() => loadUsers()}
                                                        disabled={usersLoading}
                                                    >
                                                        <span className="material-symbols-outlined text-xl">refresh</span>
                                                    </button>
                                                </div>
                                            </div>
                                            {usersLoading ? (
                                                <div className="p-6 text-sm text-text-muted">Loading users...</div>
                                            ) : usersError ? (
                                                <div className="p-6 text-sm text-red-600">{usersError}</div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="bg-slate-50 text-text-muted text-xs font-bold uppercase">
                                                                <th className="px-6 py-4">User</th>
                                                                <th className="px-6 py-4">Role</th>
                                                                <th className="px-6 py-4">Status</th>
                                                                <th className="px-6 py-4">Provider</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-card-border">
                                                            {users.map((user) => {
                                                                const initials = (user.full_name || user.email || '?')
                                                                    .split(' ')
                                                                    .map((part) => part[0])
                                                                    .slice(0, 2)
                                                                    .join('')
                                                                    .toUpperCase();
                                                                return (
                                                                    <tr key={user.id} className="hover:bg-primary/5 transition-colors group">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="size-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{initials}</div>
                                                                                <div>
                                                                                    <p className="font-bold text-sm">{user.full_name || user.email}</p>
                                                                                    <p className="text-xs text-text-muted">{user.email}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className="text-[10px] font-bold uppercase rounded-full px-2 py-1 bg-primary/10 text-primary">
                                                                                {user.is_admin ? 'Admin' : 'User'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-1 ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                                {user.is_active ? 'Active' : 'Inactive'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className="text-xs font-semibold text-text-muted">
                                                                                {user.auth_provider || 'local'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                            {!usersLoading && !usersError && users.length === 0 && (
                                                <div className="p-6 text-sm text-text-muted">No users found.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab !== 'overview' && activeTab !== 'users' && (
                            <div className="bg-white rounded-xl border border-card-border p-8 shadow-sm">
                                <p className="text-text-muted text-sm">This section is coming soon.</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminDashboardScreen;
