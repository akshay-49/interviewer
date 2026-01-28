import React from 'react';
import { useInterview } from '../context/InterviewContext';
import WelcomeScreen from './screens/WelcomeScreen';
import SetupScreen from './screens/SetupScreen';
import InterviewScreen from './screens/InterviewScreen';
import ResultsScreen from './screens/ResultsScreen';

const ScreenManager = () => {
    const { currentScreen, theme, toggleTheme } = useInterview();

    const renderScreen = () => {
        switch (currentScreen) {
            case 'welcome':
                return <WelcomeScreen />;
            case 'setup':
                return <SetupScreen />;
            case 'interview':
                return <InterviewScreen />;
            case 'results':
                return <ResultsScreen />;
            default:
                return <WelcomeScreen />;
        }
    };

    return (
        <div className="w-full h-full">
            {renderScreen()}
        </div>
    );
};

export default ScreenManager;
