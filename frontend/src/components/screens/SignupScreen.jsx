import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useInterview } from '../../context/InterviewContext';

const SignupScreen = () => {
    const { loginWithRedirect, isLoading } = useAuth0();
    const { navigateTo } = useInterview();

    const handleSignup = () => {
        loginWithRedirect({
            authorizationParams: {
                screen_hint: 'signup'
            }
        });
    };

    const handleLogin = () => {
        navigateTo('login');
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
                            <span className="text-3xl">🚀</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Create Account
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Join AI Interview Coach with Auth0
                        </p>
                    </div>

                    {/* Signup Button */}
                    <div className="space-y-4">
                        <button
                            onClick={handleSignup}
                            className="w-full px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/30"
                        >
                            Sign Up with Auth0
                        </button>

                        {/* Login Link */}
                        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                            Already have an account?{' '}
                            <button
                                onClick={handleLogin}
                                className="text-primary hover:text-primary/80 font-semibold transition-colors"
                            >
                                Sign In
                            </button>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                            What you'll get
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="text-primary text-xl flex-shrink-0">✓</span>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <strong>AI-Powered Interviews</strong>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Practice with realistic interview scenarios</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-primary text-xl flex-shrink-0">✓</span>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <strong>Instant Feedback</strong>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Get detailed analysis of your performance</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-primary text-xl flex-shrink-0">✓</span>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <strong>Track Progress</strong>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Monitor your improvement over time</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SignupScreen;
