import { useCallback } from 'react';

/**
 * Hook to retrieve access token silently
 */
export const useAuthToken = () => {
    const getToken = useCallback(async () => {
        return null;
    }, []);

    return { getToken };
};
