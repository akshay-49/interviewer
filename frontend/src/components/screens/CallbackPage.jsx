import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useInterview } from '../../context/InterviewContext';

const CallbackPage = () => {
    const { isAuthenticated, user, isLoading } = useAuth0();
    const { navigateTo, updateUser } = useInterview();

    useEffect(() => {
        if (!isLoading && isAuthenticated && user) {
            // Update app state with user info
            updateUser({
                name: user.name || user.email,
                email: user.email,
                isLoggedIn: true,
                isAdmin: user.email?.endsWith('@accellor.com') || false,
                picture: user.picture,
            });

            // Redirect to appropriate screen
            const isAdmin = user.email?.endsWith('@accellor.com') || false;
            navigateTo(isAdmin ? 'admin-dashboard' : 'welcome');
        }
    }, [isAuthenticated, isLoading, user, navigateTo, updateUser]);

    if (isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">Processing login...</p>
                </div>
            </div>
        );
    }

    return null;
};

export default CallbackPage;
