import React, { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';

const WelcomeScreen = () => {
    const { navigateTo, backendAvailable, theme, toggleTheme } = useInterview();
    const [micAvailable, setMicAvailable] = useState(null);
    const [permissionDenied, setPermissionDenied] = useState(false);

    useEffect(() => {
        // Check for microphone availability
        checkMicrophoneAccess();
    }, []);

    const checkMicrophoneAccess = async () => {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            
            if (result.state === 'granted') {
                setMicAvailable(true);
                setPermissionDenied(false);
            } else if (result.state === 'denied') {
                setMicAvailable(false);
                setPermissionDenied(true);
            } else if (result.state === 'prompt') {
                setMicAvailable(null); // Not yet requested
                setPermissionDenied(false);
            }

            result.addEventListener('change', () => {
                if (result.state === 'granted') {
                    setMicAvailable(true);
                    setPermissionDenied(false);
                } else if (result.state === 'denied') {
                    setMicAvailable(false);
                    setPermissionDenied(true);
                }
            });
        } catch (error) {
            console.log('Permissions API not supported, will request on button click');
            setMicAvailable(null);
        }
    };

    const handleStartInterview = async () => {
        if (!backendAvailable) {
            alert('Backend not available. Please check connection.');
            return;
        }

        // Request microphone access if not already granted
        if (micAvailable === null || micAvailable === false) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Stop the stream immediately, we just wanted to test access
                stream.getTracks().forEach(track => track.stop());
                setMicAvailable(true);
                setPermissionDenied(false);
                navigateTo('setup');
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    setPermissionDenied(true);
                    setMicAvailable(false);
                    alert('Microphone access denied. Please enable microphone in your browser settings.');
                } else if (error.name === 'NotFoundError') {
                    alert('No microphone found. Please check your device.');
                } else {
                    console.error('Microphone error:', error);
                    alert('Unable to access microphone: ' + error.message);
                }
                return;
            }
        } else {
            navigateTo('setup');
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col overflow-x-hidden transition-colors duration-300">
            {/* Header */}
            <header className="w-full border-b border-[#ebefef] dark:border-gray-800 bg-white/50 dark:bg-[#22252a]/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-xl">graphic_eq</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-[#121617] dark:text-white">InterviewPrep AI</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="inline-flex items-center justify-center size-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 text-gray-700 dark:text-gray-200 shadow-sm hover:shadow transition-all"
                            aria-label="Toggle color theme"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            <span className="material-symbols-outlined text-lg">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                        </button>
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                            {backendAvailable ? '🟢 Connected' : '🔴 Offline'}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-10 relative w-full">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                <div className="glass-panel w-full max-w-6xl rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 sm:p-8 md:p-12 items-center">
                        {/* Left Side - Welcome Message */}
                        <div className="space-y-6 sm:space-y-8">
                            <div className="inline-flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 rounded-2xl bg-primary/10 dark:bg-primary/20">
                                <span className="material-symbols-outlined text-4xl sm:text-5xl text-primary">psychology</span>
                            </div>

                            <div className="space-y-3 sm:space-y-4">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                                    Welcome to AI Interview Coach
                                </h1>
                                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                                    Practice your technical interviews with AI-powered feedback and real-time evaluation. Master your interview skills at your own pace.
                                </p>
                            </div>
                        </div>

                        {/* Right Side - Action and Permission Card */}
                        <div className="flex flex-col items-center gap-6 sm:gap-8">
                            <button
                                onClick={handleStartInterview}
                                disabled={!backendAvailable || permissionDenied}
                                className="group relative inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary text-sm sm:text-base w-full sm:w-auto justify-center"
                            >
                                <span className="material-symbols-outlined text-xl sm:text-2xl group-hover:animate-pulse">mic</span>
                                <span>Start Interview</span>
                            </button>

                            {/* Microphone Permission Card */}
                            <div className="relative w-full max-w-sm mx-auto">
                                <div className="absolute -inset-0.5 bg-gradient-to-b from-gray-200 to-transparent dark:from-gray-700 rounded-xl sm:rounded-2xl opacity-50 pointer-events-none"></div>
                                <div className={`relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-lg border backdrop-blur-sm transition-all duration-300 ${
                                    permissionDenied 
                                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
                                        : 'bg-white dark:bg-[#2d3138] border-gray-100 dark:border-gray-800'
                                }`}>
                                    <div className={`flex-shrink-0 size-10 sm:size-12 rounded-full flex items-center justify-center ${
                                        permissionDenied 
                                            ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' 
                                            : 'bg-accent/10 text-accent'
                                    }`}>
                                        <span className="material-symbols-outlined text-xl sm:text-2xl">
                                            {permissionDenied ? 'mic_off' : 'keyboard_voice'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-left gap-0.5 sm:gap-1">
                                        <h3 className={`text-sm sm:text-base font-bold ${
                                            permissionDenied 
                                                ? 'text-red-700 dark:text-red-300' 
                                                : 'text-[#121617] dark:text-white'
                                        }`}>
                                            Microphone Access
                                        </h3>
                                        <p className={`text-xs sm:text-sm leading-relaxed ${
                                            permissionDenied 
                                                ? 'text-red-600 dark:text-red-400' 
                                                : 'text-gray-600 dark:text-gray-400'
                                        }`}>
                                            {permissionDenied 
                                                ? 'Blocked in settings' 
                                                : 'Enable to answer by voice'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default WelcomeScreen;
