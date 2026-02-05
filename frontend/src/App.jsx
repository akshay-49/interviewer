import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { InterviewProvider } from './context/InterviewContext';
import ScreenManager from './components/ScreenManager';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    const { isLoading, isAuthenticated } = useAuth0();

    if (isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <InterviewProvider>
            {isAuthenticated ? (
                <ProtectedRoute>
                    <ScreenManager />
                </ProtectedRoute>
            ) : (
                <ScreenManager />
            )}
        </InterviewProvider>
    );
}

export default App;
