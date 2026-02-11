import React from 'react';
import { useInterview } from '../../context/InterviewContext';

const SignupScreen = () => {
    const { navigateTo } = useInterview();

    const handleLogin = () => {
        navigateTo('login');
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
                            <span className="text-3xl">📧</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Join Accellor
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Invite-only access
                        </p>
                    </div>

                    {/* Message */}
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                            <p className="text-blue-800 dark:text-blue-200 text-sm">
                                ✨ Accellor is by invitation only. 
                            </p>
                            <p className="text-blue-700 dark:text-blue-300 text-sm mt-2">
                                If you've received an invite link, click the link in your email to get started.
                            </p>
                        </div>

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

                    {/* Information */}
                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
                            Don't have an invite?
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                            Contact your recruitment team to request an invitation to interview with Accellor.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SignupScreen;

