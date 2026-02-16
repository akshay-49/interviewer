import React, { useEffect, useState, useRef } from 'react';
import { getMsalInstance, loginRequest, tokenRequest } from '../../utils/msalConfig';
import { useInterview } from '../../context/InterviewContext';

const AdminLoginScreen = () => {
    const { navigateTo, updateUser } = useInterview();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const msalInProgressRef = useRef(false);
    const verificationInProgressRef = useRef(false);

    // Handle MSAL redirect callback on mount
    useEffect(() => {
        const handleRedirect = async () => {
            if (verificationInProgressRef.current) return;
            
            try {
                console.log('AdminLoginScreen: Checking for Microsoft redirect...');
                const msalInstance = getMsalInstance();
                await msalInstance.initialize();

                const result = await msalInstance.handleRedirectPromise();
                console.log('AdminLoginScreen: Redirect promise result:', result);
                
                if (result?.account) {
                    console.log('AdminLoginScreen: Found account from redirect');
                    verificationInProgressRef.current = true;
                    sessionStorage.setItem('adminLoginVerifying', 'true');
                    setIsLoading(true);
                    
                    // Clear flag immediately to prevent loops
                    sessionStorage.removeItem('adminLoginInProgress');
                    
                    msalInstance.setActiveAccount(result.account);
                    
                    // Check if we need to get token
                    if (!result.accessToken) {
                        console.log('No access token in result, acquiring token...');
                        try {
                            const tokenResponse = await msalInstance.acquireTokenSilent({
                                ...tokenRequest,
                                account: result.account,
                            });
                            result.accessToken = tokenResponse.accessToken;
                        } catch (err) {
                            console.error('Token acquisition failed:', err);
                            setError('Failed to acquire token');
                            setIsLoading(false);
                            return;
                        }
                    }
                    
                    await verifyAndLogin(result);
                } else {
                    // No redirect result, show login button
                    sessionStorage.removeItem('adminLoginVerifying');
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Microsoft redirect error:', err);
                setError('Microsoft login failed. Please try again.');
                sessionStorage.removeItem('adminLoginInProgress');
                sessionStorage.removeItem('adminLoginVerifying');
                verificationInProgressRef.current = false;
                setIsLoading(false);
            }
        };

        handleRedirect();
    }, []);

    const verifyAndLogin = async (result) => {
        try {
            console.log('Verifying login with backend...');
            const msalInstance = getMsalInstance();
            const account = msalInstance.getActiveAccount();
            
            if (!account) {
                console.error('No account found');
                setError('No account found. Please login again.');
                sessionStorage.removeItem('adminLoginVerifying');
                setIsLoading(false);
                return;
            }

            console.log('Active account:', account);

            // Get access token with correct audience
            let token = result?.accessToken;
            
            if (!token) {
                try {
                    const tokenResponse = await msalInstance.acquireTokenSilent({
                        ...tokenRequest,
                        account: account,
                    });
                    token = tokenResponse.accessToken;
                    console.log('Got token silently');
                } catch (err) {
                    console.log('Silent token failed:', err.message);
                    setError('Failed to acquire token. Please try again.');
                    return;
                }
            }

            console.log('Token acquired, verifying with backend...');

            // Verify with backend
            const verifyResponse = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/verify-entra-token`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        access_token: token
                    })
                }
            );

            console.log('Backend response status:', verifyResponse.status);
            const data = await verifyResponse.json();
            console.log('Backend response data:', data);

            if (verifyResponse.ok) {
                const email = (data.user?.email || '').toLowerCase();
                console.log('User email:', email);
                
                const isAccellorUser = email.endsWith('@accellor.com');
                console.log('Is Accellor user:', isAccellorUser);

                if (!isAccellorUser) {
                    setError(`Access denied. Only @accellor.com accounts allowed. Your email: ${email}`);
                    sessionStorage.removeItem('adminLoginInProgress'); // Clear flag
                    sessionStorage.removeItem('adminLoginVerifying');
                    setIsLoading(false);
                    // Log out the user
                    await msalInstance.logoutRedirect();
                    return;
                }

                // Token stored in httpOnly cookie by backend (more secure than localStorage)
                sessionStorage.removeItem('adminLoginInProgress'); // Clear flag
                sessionStorage.removeItem('adminLoginVerifying');

                console.log('Login successful, navigating to admin dashboard');
                
                updateUser({
                    name: data.user.full_name,
                    email: data.user.email,
                    isLoggedIn: true,
                    isAdmin: true,
                    picture: data.user.picture,
                });

                navigateTo('admin-dashboard');
            } else {
                const errorMsg = data.detail || 'Verification failed';
                console.error('Verification error:', errorMsg);
                setError(errorMsg);
                sessionStorage.removeItem('adminLoginVerifying');
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Verification error:', err);
            setError(`Error: ${err.message}`);
            sessionStorage.removeItem('adminLoginVerifying');
            setIsLoading(false);
        }
    };

    const handleMicrosoftLogin = async () => {
        if (msalInProgressRef.current) return;
        
        msalInProgressRef.current = true;
        setError('');
        setIsLoading(true);

        try {
            console.log('Starting Microsoft login from admin page...');
            
            // Store that we're doing admin login
            sessionStorage.setItem('adminLoginInProgress', 'true');
            
            const msalInstance = getMsalInstance();
            
            console.log('MSAL Instance:', msalInstance);
            console.log('Login request:', loginRequest);
            
            await msalInstance.initialize();
            console.log('MSAL initialized');
            
            console.log('Calling loginRedirect...');
            await msalInstance.loginRedirect(loginRequest);
            console.log('loginRedirect called, waiting for redirect...');
        } catch (err) {
            console.error('Microsoft login error:', err);
            setError(`Microsoft login failed: ${err.message || err}`);
            sessionStorage.removeItem('adminLoginInProgress');
            msalInProgressRef.current = false;
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Show loading screen during redirect processing */}
            {isLoading ? (
                <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-300">Verifying Microsoft login...</p>
                    </div>
                </main>
            ) : (
                <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10 relative w-full overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                <div className="glass-panel w-full max-w-md rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800 p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 mb-4">
                            <span className="text-3xl">👨‍💼</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Login with your Microsoft account (@accellor.com)
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Microsoft Login Button */}
                    <button
                        onClick={handleMicrosoftLogin}
                        disabled={isLoading}
                        className="w-full px-6 py-3 bg-[#0078D4] text-white font-semibold rounded-lg hover:bg-[#106EBE] active:scale-[0.98] transition-all shadow-md shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                        </svg>
                        {isLoading ? 'Signing In...' : 'Sign In with Microsoft'}
                    </button>

                    {/* Back to User Login */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                            Not an admin?{' '}
                            <button
                                onClick={() => navigateTo('login')}
                                className="text-primary hover:text-primary/80 font-semibold transition-colors"
                            >
                                Use regular login
                            </button>
                        </p>
                    </div>

                    {/* Info */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Admin access requires a valid @accellor.com Microsoft account
                        </p>
                    </div>
                </div>
            </main>
            )}
        </div>
    );
};

export default AdminLoginScreen;
