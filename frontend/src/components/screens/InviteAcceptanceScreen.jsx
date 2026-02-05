import React, { useEffect, useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const InviteAcceptanceScreen = ({ inviteCode }) => {
    const { navigateTo, updateUser } = useInterview();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [inviteData, setInviteData] = useState(null);
    const [startingInterview, setStartingInterview] = useState(false);
    const [password, setPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);

    useEffect(() => {
        const validateInvite = async () => {
            try {
                const response = await fetch('http://localhost:8000/admin/validate-invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invite_code: inviteCode })
                });

                if (!response.ok) {
                    throw new Error('Invalid or expired invite link');
                }

                const data = await response.json();
                setInviteData(data.invite);
            } catch (err) {
                console.error('Invite validation error:', err);
                setError(err.message || 'Failed to validate invite');
            } finally {
                setLoading(false);
            }
        };

        if (inviteCode) {
            validateInvite();
        }
    }, [inviteCode]);

    const handleStartInterview = async () => {
        if (!password || password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setStartingInterview(true);
        setError('');
        
        try {
            // First register user in Auth0
            const registerResponse = await fetch('http://localhost:8000/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: inviteData.candidate_email,
                    password: password,
                    name: inviteData.candidate_name
                })
            });

            if (!registerResponse.ok) {
                const errorData = await registerResponse.json();
                throw new Error(errorData.detail || 'Failed to register user in Auth0');
            }

            const registerData = await registerResponse.json();
            const auth0UserId = registerData.user.id;

            // Then register invited user to mark invite as used
            const inviteRegisterResponse = await fetch('http://localhost:8000/admin/register-invited-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invite_code: inviteCode,
                    password: password
                })
            });
            
            if (!inviteRegisterResponse.ok) {
                console.warn('Failed to mark invite as used, but user is registered');
            }

            const inviteRegisterData = inviteRegisterResponse.ok ? await inviteRegisterResponse.json() : {};
            
            // Create user session from auth0 registration
            const userData = {
                id: auth0UserId,
                auth0_user_id: auth0UserId,
                full_name: inviteData.candidate_name,
                email: inviteData.candidate_email,
                job_title: inviteData.role,
                level: inviteData.seniority_level,
                is_invited: true,
                invite_code: inviteCode
            };

            // Save to localStorage (no token - using httpOnly cookie)
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('user_id', registerData.user_id);
            localStorage.setItem('user_email', inviteData.candidate_email);
            localStorage.setItem('user_name', inviteData.candidate_name);
            localStorage.setItem('job_title', inviteData.role);
            
            // Store token in sessionStorage as fallback (cleared when browser closes)
            if (registerData.access_token) {
                sessionStorage.setItem('access_token', registerData.access_token);
            }
            
            // Update context with proper field names
            updateUser({
                name: inviteData.candidate_name,
                email: inviteData.candidate_email,
                isLoggedIn: true,
                isAdmin: false,
            });

            // Redirect to setup
            setTimeout(() => {
                navigateTo('setup');
            }, 1000);
        } catch (err) {
            console.error('Error starting interview:', err);
            setError(err.message || 'Failed to start interview');
            setStartingInterview(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 to-[#f6f8f8] flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <span className="material-symbols-outlined text-primary text-4xl">mail</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[#0d191b] mb-2">Validating Your Invite</h2>
                    <p className="text-[#4c8e9a]">Please wait while we prepare your interview...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-[#f6f8f8] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl border border-red-200 shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-red-600 text-4xl">error</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[#0d191b] mb-2">Invalid Invite</h2>
                    <p className="text-[#4c8e9a] mb-6">{error}</p>
                    <button
                        onClick={() => navigateTo('welcome')}
                        className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    if (!inviteData) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f6f8f8]">
            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between border-b border-[#e7f1f3] bg-white px-6 md:px-20 py-4 sticky top-0 z-50">
                <img src="/accellor-logo.svg" alt="Accellor" className="h-8" />
                <div className="flex items-center gap-4">
                    <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-[#e7f1f3] text-[#0d191b] hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined">help</span>
                    </button>
                </div>
            </header>

            <main className="max-w-[960px] mx-auto px-4 py-10 flex flex-col gap-8">
                {/* Header Hero Area */}
                <div className="w-full bg-gradient-to-br from-primary to-primary/80 flex flex-col justify-end overflow-hidden rounded-xl min-h-[240px] relative shadow-lg p-8">
                    <span className="inline-block px-3 py-1 bg-white text-primary text-xs font-bold uppercase tracking-wider rounded-full w-fit">Invitation Confirmed</span>
                </div>

                {/* Page Heading */}
                <div className="flex flex-col gap-3">
                    <h1 className="text-[#0d191b] text-4xl font-black leading-tight tracking-tight">
                        You've been invited to take an interview
                    </h1>
                    <p className="text-[#4c8e9a] text-lg font-medium">
                        {inviteData.role && `${inviteData.role} - `}{inviteData.seniority_level} Level at Accellor
                    </p>
                </div>

                {/* Interview Format Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-1 gap-4 rounded-xl border border-[#cfe4e7] bg-white p-5 flex-col shadow-sm hover:shadow-md transition-shadow">
                        <span className="material-symbols-outlined text-primary text-3xl">mic</span>
                        <div className="flex flex-col gap-1">
                            <h2 className="text-[#0d191b] text-base font-bold leading-tight">Type</h2>
                            <p className="text-[#4c8e9a] text-sm font-normal leading-normal">Voice Interview</p>
                        </div>
                    </div>
                    <div className="flex flex-1 gap-4 rounded-xl border border-[#cfe4e7] bg-white p-5 flex-col shadow-sm hover:shadow-md transition-shadow">
                        <span className="material-symbols-outlined text-primary text-3xl">leaderboard</span>
                        <div className="flex flex-col gap-1">
                            <h2 className="text-[#0d191b] text-base font-bold leading-tight">Level</h2>
                            <p className="text-[#4c8e9a] text-sm font-normal leading-normal">{inviteData.seniority_level} Role</p>
                        </div>
                    </div>
                    <div className="flex flex-1 gap-4 rounded-xl border border-[#cfe4e7] bg-white p-5 flex-col shadow-sm hover:shadow-md transition-shadow">
                        <span className="material-symbols-outlined text-primary text-3xl">schedule</span>
                        <div className="flex flex-col gap-1">
                            <h2 className="text-[#0d191b] text-base font-bold leading-tight">Duration</h2>
                            <p className="text-[#4c8e9a] text-sm font-normal leading-normal">~20 minutes</p>
                        </div>
                    </div>
                </div>

                {/* Job Description */}
                {inviteData.job_description && (
                    <div className="bg-white rounded-xl border border-[#cfe4e7] p-6 md:p-8 flex flex-col gap-4 shadow-sm">
                        <h2 className="text-[#0d191b] text-2xl font-bold">Position Details</h2>
                        <p className="text-[#4c8e9a] whitespace-pre-wrap leading-relaxed">{inviteData.job_description}</p>
                    </div>
                )}

                {/* Preparation Section */}
                <div className="bg-white rounded-xl border border-[#cfe4e7] p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                    <div>
                        <h2 className="text-[#0d191b] text-2xl font-bold leading-tight">Before you start</h2>
                        <p className="text-gray-500 mt-1">Please ensure your environment is set up for the best experience.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 size-6 flex items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            </div>
                            <div>
                                <p className="text-[#0d191b] font-semibold">Microphone Access</p>
                                <p className="text-gray-500 text-sm leading-relaxed">Ensure your browser has permission to access your microphone.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 size-6 flex items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            </div>
                            <div>
                                <p className="text-[#0d191b] font-semibold">Quiet Environment</p>
                                <p className="text-gray-500 text-sm leading-relaxed">Find a space with minimal background noise to ensure your voice is captured clearly.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 size-6 flex items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            </div>
                            <div>
                                <p className="text-[#0d191b] font-semibold">Stable Internet</p>
                                <p className="text-gray-500 text-sm leading-relaxed">A consistent connection is required to process your responses in real-time.</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[#f0fdff] rounded-lg p-4 border-l-4 border-primary">
                        <div className="flex gap-3">
                            <span className="material-symbols-outlined text-primary">record_voice_over</span>
                            <p className="text-[#0d191b] text-sm italic">
                                "This is a voice-first experience. You will be asked questions by our AI agent and you must answer by speaking aloud."
                            </p>
                        </div>
                    </div>
                </div>

                {/* Password Setup Section */}
                <div className="bg-white rounded-xl border border-[#cfe4e7] p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                    <div>
                        <h2 className="text-[#0d191b] text-2xl font-bold leading-tight">Create Your Password</h2>
                        <p className="text-gray-500 mt-1">Set a secure password to access your account.</p>
                    </div>
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                            <span className="material-symbols-outlined text-red-600">error</span>
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter a secure password (minimum 8 characters)"
                        className="w-full px-4 py-3 rounded-lg border border-[#cfe4e7] bg-white text-[#0d191b] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-gray-500 text-sm">
                        Your password will be used to create your secure account in our system.
                    </p>
                </div>

                {/* CTA Section */}
                <div className="flex flex-col items-center gap-4 py-6">
                    <button
                        onClick={handleStartInterview}
                        disabled={startingInterview}
                        className="w-full md:w-auto min-w-[320px] px-10 py-4 bg-primary text-[#0d191b] text-lg font-black rounded-xl shadow-lg hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {startingInterview ? 'Starting Interview...' : 'Get Started'}
                    </button>
                    <p className="text-gray-400 text-xs">By clicking "Get Started", you agree to our Terms of Service and Privacy Policy.</p>
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-[960px] mx-auto px-4 pb-12 pt-6 border-t border-gray-100 flex justify-between items-center text-sm text-gray-400">
                <p>© 2024 Accellor. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default InviteAcceptanceScreen;
