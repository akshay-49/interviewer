import { useCallback } from 'react';

/**
 * Custom fetch wrapper that automatically adds Bearer token
 */
export const useAuthFetch = () => {
    const authFetch = useCallback(
        async (url, options = {}) => {
            try {
                const headers = {
                    ...options.headers,
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
        []
    );

    return { authFetch };
};
