import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';

/**
 * Hook to retrieve access token silently
 */
export const useAuthToken = () => {
    const { getAccessTokenSilently, isAuthenticated } = useAuth0();

    const getToken = useCallback(async () => {
        if (!isAuthenticated) {
            return null;
        }

        try {
            return await getAccessTokenSilently({
                authorizationParams: {
                    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                    scope: 'openid profile email',
                },
            });
        } catch (error) {
            console.error('Failed to get access token:', error);
            return null;
        }
    }, [getAccessTokenSilently, isAuthenticated]);

    return { getToken };
};
