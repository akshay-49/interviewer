import React, { useEffect, useRef, useState } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { getMsalInstance, loginRequest } from '../../utils/msalConfig';

const CustomLoginScreen = () => {
    const { navigateTo, updateUser } = useInterview();
    const [error, setError] = useState('');
    const [isMicrosoftLoginBusy, setIsMicrosoftLoginBusy] = useState(false);
    const msalInProgressRef = useRef(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const returnTo = `${window.location.origin}/callback`;
            window.location.assign(`${apiBaseUrl}/auth/login?screen_hint=login&return_to=${encodeURIComponent(returnTo)}`);
        } catch (err) {
            console.error('Auth0 login error:', err);
            setError('An error occurred. Please try again.');
        }
    };

    const handleGoBack = () => {
        navigateTo('login');
    };

    const verifyAndLogin = async (token) => {
        if (!token) {
            console.error('No access token received from MSAL');
            setError('Failed to get Microsoft login token. Please try again.');
            return;
        }

        console.log('Entra ID token acquired, sending to backend for verification');

        const verifyResponse = await fetch('http://localhost:8000/auth/verify-entra-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                access_token: token
            })
        });

        if (verifyResponse.ok) {
            const data = await verifyResponse.json();

            // Store token in sessionStorage as fallback
            sessionStorage.setItem('access_token', token);

            const email = (data.user?.email || '').toLowerCase();
            const isAccellorUser = email.endsWith('@accellor.com');
            const isAdmin = isAccellorUser || !!data.user?.is_admin;

            // Store user info
            localStorage.setItem('user', JSON.stringify({
                ...data.user,
                is_admin: isAdmin,
            }));

            updateUser({
                name: data.user.full_name,
                email: data.user.email,
                isLoggedIn: true,
                isAdmin,
            });

            if (isAdmin) {
                navigateTo('admin-dashboard');
            } else {
                navigateTo('welcome');
            }
        } else {
            const error = await verifyResponse.json();
            console.error('Token verification failed:', error);
            setError(error.detail || 'Microsoft login verification failed');
        }
    };

    useEffect(() => {
        const handleRedirect = async () => {
            try {
                const msalInstance = getMsalInstance();
                await msalInstance.initialize();

                const result = await msalInstance.handleRedirectPromise();
                if (result?.account) {
                    msalInstance.setActiveAccount(result.account);
                }

                const token = result?.idToken || result?.accessToken;
                if (token) {
                    await verifyAndLogin(token);
                }
            } catch (error) {
                console.error('Microsoft redirect error:', error);
            }
        };

        handleRedirect();
    }, []);

    const handleMicrosoftLogin = async () => {
        try {
            if (msalInProgressRef.current) {
                return;
            }
            msalInProgressRef.current = true;
            setIsMicrosoftLoginBusy(true);

            const msalInstance = getMsalInstance();
            
            // Ensure MSAL is initialized
            await msalInstance.initialize();
            
            // Same-window login
            await msalInstance.loginRedirect(loginRequest);
        } catch (error) {
            console.error('Microsoft login error:', error);
            setError('Microsoft login failed: ' + (error.message || 'Unknown error'));
        } finally {
            msalInProgressRef.current = false;
            setIsMicrosoftLoginBusy(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10 relative w-full overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                <div className="glass-panel w-full max-w-md rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800 p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 mb-4">
                            <span className="text-3xl">🔐</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Sign In
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Continue with Auth0
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex gap-3">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400 flex-shrink-0">error</span>
                            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <button
                            type="submit"
                            className="w-full px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/30"
                        >
                            Continue with Auth0
                        </button>
                    </form>

                    {/* Back Link */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={handleGoBack}
                            className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary text-sm font-medium transition-colors"
                        >
                            ← Back to login options
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                            Or continue with
                        </p>
                        <button
                            type="button"
                            onClick={handleMicrosoftLogin}
                            disabled={isMicrosoftLoginBusy}
                            className="w-full px-6 py-3 bg-[#0078D4] text-white font-semibold rounded-lg hover:bg-[#006CBF] active:scale-[0.98] transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                            </svg>
                            Microsoft
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CustomLoginScreen;
