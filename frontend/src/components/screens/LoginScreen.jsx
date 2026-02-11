import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const LoginScreen = () => {
    const { navigateTo, updateUser } = useInterview();
<<<<<<< HEAD
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        setTimeout(() => {
            // Dummy login - just update user and navigate to welcome
            updateUser({
                name: email || 'User',
                email: email || 'user@example.com',
                isLoggedIn: true,
            });
            navigateTo('welcome');
            setIsLoading(false);
        }, 800);
=======
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
>>>>>>> two
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10 relative w-full overflow-hidden">
<<<<<<< HEAD
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                <div className="glass-panel w-full max-w-md rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800 p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 mb-4">
                            <span className="text-3xl">🔐</span>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Welcome Back
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Sign in to your AI Interview Coach account
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => navigateTo('forgot-password')}
                                className="text-xs text-primary hover:text-primary/80 transition-colors"
                            >
                                Forgot password?
                            </button>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Signup Link */}
                    <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                        Don't have an account?{' '}
                        <button
                            onClick={() => navigateTo('signup')}
                            className="text-primary hover:text-primary/80 font-semibold transition-colors"
                        >
                            Sign up
                        </button>
=======
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
>>>>>>> two
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LoginScreen;
