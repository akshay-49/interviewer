import React, { useEffect, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useInterview } from '../../context/InterviewContext';
import { api } from '../../utils/api';

const CallbackPage = () => {
    const { isAuthenticated, user, isLoading, getAccessTokenSilently, getIdTokenClaims } = useAuth0();
    const { navigateTo, updateUser, updateInterview, resetInterview } = useInterview();
    const [startingInterview, setStartingInterview] = useState(false);
    const [startError, setStartError] = useState('');
    const handledRef = useRef(false);

    useEffect(() => {
        const finalizeInvite = async () => {
            const inviteCode = localStorage.getItem('invite_code');
            try {
                let token = null;
                try {
                    const idTokenClaims = await getIdTokenClaims();
                    token = idTokenClaims?.__raw || null;
                } catch (error) {
                    console.warn('Failed to get ID token claims:', error);
                }

                if (!token) {
                    token = await getAccessTokenSilently({
                        authorizationParams: {
                            audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                            scope: 'openid profile email',
                        },
                    });
                }

                const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                if (inviteCode) {
                    const response = await fetch(`${apiBaseUrl}/auth/accept-invite`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ invite_code: inviteCode })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.warn('Invite finalize failed:', errorData.detail || response.statusText);
                    }
                } else {
                    const response = await fetch(`${apiBaseUrl}/auth/sync-user`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.warn('User sync failed:', errorData.detail || response.statusText);
                    }
                }
            } catch (error) {
                console.warn('Invite finalize error:', error);
            } finally {
                localStorage.removeItem('invite_code');
            }
        };

        const handlePostLogin = async () => {
            // Update app state with user info
            updateUser({
                name: user.name || user.email,
                email: user.email,
                isLoggedIn: true,
                isAdmin: user.email?.endsWith('@accellor.com') || false,
                picture: user.picture,
            });

            await finalizeInvite();

            const invitePayloadRaw = localStorage.getItem('invite_payload');
            if (invitePayloadRaw) {
                try {
                    const invitePayload = JSON.parse(invitePayloadRaw);
                    localStorage.removeItem('invite_payload');
                    setStartingInterview(true);
                    setStartError('');
                    const role = invitePayload.role || 'Software Engineer';
                    const experience = invitePayload.level || 'Mid-Level';
                    const roleDescription = invitePayload.jobDescription || '';
                    const persona = invitePayload.persona || 'strict';

                    try {
                        resetInterview();
                        const result = await api.startInterview(role, experience, roleDescription, persona);

                        updateInterview({
                            sessionId: result.session_id,
                            userId: result.user_id || localStorage.getItem('user_id') || user.sub || 'anonymous',
                            userEmail: result.user_email || user.email || localStorage.getItem('user_email') || 'unknown@example.com',
                            userName: result.user_name || user.name || localStorage.getItem('user_name'),
                            jobTitle: localStorage.getItem('job_title') || role,
                            companyName: localStorage.getItem('company_name'),
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

                        navigateTo('interview');
                        return;
                    } catch (error) {
                        console.warn('Auto-start interview failed:', error);
                        setStartError('Failed to start interview. Please try again.');
                        setStartingInterview(false);
                        return;
                    }
                } catch (error) {
                    console.warn('Invalid invite payload:', error);
                    localStorage.removeItem('invite_payload');
                }
            }

            // Redirect to appropriate screen
            const isAdmin = user.email?.endsWith('@accellor.com') || false;
            navigateTo(isAdmin ? 'admin-dashboard' : 'welcome');
        };

        if (!isLoading && isAuthenticated && user && !handledRef.current) {
            handledRef.current = true;
            handlePostLogin();
        }
    }, [getAccessTokenSilently, getIdTokenClaims, isAuthenticated, isLoading, navigateTo, resetInterview, updateInterview, updateUser, user]);

    if (isLoading || startingInterview) {
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
