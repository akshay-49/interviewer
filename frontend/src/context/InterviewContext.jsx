import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api, stopAudioPlayback } from '../utils/api';

const InterviewContext = createContext();

export const useInterview = () => {
    const context = useContext(InterviewContext);
    if (!context) {
        throw new Error('useInterview must be used within InterviewProvider');
    }
    return context;
};

export const InterviewProvider = ({ children }) => {
    const [currentScreen, setCurrentScreen] = useState('login');
    const [currentParams, setCurrentParams] = useState(null);
    const [backendAvailable, setBackendAvailable] = useState(false);
    const stopRecordingCallbackRef = useRef(null);

    // Theme selection (light/dark) with system + localStorage preference
    const getPreferredTheme = () => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
        if (stored === 'light' || stored === 'dark') return stored;
        const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    };

    const [theme, setTheme] = useState(getPreferredTheme);

    // User state (for profile, login, etc.)
    const [user, setUser] = useState({
        name: 'Guest User',
        email: null,
        isLoggedIn: false,
    });

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
        userId: null,
        userEmail: null,
        userName: null,
        jobTitle: null,
        companyName: null,
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
        startedAt: null,
    });

    // Check backend availability on mount
    useEffect(() => {
        const checkBackend = async () => {
            const result = await api.healthCheck();
            setBackendAvailable(!!result);
        };
        checkBackend();
    }, []);

    // Browser back/forward button support
    useEffect(() => {
        const handlePopState = (event) => {
            const screen = event.state?.screen || 'login';
            const params = event.state?.params || null;
            stopAudioPlayback();
            setCurrentScreen(screen);
            setCurrentParams(params);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Push state to history when currentScreen changes
    useEffect(() => {
        const state = { screen: currentScreen, params: currentParams };
        const title = currentScreen.charAt(0).toUpperCase() + currentScreen.slice(1);
        window.history.pushState(state, title);
    }, [currentScreen, currentParams]);

    const updateInterview = (updates) => {
        setInterview(prev => ({ ...prev, ...updates }));
    };

    const updateUser = (updates) => {
        setUser(prev => ({ ...prev, ...updates }));
    };

    const resetInterview = () => {
        setInterview({
            sessionId: null,
            userId: null,
            userEmail: null,
            userName: null,
            jobTitle: null,
            companyName: null,
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
            startedAt: null,
        });
    };

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    const navigateTo = (screen, params = null, replaceHistory = false) => {
        // Stop recording if we're leaving the interview screen
        if (screen !== 'interview' && stopRecordingCallbackRef.current) {
            console.log('Navigating away from interview, stopping recording');
            stopRecordingCallbackRef.current();
        }

        stopAudioPlayback();
        
        setCurrentScreen(screen);
        setCurrentParams(params);
        
        const state = { screen, params };
        const title = screen.charAt(0).toUpperCase() + screen.slice(1);
        
        if (replaceHistory) {
            window.history.replaceState(state, title);
        }
    };

    const registerStopRecordingCallback = (callback) => {
        stopRecordingCallbackRef.current = callback;
    };

    const value = {
        currentScreen,
        currentParams,
        backendAvailable,
        interview,
        updateInterview,
        resetInterview,
        navigateTo,
        setInterview,
        theme,
        toggleTheme,
        user,
        updateUser,
        registerStopRecordingCallback,
    };

    return (
        <InterviewContext.Provider value={value}>
            {children}
        </InterviewContext.Provider>
    );
};
