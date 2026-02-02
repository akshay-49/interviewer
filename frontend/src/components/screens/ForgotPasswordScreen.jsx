import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const ForgotPasswordScreen = () => {
    const { navigateTo } = useInterview();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        setTimeout(() => {
            setSubmitted(true);
            setIsLoading(false);
        }, 800);
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10 relative w-full overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                <div className="glass-panel w-full max-w-md rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800 p-8">
                    {!submitted ? (
                        <>
                            {/* Header */}
                            <div className="mb-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 mb-4">
                                    <span className="text-3xl">🔑</span>
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                                    Reset Password
                                </h1>
                                <p className="text-gray-600 dark:text-gray-300 text-sm">
                                    Enter your email address and we'll send you a link to reset your password.
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-6">
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
                                        required
                                    />
                                </div>

                                {/* Submit Button */}
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
                                            Sending...
                                        </>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </button>
                            </form>

                            {/* Back to Login */}
                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => navigateTo('login')}
                                    className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
                                >
                                    ← Back to Sign In
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Success Message */}
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 mb-4">
                                    <span className="text-3xl">✓</span>
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Check Your Email
                                </h1>
                                <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
                                    We've sent a password reset link to <strong>{email}</strong>. Check your email and click the link to reset your password.
                                </p>
                            </div>

                            {/* Back to Login */}
                            <div className="mt-8">
                                <button
                                    onClick={() => navigateTo('login')}
                                    className="w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold transition-colors"
                                >
                                    Back to Sign In
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ForgotPasswordScreen;
