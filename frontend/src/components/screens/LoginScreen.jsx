import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const LoginScreen = () => {
    const { navigateTo, updateUser } = useInterview();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const returnTo = `${window.location.origin}/callback`;
            window.location.assign(`${apiBaseUrl}/auth/login?screen_hint=login&return_to=${encodeURIComponent(returnTo)}`);
        } catch (err) {
            console.error('Login error:', err);
            setError('Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10 relative w-full overflow-hidden">
                <div className="absolute -top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10"></div>
                <div className="absolute -bottom-16 right-12 w-80 h-80 bg-[#5fe1f1]/10 rounded-full blur-3xl -z-10"></div>

                <div className="w-full max-w-lg rounded-2xl shadow-2xl shadow-gray-200/50 dark:shadow-black/30 overflow-hidden bg-white/80 dark:bg-[#1b1f24]/80 backdrop-blur-xl border border-[#e6f3f5] dark:border-gray-800 p-10">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/20 mb-4">
                            <span className="material-symbols-outlined text-3xl text-primary">verified_user</span>
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                            Candidate Login
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Log in into your account to continue.
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Redirecting...' : 'Login'}
                        </button>
                    </form>

                    {/* Info Section */}
                    <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                            Invite-only candidates
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                            Use the invite link from your email to sign up.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LoginScreen;
