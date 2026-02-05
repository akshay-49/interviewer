import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';

/**
 * Custom hook to manage Auth0 authentication
 */
export const useAuth = () => {
    const { isAuthenticated, user, loginWithRedirect, logout: auth0Logout, isLoading } = useAuth0();

    const login = useCallback(async () => {
        await loginWithRedirect({
            authorizationParams: {
                screen_hint: 'login',
                prompt: 'login',
            },
        });
    }, [loginWithRedirect]);

    const logout = useCallback(() => {
        auth0Logout({
            logoutParams: {
                returnTo: window.location.origin,
            },
        });
    }, [auth0Logout]);

    return {
        isAuthenticated,
        isLoading,
        user,
        login,
        logout,
    };
};
