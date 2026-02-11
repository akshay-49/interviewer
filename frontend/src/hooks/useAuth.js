import { useCallback, useEffect, useState } from 'react';

/**
 * Custom hook to manage Auth0 authentication
 */
export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMe = useCallback(async () => {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        try {
            const response = await fetch(`${apiBaseUrl}/auth/me`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setUser(data);
            } else {
                setUser(null);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMe();
    }, [fetchMe]);

    const login = useCallback(async () => {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const returnTo = `${window.location.origin}/callback`;
        window.location.assign(`${apiBaseUrl}/auth/login?screen_hint=login&return_to=${encodeURIComponent(returnTo)}`);
    }, []);

    const logout = useCallback(() => {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const returnTo = `${window.location.origin}/login`;
        window.location.assign(`${apiBaseUrl}/auth/logout?return_to=${encodeURIComponent(returnTo)}`);
    }, []);

    return {
        isAuthenticated: !!user,
        isLoading,
        user,
        login,
        logout,
    };
};
