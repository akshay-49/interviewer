import React, { useState, useRef, useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../hooks/useAuth';

const ProfileMenu = () => {
    const { interview, user, navigateTo, updateUser, resetInterview } = useInterview();
    const { logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    // Get user display name - use user.name if available, otherwise use role
    const displayName = user?.name || interview.roleDisplay || 'Guest User';
    const initials = displayName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setIsOpen(false);
        
        try {
            // Clear all stored data
            localStorage.clear();
            sessionStorage.clear();
            
            // Reset app state
            updateUser({
                name: 'Guest User',
                email: null,
                isLoggedIn: false,
                isAdmin: false,
                picture: null,
            });
            resetInterview();
            
            // Call logout
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
            // Still navigate to login even if logout fails
            navigateTo('login');
        }
    };

    const handleProfile = () => {
        setIsOpen(false);
        navigateTo('profile');
    };

    const handleHistory = () => {
        setIsOpen(false);
        navigateTo('history');
    };

    return (
        <div ref={menuRef} className="relative">
            {/* Profile Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Profile menu"
            >
                {/* Avatar Circle */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                    {initials}
                </div>
                {/* User Name */}
                <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200">
                    {displayName}
                </span>
                {/* Chevron Icon */}
                <svg
                    className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    {/* Menu Header */}
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {displayName}
                        </p>
                    </div>

                    {/* Menu Items */}
                    <button
                        onClick={handleHistory}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        History
                    </button>

                    <button
                        onClick={handleProfile}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                    </button>

                    {/* Divider */}
                    <div className="border-b border-gray-200 dark:border-gray-700"></div>

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfileMenu;
