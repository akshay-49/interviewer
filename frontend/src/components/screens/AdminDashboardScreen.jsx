import React, { useEffect, useState, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { useAuth } from '../../hooks/useAuth';
import QuestionBankScreen from './QuestionBankScreen';
import InviteCandidateScreen from './InviteCandidateScreen';

const AdminDashboardScreen = () => {
    const { navigateTo, user, updateUser, resetInterview } = useInterview();
    const { logout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersError, setUsersError] = useState('');
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [recentActivity, setRecentActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userFilter, setUserFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileMenuRef = useRef(null);

    const displayName = user?.name || 'Admin User';
    const initials = displayName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setIsProfileOpen(false);
        
        try {
            // Clear all stored data
            localStorage.clear();
            sessionStorage.clear();
            
            // Reset app state
            updateUser({
                name: 'Guest User',
                email: null,
                isLoggedIn: false,
                isAdmin: false,
                picture: null,
            });
            resetInterview();
            
            // Call logout
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
            // Still navigate to login even if logout fails
            navigateTo('login');
        }
    };


    const loadUsers = async (signal) => {
        setUsersLoading(true);
        setUsersError('');
        try {
            // Try Cosmos DB endpoint first (no auth required for testing)
            const cosmosResponse = await fetch('http://localhost:8000/admin/users-cosmos', {
                signal,
            });

            if (cosmosResponse.ok) {
                const data = await cosmosResponse.json();
                console.log('Loaded users from Cosmos DB:', data);
                setUsers(data.users || []);
                setUsersLoading(false);
                return;
            }

            // Fallback to auth endpoint (use httpOnly cookie)
            const response = await fetch('http://localhost:8000/auth/admin/users', {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',  // Send httpOnly cookie
                signal,
            });

            if (!response.ok) {
                throw new Error('Failed to load users from both endpoints');
            }

            const data = await response.json();
            setUsers(data.users || []);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Load users error:', err);
                setUsersError(err.message || 'Failed to load users');
            }
        } finally {
            setUsersLoading(false);
        }
    };

    const loadAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            // Fetch analytics from admin endpoint (which gets all sessions across all users)
            const response = await fetch('http://localhost:8000/admin/analytics', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                setAnalytics({
                    totalSessions: data.total_sessions || 0,
                    todaySessions: data.today_sessions || 0,
                    averageScore: data.average_score?.toFixed(1) || '0',
                    activeSessions: data.active_sessions || 0
                });
            } else {
                console.error('Failed to fetch analytics:', response.status);
                // Fallback to zero values if endpoint fails
                setAnalytics({
                    totalSessions: 0,
                    todaySessions: 0,
                    averageScore: '0',
                    activeSessions: 0
                });
            }
        } catch (err) {
            console.error('Failed to load analytics:', err);
            // Set default values on error
            setAnalytics({
                totalSessions: 0,
                todaySessions: 0,
                averageScore: '0',
                activeSessions: 0
            });
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const loadRecentActivity = async () => {
        setActivityLoading(true);
        try {
            const response = await fetch('http://localhost:8000/admin/recent-activity?limit=10', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                setRecentActivity(data.activities || []);
            } else {
                console.error('Failed to fetch recent activity:', response.status);
                setRecentActivity([]);
            }
        } catch (err) {
            console.error('Failed to load recent activity:', err);
            setRecentActivity([]);
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        loadUsers(controller.signal);
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (users.length > 0 && !analytics) {
            loadAnalytics();
            loadRecentActivity();
        }
    }, [users]);

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            let normalized = dateString;
            if (typeof dateString === 'string') {
                const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(dateString);
                if (!hasTimezone && dateString.includes('T')) {
                    normalized = `${dateString}Z`;
                }
            }
            const date = new Date(normalized);
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'N/A';
        }
    };

    const filteredUsers = users.filter(user => {
        // Search filter
        const matchesSearch = !searchQuery || 
            user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Role filter
        const matchesFilter = 
            userFilter === 'all' ||
            (userFilter === 'admins' && user.is_admin) ||
            (userFilter === 'users' && !user.is_admin) ||
            (userFilter === 'active' && user.is_active) ||
            (userFilter === 'inactive' && !user.is_active);
        
        return matchesSearch && matchesFilter;
    });

    const handleExportReport = () => {
        const csvContent = [
            ['Name', 'Email', 'Provider', 'Joined', 'Status', 'Role'].join(','),
            ...users.map(u => [
                u.full_name || '',
                u.email || '',
                u.auth_provider || 'local',
                formatDate(u.created_at),
                u.is_active ? 'Active' : 'Inactive',
                u.is_admin ? 'Admin' : 'User'
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleUserAdmin = async (userId, currentIsAdmin) => {
        try {
            const response = await fetch('http://localhost:8000/admin/update-user-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, is_admin: !currentIsAdmin })
            });
            
            if (response.ok) {
                // Reload users to get updated data
                await loadUsers();
                alert(`Successfully ${!currentIsAdmin ? 'granted' : 'removed'} admin access`);
            } else {
                alert('Failed to update admin status');
            }
        } catch (err) {
            console.error('Error toggling admin:', err);
            alert('Failed to update admin status');
        }
    };

    const toggleUserActive = async (userId, currentIsActive) => {
        try {
            const response = await fetch('http://localhost:8000/admin/update-user-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, is_active: !currentIsActive })
            });
            
            if (response.ok) {
                // Reload users to get updated data
                await loadUsers();
                alert(`Successfully ${!currentIsActive ? 'activated' : 'deactivated'} user`);
            } else {
                alert('Failed to update active status');
            }
        } catch (err) {
            console.error('Error toggling active:', err);
            alert('Failed to update active status');
        }
    };

    const deleteUser = async (userId, userEmail) => {
        if (!confirm(`Are you sure you want to delete user ${userEmail}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            // Get token from sessionStorage as fallback if cookie isn't working
            const token = sessionStorage.getItem('access_token');
            
            console.log('Delete User Debug:', {
                userId,
                userEmail,
                hasToken: !!token,
                tokenLength: token ? token.length : 0
            });
            
            if (!token) {
                alert('No authentication token found. Please log in again.');
                return;
            }
            
            const response = await fetch(`http://localhost:8000/auth/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
            });
            
            console.log('Delete response status:', response.status);
            
            if (response.ok) {
                // Reload users to get updated data
                await loadUsers();
                alert('User deleted successfully');
            } else {
                const error = await response.json();
                console.error('Delete error:', error);
                alert(`Failed to delete user: ${error.detail || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error deleting user:', err);
            alert(`Failed to delete user: ${err.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-[#f6f8f8]">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 w-full border-b border-[#e7f1f3] bg-white px-4 md:px-10 py-3 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between whitespace-nowrap">
                    <div className="flex items-center gap-8">
                        <button
                            type="button"
                            onClick={() => setActiveTab('overview')}
                            className="flex items-center gap-3 focus:outline-none"
                            aria-label="Go to dashboard"
                        >
                            <img src="/accellor-logo.svg" alt="Accellor" className="h-8"/>
                            <div className="h-6 w-px bg-[#e7f1f3]"></div>
                            <h2 className="text-[#0d191b] text-lg font-bold">Admin Portal</h2>
                        </button>
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
                                onClick={() => setActiveTab('questions')}
                                className={`text-sm font-semibold transition-colors ${activeTab === 'questions' ? 'text-primary font-bold' : 'text-[#4c8e9a] hover:text-primary'}`}
                            >
                                Questions
                            </button>
                            <button 
                                onClick={() => setActiveTab('invites')}
                                className={`text-sm font-semibold transition-colors ${activeTab === 'invites' ? 'text-primary font-bold' : 'text-[#4c8e9a] hover:text-primary'}`}
                            >
                                Invites
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                                {initials}
                            </div>
                            <span className="hidden md:block text-sm font-medium text-[#0d191b]">
                                {displayName}
                            </span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-semibold"
                        >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                            <span className="hidden md:inline">Logout</span>
                        </button>
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
                                <button 
                                    onClick={handleExportReport}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all"
                                >
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
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Total Sessions</p>
                                <h3 className="text-3xl font-black mt-2 text-primary">{analyticsLoading ? '...' : (analytics?.totalSessions || 0)}</h3>
                                <p className="text-xs text-[#4c8e9a] font-semibold mt-1">All time</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Interviews Today</p>
                                <h3 className="text-3xl font-black mt-2 text-[#0d191b]">{analyticsLoading ? '...' : (analytics?.todaySessions || 0)}</h3>
                                <p className="text-xs text-emerald-600 font-semibold mt-1">Completed</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e7f1f3] shadow-sm hover:shadow-md transition-shadow">
                                <p className="text-[#4c8e9a] text-xs font-bold uppercase tracking-wider">Avg Score</p>
                                <h3 className="text-3xl font-black mt-2 text-green-500">{analyticsLoading ? '...' : (analytics?.averageScore || '0')}/10</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    <span className="text-xs text-green-600 font-bold uppercase">Platform Average</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl border border-[#e7f1f3] shadow-sm p-6">
                            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                            {activityLoading ? (
                                <div className="text-center py-8">
                                    <p className="text-[#4c8e9a]">Loading activity...</p>
                                </div>
                            ) : recentActivity.length > 0 ? (
                                <div className="space-y-3">
                                    {recentActivity.map((activity, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                                                activity.type === 'interview_completed' && activity.session_id
                                                    ? 'hover:bg-[#f0fafb] cursor-pointer'
                                                    : 'hover:bg-[#f8fbfc]'
                                            }`}
                                            onClick={() => {
                                                if (activity.type === 'interview_completed' && activity.session_id) {
                                                    navigateTo('report', { sessionId: activity.session_id, isAdmin: true });
                                                }
                                            }}
                                            role={activity.type === 'interview_completed' && activity.session_id ? 'button' : undefined}
                                            tabIndex={activity.type === 'interview_completed' && activity.session_id ? 0 : undefined}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key === 'Enter'
                                                    && activity.type === 'interview_completed'
                                                    && activity.session_id
                                                ) {
                                                    navigateTo('report', { sessionId: activity.session_id, isAdmin: true });
                                                }
                                            }}
                                        >
                                            <div className={`size-10 rounded-full flex items-center justify-center ${
                                                activity.type === 'user_registered' ? 'bg-primary/10' :
                                                activity.type === 'interview_completed' ? 'bg-green-50' :
                                                'bg-amber-50'
                                            }`}>
                                                <span className={`material-symbols-outlined text-[20px] ${
                                                    activity.type === 'user_registered' ? 'text-primary' :
                                                    activity.type === 'interview_completed' ? 'text-green-600' :
                                                    'text-amber-600'
                                                }`}>
                                                    {activity.icon}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold">{activity.title}</p>
                                                <p className="text-xs text-[#4c8e9a]">{activity.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-[#4c8e9a] whitespace-nowrap">{activity.time_ago}</p>
                                                {activity.type === 'interview_completed' && activity.session_id && (
                                                    <p className="text-[10px] text-primary font-semibold">View report</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-[#4c8e9a]">No recent activity</p>
                                </div>
                            )}
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
                                <div className="relative">
                                    <select
                                        value={userFilter}
                                        onChange={(e) => setUserFilter(e.target.value)}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#e7f1f3] text-[#0d191b] text-sm font-bold hover:bg-[#d8e8eb] transition-all appearance-none pr-10 cursor-pointer"
                                    >
                                        <option value="all">All Users</option>
                                        <option value="admins">Admins Only</option>
                                        <option value="users">Users Only</option>
                                        <option value="active">Active Only</option>
                                        <option value="inactive">Inactive Only</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none">filter_list</span>
                                </div>
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
                        <div className="bg-white rounded-xl border border-[#e7f1f3] shadow-sm">
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
                                                    <th className="px-6 py-4">Joined</th>
                                                    <th className="px-6 py-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#e7f1f3]">
                                                {filteredUsers.map((user) => (
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
                                                            <p className="text-sm">{formatDate(user.created_at)}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    navigateTo('user-sessions', { userId: user.id });
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                                            >
                                                                View Sessions
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    deleteUser(user.id, user.email);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-6 py-4 bg-[#f8fbfc] flex items-center justify-between">
                                        <p className="text-xs text-[#4c8e9a] font-semibold">Showing {filteredUsers.length} of {users.length} users</p>
                                    </div>
                                </>
                            )}

                        </div>
                    </>
                )}

                {/* Questions Tab */}
                {activeTab === 'questions' && (
                    <QuestionBankScreen />
                )}

                {/* Invites Tab */}
                {activeTab === 'invites' && (
                    <InviteCandidateScreen />
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
