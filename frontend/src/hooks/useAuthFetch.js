import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';

/**
 * Custom fetch wrapper that automatically adds Bearer token
 */
export const useAuthFetch = () => {
    const { getAccessTokenSilently } = useAuth0();

    const authFetch = useCallback(
        async (url, options = {}) => {
            try {
                const token = await getAccessTokenSilently({
                    authorizationParams: {
                        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
                    },
                });

                const headers = {
                    ...options.headers,
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                };

                return fetch(url, {
                    ...options,
                    headers,
                    credentials: 'include',
                });
            } catch (error) {
                console.error('Auth fetch error:', error);
                throw error;
            }
        },
        [getAccessTokenSilently]
    );

    return { authFetch };
};
