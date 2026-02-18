import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const InviteEntranceScreen = () => {
    const { navigateTo } = useInterview();
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!inviteCode.trim()) {
            setError('Please enter your invite code');
            return;
        }

        setLoading(true);
        
        try {
            // Validate the invite code before navigating
            const response = await fetch('http://localhost:8000/admin/validate-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invite_code: inviteCode.trim() })
            });

            if (!response.ok) {
                throw new Error('Invalid or expired invite code');
            }

            // Navigate to the invite acceptance screen
            navigateTo('invite-acceptance', { invite_code: inviteCode.trim() });
        } catch (err) {
            console.error('Invite validation error:', err);
            setError(err.message || 'Failed to validate invite code');
            setLoading(false);
        }
    };

    const handleAdminLogin = () => {
        navigateTo('admin-login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 to-[#f6f8f8] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <img src="/accellor-logo.svg" alt="Accellor" className="h-10" />
                </div>

                {/* Welcome Card */}
                <div className="bg-white rounded-xl border border-[#cfe4e7] shadow-lg overflow-hidden">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-primary to-primary/80 p-8 text-center">
                        <h1 className="text-3xl font-black text-white mb-2">Welcome</h1>
                        <p className="text-white/90">Enter your invite code to begin</p>
                    </div>

                    {/* Form */}
                    <div className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Invite Code Input */}
                            <div>
                                <label htmlFor="inviteCode" className="block text-sm font-semibold text-[#0d191b] mb-3">
                                    Invite Code
                                </label>
                                <input
                                    id="inviteCode"
                                    type="text"
                                    value={inviteCode}
                                    onChange={(e) => {
                                        setInviteCode(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="Enter your invite code"
                                    className="w-full px-4 py-3 rounded-lg border-2 border-[#cfe4e7] focus:border-primary focus:outline-none transition-colors text-[#0d191b] font-medium"
                                    disabled={loading}
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                                    <span className="material-symbols-outlined text-red-600 flex-shrink-0">error</span>
                                    <p className="text-red-700 text-sm">{error}</p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || !inviteCode.trim()}
                                className="w-full px-6 py-3 bg-primary text-white font-bold rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                {loading ? 'Validating...' : 'Continue'}
                            </button>
                        </form>

                        {/* Divider */}
                       

                        
                    </div>

                    {/* Footer */}
                    <div className="bg-[#f6f8f8] border-t border-[#cfe4e7] p-6 text-center">
                        <p className="text-gray-500 text-xs">
                            © 2026 Accellor. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InviteEntranceScreen;
