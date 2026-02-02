import React, { useEffect, useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const AdminDashboardScreen = () => {
    const { navigateTo } = useInterview();
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

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-[#f6f8f8]">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 w-full border-b border-[#e7f1f3] bg-white px-4 md:px-10 py-3 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between whitespace-nowrap">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <img src="/accellor-logo.svg" alt="Accellor" className="h-8"/>
                            <div className="h-6 w-px bg-[#e7f1f3]"></div>
                            <h2 className="text-[#0d191b] text-lg font-bold">Admin Portal</h2>
                        </div>
                        <nav className="hidden md:flex items-center gap-6">
                            <button 
                                onClick={() => setActiveTab('overview')}
                                className={`text-sm font-semibold transition-colors ${activeTab === 'overview' ? 'text-primary font-bold' : 'text-[#4c8e9a] hover:text-primary'}`}
                            >
                                Dashboard
                            </button>
                            <button 
                                onClick={() => setActiveTab('users')}
                                className={`text-sm font-semibold transition-colors ${activeTab === 'users' ? 'text-primary font-bold' : 'text-[#4c8e9a] hover:text-primary'}`}
                            >
                                Users
                            </button>
                            <button 
                                onClick={() => setActiveTab('analytics')}
                                className={`text-sm font-semibold transition-colors ${activeTab === 'analytics' ? 'text-primary font-bold' : 'text-[#4c8e9a] hover:text-primary'}`}
                            >
                                Analytics
                            </button>
                            <button 
                                onClick={() => setActiveTab('settings')}
                                className={`text-sm font-semibold transition-colors ${activeTab === 'settings' ? 'text-primary font-bold' : 'text-[#4c8e9a] hover:text-primary'}`}
                            >
                                Settings
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden lg:block">
                            <label className="relative flex items-center w-64 h-10">
                                <span className="absolute left-3 text-[#4c8e9a] material-symbols-outlined text-[20px]">search</span>
                                <input 
                                    className="w-full h-full pl-10 pr-4 rounded-lg border-none bg-[#e7f1f3] text-[#0d191b] placeholder:text-[#4c8e9a] text-sm focus:ring-2 focus:ring-primary" 
                                    placeholder="Search users, sessions..." 
                                    type="text"
                                />
                            </label>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-2 text-[#4c8e9a] hover:bg-[#e7f1f3] rounded-full transition-all">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                            <div 
                                className="size-10 rounded-full bg-cover bg-center border-2 border-primary/20" 
                                style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDTC4ZpPhiK_8GYbt5ZXQ2pbqRyLvqnoEpQLGewX7qSLE5aR2jT9_mwEvuq8vrkp9N8gERgzWNE9dcSHnZ-TZgu97z8xT3kuceUnH1K_PBEGH8AecP8MQZv5yM4LhLYZT0DM470gzH1vPLfjxP5otS-fE2gKnsL2DEKZpBPsJifazeBM7_YnDV6-6h6pREwptbiDfLuz90GOSzfAUzJGVou2T2I-vhxwZ8804TK3OD7WlwmNaPBhrCSQ-sg1b6tZM72xgXfnQbXkon7")'}}
                            ></div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-10">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <>
                        {/* Page Heading */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-[#0d191b] text-3xl font-black leading-tight tracking-tight">Platform Overview</h1>
                                <p className="text-[#4c8e9a] text-base font-normal">Monitor system performance and user activity.</p>
                            </div>
                            <div className="flex gap-3">
                                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e7f1f3] text-[#0d191b] text-sm font-bold hover:bg-[#d8e8eb] transition-all">
                                    <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                                    Last 30 Days
                                </button>
                                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all">
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                    Export Report
                                </button>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Total Users</p>
                                <h3 className="text-3xl font-black mt-2 text-[#0d191b]">{users.length}</h3>
                                <p className="text-xs text-emerald-600 font-semibold mt-1">+12% this month</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Active Sessions</p>
                                <h3 className="text-3xl font-black mt-2 text-primary">24</h3>
                                <p className="text-xs text-[#4c8e9a] font-semibold mt-1">Live now</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Interviews Today</p>
                                <h3 className="text-3xl font-black mt-2 text-[#0d191b]">156</h3>
                                <p className="text-xs text-emerald-600 font-semibold mt-1">+8% vs yesterday</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">System Health</p>
                                <h3 className="text-3xl font-black mt-2 text-green-500">99.9%</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-xs text-green-600 font-bold uppercase">Operational</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl border border-[#e7f1f3] shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 p-3 hover:bg-[#f8fbfc] rounded-lg transition-colors">
                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">New user registered</p>
                                        <p className="text-xs text-[#4c8e9a]">2 minutes ago</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-3 hover:bg-[#f8fbfc] rounded-lg transition-colors">
                                    <div className="size-10 rounded-full bg-green-50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-green-600 text-[20px]">check_circle</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">Interview completed</p>
                                        <p className="text-xs text-[#4c8e9a]">15 minutes ago</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-3 hover:bg-[#f8fbfc] rounded-lg transition-colors">
                                    <div className="size-10 rounded-full bg-amber-50 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-amber-600 text-[20px]">schedule</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">System backup completed</p>
                                        <p className="text-xs text-[#4c8e9a]">1 hour ago</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <>
                        {/* Page Heading */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-[#0d191b] text-3xl font-black leading-tight tracking-tight">User Management</h1>
                                <p className="text-[#4c8e9a] text-base font-normal">Manage user accounts and permissions.</p>
                            </div>
                            <div className="flex gap-3">
                                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e7f1f3] text-[#0d191b] text-sm font-bold hover:bg-[#d8e8eb] transition-all">
                                    <span className="material-symbols-outlined text-[18px]">filter_list</span>
                                    Filter
                                </button>
                                <button 
                                    onClick={() => navigateTo('invite-candidate')}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                                    Invite User
                                </button>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Total Users</p>
                                <h3 className="text-2xl font-black mt-1">{users.length}</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Active</p>
                                <h3 className="text-2xl font-black mt-1 text-green-500">{users.filter(u => u.is_active).length}</h3>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Admins</p>
                                <h3 className="text-2xl font-black mt-1 text-primary">{users.filter(u => u.is_admin).length}</h3>
                            </div>
                        </div>

                        {/* Users Table */}
                        <div className="bg-white rounded-xl border border-[#e7f1f3] overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-[#e7f1f3] flex flex-col sm:flex-row justify-between items-center gap-4">
                                <h3 className="text-lg font-bold">All Users</h3>
                                <div className="flex gap-2">
                                    <button className="p-2 border border-[#cfe4e7] rounded hover:bg-[#f8fbfc]">
                                        <span className="material-symbols-outlined text-xl">filter_list</span>
                                    </button>
                                    <button 
                                        className="p-2 border border-[#cfe4e7] rounded hover:bg-[#f8fbfc]"
                                        onClick={() => loadUsers()}
                                        disabled={usersLoading}
                                    >
                                        <span className="material-symbols-outlined text-xl">refresh</span>
                                    </button>
                                </div>
                            </div>
                            
                            {usersLoading ? (
                                <div className="p-10 text-center text-[#4c8e9a]">
                                    <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                                    <p className="mt-2 text-sm font-semibold">Loading users...</p>
                                </div>
                            ) : usersError ? (
                                <div className="p-10 text-center text-red-600">
                                    <span className="material-symbols-outlined text-4xl">error</span>
                                    <p className="mt-2 text-sm font-semibold">{usersError}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-[#f8fbfc] text-[#4c8e9a] text-xs font-bold uppercase">
                                                    <th className="px-6 py-4">User</th>
                                                    <th className="px-6 py-4">Auth Provider</th>
                                                    <th className="px-6 py-4">Joined</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Role</th>
                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#e7f1f3]">
                                                {users.map((user) => (
                                                    <tr key={user.id} className="hover:bg-primary/5 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                                                    {getInitials(user.full_name)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-sm">{user.full_name || 'Unknown'}</p>
                                                                    <p className="text-xs text-[#4c8e9a]">{user.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold uppercase">
                                                                {user.auth_provider || 'local'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-sm">{formatDate(user.created_at)}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                {user.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${user.is_admin ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-700'}`}>
                                                                {user.is_admin ? 'Admin' : 'User'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="p-2 text-[#4c8e9a] hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                                                                <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-6 py-4 bg-[#f8fbfc] flex items-center justify-between">
                                        <p className="text-xs text-[#4c8e9a] font-semibold">Showing {users.length} users</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Coming Soon for other tabs */}
                {(activeTab === 'analytics' || activeTab === 'settings') && (
                    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-xl border border-[#e7f1f3] p-12">
                        <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-primary text-5xl">construction</span>
                        </div>
                        <h3 className="text-2xl font-bold text-[#0d191b] mb-2">Coming Soon</h3>
                        <p className="text-[#4c8e9a] text-center max-w-md">
                            This section is currently under development. Check back soon for updates!
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboardScreen;
