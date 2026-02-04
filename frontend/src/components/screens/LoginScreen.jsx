import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useInterview } from '../../context/InterviewContext';
import { getMsalInstance, loginRequest } from '../../utils/msalConfig';

const LoginScreen = () => {
    const { loginWithRedirect, isAuthenticated, isLoading, user, getAccessTokenSilently } = useAuth0();
    const { navigateTo, updateUser } = useInterview();

    useEffect(() => {
        console.log('LoginScreen useEffect triggered - isAuthenticated:', isAuthenticated, 'user:', user, 'isLoading:', isLoading);
        
        const handleAuthCallback = async () => {
            if (isAuthenticated && user) {
                console.log('User authenticated:', user);
                try {
                    console.log('Attempting to sync with backend...');
                    // Call backend to sync user (send user info directly, no token validation needed)
                    const response = await fetch('http://localhost:8000/auth/callback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            sub: user.sub,
                            email: user.email,
                            name: user.name,
                            picture: user.picture,
                            email_verified: user.email_verified
                        })
                    });

                    console.log('Backend response received:', response.status);

                    if (!response.ok) {
                        const errorData = await response.text();
                        console.error('Backend response error:', response.status, errorData);
                        throw new Error(`Failed to sync user with backend: ${response.status} - ${errorData}`);
                    }

                    const data = await response.json();
                    console.log('Backend sync successful:', data);
                    
                    const clearProfileStorage = () => {
                        ['user_id', 'user_name', 'user_email', 'job_title', 'company_name', 'experience_level'].forEach((key) => {
                            localStorage.removeItem(key);
                        });
                    };

                    const storedUserId = localStorage.getItem('user_id');
                    const storedUserEmail = localStorage.getItem('user_email');
                    const nextUserId = data.user.id;
                    const nextUserEmail = data.user.email;

                    if ((storedUserId && storedUserId !== nextUserId) || (storedUserEmail && storedUserEmail !== nextUserEmail)) {
                        clearProfileStorage();
                    }

                    localStorage.setItem('user_id', nextUserId);
                    localStorage.setItem('user_name', data.user.full_name);
                    localStorage.setItem('user_email', nextUserEmail);

                    // Update user state
                    updateUser({
                        name: data.user.full_name,
                        email: data.user.email,
                        isLoggedIn: true,
                        isAdmin: !!data.user.is_admin,
                        picture: data.user.picture,
                    });

                    // Navigate based on admin status
                    if (data.user.is_admin || data.user.email.toLowerCase().endsWith('@accellor.com')) {
                        console.log('Navigating to admin-dashboard');
                        navigateTo('admin-dashboard');
                    } else {
                        console.log('Navigating to welcome');
                        navigateTo('welcome');
                    }
                } catch (error) {
                    console.error('Auth callback error:', error);
                    console.error('Error details:', error.stack);
                    alert(`Authentication error: ${error.message}. Please check the console for details.`);
                }
            } else {
                console.log('Waiting for authentication... isAuthenticated:', isAuthenticated, 'user:', user);
            }
        };

        handleAuthCallback();
    }, [isAuthenticated, user, navigateTo, updateUser]);

    const handleLogin = () => {
        loginWithRedirect({
            appState: { returnTo: window.location.pathname },
            authorizationParams: {
                connection: 'Username-Password-Authentication'
            }
        });
    };

    const handleMicrosoftLogin = async () => {
        // Skip authentication for testing - go straight to admin dashboard
        console.log('Bypassing auth, navigating to admin-dashboard');
        navigateTo('admin-dashboard');
        return;
        
        /* Commented out for testing
        try {
            const msalInstance = getMsalInstance();
            const response = await msalInstance.loginPopup(loginRequest);
            console.log('Microsoft login response:', response);
            
            // Get user info
            const account = response.account;
            const microsoftUser = {
                sub: account.localAccountId,
                email: account.username,
                name: account.name,
                picture: null,
                email_verified: true,
                provider: 'microsoft'
            };
            
            console.log('Microsoft user:', microsoftUser);
            
            // Send to backend
            try {
                const backendResponse = await fetch('http://localhost:8000/auth/microsoft-callback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(microsoftUser)
                });
                
                if (!backendResponse.ok) {
                    const errorData = await backendResponse.text();
                    throw new Error(`Failed to sync user: ${backendResponse.status}`);
                }
                
                const data = await backendResponse.json();
                console.log('Backend sync successful:', data);
                
                updateUser({
                    name: data.user.full_name,
                    email: data.user.email,
                    isLoggedIn: true,
                    isAdmin: !!data.user.is_admin,
                    picture: data.user.picture,
                });
                
                // Navigate to admin dashboard
                console.log('Navigating to admin-dashboard');
                navigateTo('admin-dashboard');
            } catch (backendError) {
                console.error('Backend error:', backendError);
                alert(`Backend error: ${backendError.message}`);
            }
        } catch (error) {
            console.error('Microsoft login error:', error);
            if (error.errorCode !== 'user_cancelled') {
                alert(`Microsoft login failed: ${error.message}`);
            }
        }
        */
    };

    const handleSignup = () => {
        loginWithRedirect({
            authorizationParams: {
                screen_hint: 'signup',
                connection: 'Username-Password-Authentication'
            }
        });
    };

    if (isLoading) {
        return (
            <div className="bg-background-light dark:bg-background-dark font-display h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">Loading...</p>
                </div>
            </div>
        );
    }

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
                            Welcome to AI Interview Coach
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Secure authentication powered by Auth0
                        </p>
                    </div>

                    {/* Login Button */}
                    <div className="space-y-4">
                        <button
                            onClick={handleLogin}
                            className="w-full px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/30"
                        >
                            Sign In with Username
                        </button>

                        <button
                            onClick={handleSignup}
                            className="w-full px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 active:scale-[0.98] transition-all"
                        >
                            Sign Up
                        </button>

                        {/* Microsoft/Entra ID Login */}
                        <button
                            onClick={handleMicrosoftLogin}
                            className="w-full px-6 py-3 bg-[#0078D4] text-white font-semibold rounded-lg hover:bg-[#006CBF] active:scale-[0.98] transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/>
                            </svg>
                            Login with Microsoft
                        </button>
                    </div>

                    {/* Features - REMOVED */}
                </div>
            </main>
        </div>
    );
};

export default LoginScreen;
