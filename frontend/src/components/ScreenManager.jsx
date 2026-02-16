import React, { useEffect } from 'react';
import { useInterview } from '../context/InterviewContext';
import ProfileMenu from './ProfileMenu';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import SetupScreen from './screens/SetupScreen';
import ModeSelectionScreen from './screens/ModeSelectionScreen';
import InterviewScreen from './screens/InterviewScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import ResultsScreen from './screens/ResultsScreen';
import ReportScreen from './screens/ReportScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';
import InviteCandidateScreen from './screens/InviteCandidateScreen';
import UserSessionsScreen from './screens/UserSessionsScreen';
import InviteAcceptanceScreen from './screens/InviteAcceptanceScreen';
import CustomLoginScreen from './screens/CustomLoginScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';
import CallbackPage from './screens/CallbackPage';

const ScreenManager = () => {
    const { currentScreen, currentParams, theme, toggleTheme, navigateTo, interview, resetInterview, user } = useInterview();
    const adminLoginLock = typeof window !== 'undefined'
        && (sessionStorage.getItem('adminLoginInProgress') || sessionStorage.getItem('adminLoginVerifying'));

    // Check for special routes in URL on mount
    useEffect(() => {
        const path = window.location.pathname;
        
        // Preserve MSAL response fragment on root redirect
        const adminLoginInProgress = sessionStorage.getItem('adminLoginInProgress');
        if (adminLoginInProgress) {
            const search = window.location.search || '';
            const hash = window.location.hash || '';
            const responseFragment = `${search}${hash}`;
            const hasMsalResponse = /[?#].*(code=|access_token=|id_token=|error=)/i.test(responseFragment);

            if (hasMsalResponse && path === '/') {
                window.location.replace(`/admin-login${responseFragment}`);
            }
        }
    }, []);

    const renderScreen = () => {
        if (adminLoginLock && currentScreen !== 'admin-dashboard') {
            return <AdminLoginScreen />;
        }
        // If on admin-login or admin-dashboard, show dashboard if already logged in as admin
        if ((currentScreen === 'admin-login' || currentScreen === 'login') && user?.isAdmin) {
            return <AdminDashboardScreen />;
        }
        switch (currentScreen) {
            case 'login':
                return <LoginScreen />;
            case 'admin-login':
                return <AdminLoginScreen />;
            case 'custom-login':
                return <CustomLoginScreen />;
            case 'signup':
                return <SignupScreen />;
            case 'forgot-password':
                return <ForgotPasswordScreen />;
            case 'welcome':
                return <WelcomeScreen />;
            case 'setup':
                return <SetupScreen />;
            case 'mode-selection':
                return <ModeSelectionScreen autoStart={currentParams?.autoStart} preselectedMode={currentParams?.recordingMode} />;
            case 'interview':
                return <InterviewScreen />;
            case 'history':
                return <HistoryScreen />;
            case 'profile':
                return <ProfileScreen />;
            case 'report':
                return <ReportScreen />;
            case 'results':
                return <ResultsScreen />;
            case 'admin-dashboard':
                return <AdminDashboardScreen />;
            case 'invite-candidate':
                return <InviteCandidateScreen />;
            case 'user-sessions':
                return <UserSessionsScreen />;
            case 'invite-acceptance':
                return <InviteAcceptanceScreen inviteCode={currentParams?.invite_code} />;
            case 'callback':
                return <CallbackPage />;
            default:
                return <LoginScreen />;
        }
    };

    const handleLogoClick = () => {
        // Only show confirmation if we're on a screen that has active session
        if (currentScreen === 'interview') {
            const confirmed = window.confirm('Are you sure you want to exit the interview? Your progress will not be saved.');
            if (confirmed) {
                resetInterview();
                navigateTo('welcome');
            }
        } else if (currentScreen === 'setup' || currentScreen === 'results') {
            // Also confirm for other screens to prevent accidental navigation
            resetInterview();
            navigateTo('welcome');
        } else if (currentScreen === 'report' && currentParams?.isAdmin) {
            // If viewing report from admin context, go back to admin dashboard
            navigateTo('admin-dashboard');
        } else if (currentScreen === 'user-sessions') {
            // User sessions screen is also admin, go to admin dashboard
            navigateTo('admin-dashboard');
        } else if (currentScreen !== 'login' && currentScreen !== 'signup' && currentScreen !== 'forgot-password') {
            // Already on welcome or other non-auth screen
            navigateTo('welcome');
        }
    };

    // Check if we're on an auth screen
    const isAuthScreen = ['login', 'signup', 'forgot-password', 'custom-login', 'callback', 'admin-login'].includes(currentScreen);
    const isAdminScreen = ['admin-dashboard', 'invite-candidate', 'user-sessions'].includes(currentScreen);
    const isInviteScreen = currentScreen === 'invite-acceptance';
    const showProfileMenu = !['admin-login', 'admin-dashboard', 'invite-candidate'].includes(currentScreen);

    return (
        <div className="w-screen h-screen flex flex-col">
            {/* Header */}
            {isAdminScreen || isInviteScreen ? null : isAuthScreen ? (
                // Minimal header for auth screens - just logo
                <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-2 flex justify-start items-center flex-shrink-0">
                    <img src="/accellor-logo.svg" alt="Accellor" className="h-8" />
                </header>
            ) : (
                // Full header for other screens
            <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-2 flex justify-between items-center flex-shrink-0">
                {/* Left: Accellor Logo */}
                <button
                    onClick={handleLogoClick}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer"
                    title="Go to home"
                >
                    <img src="/accellor-logo.svg" alt="Accellor" className="h-8" />
                </button>

                {/* Right: Theme Toggle & Profile */}
                <div className="flex items-center gap-4">
                    {/* Theme Toggle & Status */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? (
                                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 011.414-1.414zM5 11a1 1 0 100-2H4a1 1 0 100 2h1zM4 14a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            )}
                        </button>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>

                    {/* Profile Menu - hidden on admin screens */}
                    {showProfileMenu && <ProfileMenu />}
                </div>
            </header>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto w-full">
                {renderScreen()}
            </main>
        </div>
    );
};

export default ScreenManager;
