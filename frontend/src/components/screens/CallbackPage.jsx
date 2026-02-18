import React, { useEffect, useRef, useState } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { api, historyApi } from '../../utils/api';

const CallbackPage = () => {
    const { navigateTo, updateUser, updateInterview, resetInterview } = useInterview();
    const [startingInterview, setStartingInterview] = useState(false);
    const [startError, setStartError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const handledRef = useRef(false);

    useEffect(() => {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const inviteCode = new URLSearchParams(window.location.search).get('invite_code');

        const fetchCurrentUser = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/auth/me`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn('Failed to load user profile:', error);
            }
            return null;
        };


        const fetchInvite = async (code) => {
            const response = await fetch(`${apiBaseUrl}/admin/validate-invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code: code })
            });

            if (!response.ok) {
                throw new Error('Invalid or expired invite link');
            }

            const data = await response.json();
            return data.invite || null;
        };

        const acceptInvite = async (code) => {
            try {
                const response = await fetch(`${apiBaseUrl}/auth/accept-invite`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ invite_code: code })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.warn('Invite finalize failed:', errorData.detail || response.statusText);
                }
            } catch (error) {
                console.warn('Invite finalize error:', error);
            }
        };

        const handlePostLogin = async () => {
            const profile = await fetchCurrentUser();

            if (!profile) {
                setIsLoading(false);
                navigateTo('login', null, true);
                return;
            }

            updateUser({
                id: profile.id,
                name: profile.full_name || profile.email,
                email: profile.email,
                isLoggedIn: true,
                isAdmin: profile.email?.endsWith('@accellor.com') || false,
                picture: profile.picture,
            });

            if (inviteCode) {
                setStartingInterview(true);
                setStartError('');

                try {
                    const invite = await fetchInvite(inviteCode);
                    if (!invite) {
                        throw new Error('Invite not found');
                    }

                    const role = invite.role || 'Software Engineer';
                    const experience = invite.seniority_level || 'Mid-Level';
                    const roleDescription = invite.job_description || '';
                    const persona = 'strict';
                    const recordingMode = invite.recording_mode || 'audio';

                    if (profile.id) {
                        try {
                            await historyApi.saveUserProfile({
                                user_id: profile.id,
                                user_name: invite.candidate_name || profile.full_name || profile.email,
                                user_email: invite.candidate_email || profile.email,
                                job_title: role,
                                company_name: '',
                                experience_level: experience
                            });
                        } catch (error) {
                            console.warn('Failed to save profile to Cosmos:', error);
                        }
                    }

                    resetInterview();
                    const result = await api.startInterview(
                        role,
                        experience,
                        roleDescription,
                        persona,
                        recordingMode,
                        {
                            userId: profile.id,
                            email: profile.email,
                            inviteCode: inviteCode || null
                        }
                    );

                    updateInterview({
                        sessionId: result.session_id,
                        userId: result.user_id || profile.id || 'anonymous',
                        userEmail: result.user_email || profile.email || 'unknown@example.com',
                        userName: result.user_name || profile.full_name || profile.email,
                        jobTitle: role,
                        companyName: '',
                        recordingMode: recordingMode,
                        inviteCode: inviteCode,
                        currentQuestion: result.question,
                        questionNumber: 1,
                        totalQuestions: result.total_questions || 5,
                        role,
                        experience,
                        roleDescription,
                        persona,
                        roleDisplay: `${experience} ${role} Interview`,
                        questionText: result.question,
                        startedAt: new Date().toISOString(),
                    });

                    await acceptInvite(inviteCode);
                    navigateTo('interview');
                    return;
                } catch (error) {
                    console.warn('Auto-start interview failed:', error);
                    setStartError('Failed to start interview. Please try again.');
                    setStartingInterview(false);
                    setIsLoading(false);
                    return;
                }
            }

            const isAdmin = profile.email?.endsWith('@accellor.com') || false;
            navigateTo(isAdmin ? 'admin-dashboard' : 'welcome');
            setIsLoading(false);
        };

        if (!handledRef.current) {
            handledRef.current = true;
            handlePostLogin();
        }

    }, [navigateTo, resetInterview, updateInterview, updateUser]);

    if (startingInterview || isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">
                        {startingInterview ? 'Starting your interview...' : 'Processing login...'}
                    </p>
                    {startError && (
                        <p className="text-red-600 text-sm mt-3">{startError}</p>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default CallbackPage;
