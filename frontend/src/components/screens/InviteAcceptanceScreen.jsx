import React, { useEffect, useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const InviteAcceptanceScreen = ({ inviteCode }) => {
    const { navigateTo, updateUser, updateInterview } = useInterview();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [inviteData, setInviteData] = useState(null);
    const [startingInterview, setStartingInterview] = useState(false);

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
        setStartingInterview(true);
        setError('');

        try {
            // Accept the invite (auto-registers user if needed)
            const acceptResponse = await fetch('http://localhost:8000/auth/accept-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code: inviteCode })
            });

            if (!acceptResponse.ok) {
                throw new Error('Failed to accept invite. Please try again.');
            }

            const acceptData = await acceptResponse.json();
            const userId = acceptData.user_id || acceptData.userId;
            const userEmail = acceptData.email || inviteData.candidate_email;
            const fullName = acceptData.user?.full_name || inviteData.candidate_name || 'Candidate';
            const role = acceptData.role;
            const experience = acceptData.seniority_level;
            const recordingMode = acceptData.recording_mode || 'audio';

            // Update user context with candidate name
            updateUser({
                name: fullName,
                email: userEmail,
                isLoggedIn: true
            });

            // Persist recording mode for the interview session
            updateInterview({ recordingMode: recordingMode });

            // Now start the interview directly with the invite code and user ID
            const sessionResponse = await fetch('http://localhost:8000/interview/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invite_code: inviteCode,
                    user_id: userId,
                    email: userEmail,
                    role: role,
                    experience: experience,
                    recording_mode: recordingMode
                })
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json().catch(() => ({}));
                console.error('Interview start error:', {
                    status: sessionResponse.status,
                    statusText: sessionResponse.statusText,
                    error: errorData
                });
                throw new Error(errorData.detail || 'Failed to start interview');
            }

            const sessionData = await sessionResponse.json();
            
            // Navigate to interview with session ID and first question
            navigateTo('interview', { 
                sessionId: sessionData.session_id,
                inviteCode: inviteCode,
                firstQuestion: sessionData.question,
                recordingMode: recordingMode
            });
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
            <div className="min-h-screen bg-gradient-to-br from-primary/10 to-[#f6f8f8] flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-primary text-4xl">error</span>
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
                        <span className="material-symbols-outlined text-primary text-3xl">
                            {inviteData.recording_mode === 'video' ? 'videocam' : 'mic'}
                        </span>
                        <div className="flex flex-col gap-1">
                            <h2 className="text-[#0d191b] text-base font-bold leading-tight">Type</h2>
                            <p className="text-[#4c8e9a] text-sm font-normal leading-normal">
                                {inviteData.recording_mode === 'video' ? 'Video Interview' : 'Audio Interview'}
                            </p>
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
                                <p className="text-[#0d191b] font-semibold">
                                    {inviteData.recording_mode === 'video' ? 'Camera & Microphone Access' : 'Microphone Access'}
                                </p>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    {inviteData.recording_mode === 'video'
                                        ? 'Ensure your browser has permission to access your camera and microphone.'
                                        : 'Ensure your browser has permission to access your microphone.'}
                                </p>
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
                                {inviteData.recording_mode === 'video'
                                    ? '"This is a video interview. You will be asked questions by our AI agent and must answer on camera with your microphone enabled."'
                                    : '"This is an audio interview. You will be asked questions by our AI agent and must answer by speaking aloud."'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Sign Up Section */}
                <div className="bg-white rounded-xl border border-[#cfe4e7] p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                    <div>
                        <h2 className="text-[#0d191b] text-2xl font-bold leading-tight">
                            Ready to Start Your Interview?
                        </h2>
                        <p className="text-gray-500 mt-1">
                            Click the button below to begin. You can't pause or leave during the interview.
                        </p>
                    </div>
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                            <span className="material-symbols-outlined text-red-600">error</span>
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}
                    <p className="text-gray-500 text-sm">
                        The interview typically takes about 20 minutes. Make sure you're in a quiet environment with a stable internet connection.
                    </p>
                </div>

                {/* CTA Section */}
                <div className="flex flex-col items-center gap-4 py-6">
                    <button
                        onClick={handleStartInterview}
                        disabled={startingInterview}
                        className="w-full md:w-auto min-w-[320px] px-10 py-4 bg-primary text-[#0d191b] text-lg font-black rounded-xl shadow-lg hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {startingInterview
                            ? 'Starting Interview...'
                            : 'Start Interview'}
                    </button>
                    <p className="text-gray-400 text-xs">
                        By clicking "Start Interview", you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-[960px] mx-auto px-4 pb-12 pt-6 border-t border-gray-100 flex justify-between items-center text-sm text-gray-400">
                <p>© 2026 Accellor. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default InviteAcceptanceScreen;
