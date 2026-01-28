import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const InterviewContext = createContext();

export const useInterview = () => {
    const context = useContext(InterviewContext);
    if (!context) {
        throw new Error('useInterview must be used within InterviewProvider');
    }
    return context;
};

export const InterviewProvider = ({ children }) => {
    const [currentScreen, setCurrentScreen] = useState('welcome');
    const [backendAvailable, setBackendAvailable] = useState(false);

    // Theme selection (light/dark) with system + localStorage preference
    const getPreferredTheme = () => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
        if (stored === 'light' || stored === 'dark') return stored;
        const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    };

    const [theme, setTheme] = useState(getPreferredTheme);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const [interview, setInterview] = useState({
        sessionId: null,
        role: null,
        roleDisplay: '',
        persona: 'strict',
        experience: null,
        currentQuestion: null,
        questionText: null,
        feedbackText: null,
        audioPlaying: false,
        isRecording: false,
        recognition: null,
        questionNumber: 0,
        totalQuestions: 5,
        answers: [],
        summary: null,
        hintsUsed: 0,
        questionsSkipped: 0,
        questionWiseFeedback: [],
    });

    // Check backend availability on mount
    useEffect(() => {
        const checkBackend = async () => {
            const result = await api.healthCheck();
            setBackendAvailable(!!result);
        };
        checkBackend();
    }, []);

    const updateInterview = (updates) => {
        setInterview(prev => ({ ...prev, ...updates }));
    };

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    const navigateTo = (screen) => {
        setCurrentScreen(screen);
    };

    const value = {
        currentScreen,
        backendAvailable,
        interview,
        updateInterview,
        navigateTo,
        setInterview,
        theme,
        toggleTheme,
    };

    return (
        <InterviewContext.Provider value={value}>
            {children}
        </InterviewContext.Provider>
    );
};
