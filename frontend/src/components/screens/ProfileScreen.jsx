import React, { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { historyApi } from '../../utils/api';

const ProfileScreen = () => {
    const { navigateTo, theme, user: contextUser, updateUser } = useInterview();
    const [formData, setFormData] = useState({
        user_id: '',
        user_name: '',
        user_email: '',
        job_title: '',
        company_name: '',
        experience_level: ''
    });
    const [saved, setSaved] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Load saved data from localStorage AND Cosmos DB on mount
    useEffect(() => {
        loadProfile();
    }, [contextUser?.id]);

    const loadProfile = async () => {
        setLoading(true);

        let authProfile = null;
        let userId = contextUser?.id || '';

        if (!userId) {
            try {
                const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                const response = await fetch(`${apiBaseUrl}/auth/me`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    authProfile = await response.json();
                    userId = authProfile?.id || '';
                    updateUser({
                        id: authProfile?.id || null,
                        name: authProfile?.full_name || authProfile?.email || 'User',
                        email: authProfile?.email || null,
                        isLoggedIn: true,
                        isAdmin: authProfile?.email?.endsWith('@accellor.com') || false,
                        picture: authProfile?.picture,
                    });
                }
            } catch (error) {
                console.error('Failed to load auth profile:', error);
            }
        }

        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            const profile = await historyApi.getUserProfile(userId);
            if (profile) {
                const profileData = {
                    user_id: profile.user_id,
                    user_name: profile.user_name || authProfile?.full_name || contextUser?.name || '',
                    user_email: profile.user_email || authProfile?.email || contextUser?.email || '',
                    job_title: profile.job_title || profile.role || '',
                    company_name: profile.company_name || '',
                    experience_level: profile.experience_level || profile.seniority_level || ''
                };
                setFormData(profileData);
            } else {
                setFormData(prev => ({
                    ...prev,
                    user_id: userId,
                    user_name: authProfile?.full_name || contextUser?.name || prev.user_name,
                    user_email: authProfile?.email || contextUser?.email || prev.user_email
                }));
            }
        } catch (error) {
            console.error('Failed to load profile from Cosmos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.user_id.trim()) {
            newErrors.user_id = 'User ID is required';
        }
        if (!formData.user_name.trim()) {
            newErrors.user_name = 'Name is required';
        }
        if (formData.user_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.user_email)) {
            newErrors.user_email = 'Please enter a valid email';
        }
        if (!formData.job_title.trim()) {
            newErrors.job_title = 'Job title is required';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        
        try {
            // Save to Cosmos DB
            await historyApi.saveUserProfile({
                user_id: formData.user_id,
                user_name: formData.user_name,
                user_email: formData.user_email,
                job_title: formData.job_title,
                company_name: formData.company_name,
                experience_level: formData.experience_level
            });

            updateUser({
                id: formData.user_id,
                name: formData.user_name,
                email: formData.user_email,
            });

            setSaved(true);
            setTimeout(() => {
                setSaved(false);
            }, 3000);
        } catch (error) {
            console.error('Failed to save profile:', error);
            alert('Profile saved to local storage but failed to sync to cloud. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-hidden">
            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 pt-8 md:pt-12 max-w-7xl mx-auto w-full overflow-y-auto">
                {/* Header */}
                <div className="flex flex-col items-center w-full max-w-4xl text-center mb-6 md:mb-8">
                    <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 dark:bg-primary/20 border border-primary/10 dark:border-primary/30">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-sm font-bold uppercase tracking-widest text-primary dark:text-teal-300">Profile Settings</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#121617] dark:text-white leading-snug mb-3">
                        Your Profile
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base max-w-2xl">
                        Update your information to personalize your interview experience.
                    </p>
                </div>

                {/* Form Card */}
                <div className="w-full max-w-4xl bg-white dark:bg-[#2C3035] rounded-2xl p-6 md:p-10 shadow-xl border border-gray-200 dark:border-gray-700">
                    {saved && (
                        <div className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
                            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-2xl">check_circle</span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Profile saved successfully!</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{/* User ID */}
                        <div>
                            <label htmlFor="user_id" className="block text-sm font-semibold text-[#121617] dark:text-white mb-2">
                                User ID <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="user_id"
                                name="user_id"
                                value={formData.user_id}
                                onChange={handleChange}
                                placeholder="e.g., john_doe_123"
                                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                                    errors.user_id
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1a1d21] text-[#121617] dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20'
                                }`}
                            />
                            {errors.user_id && (
                                <p className="text-red-500 text-xs mt-1">{errors.user_id}</p>
                            )}
                        </div>

                        {/* Name */}
                        <div>
                            <label htmlFor="user_name" className="block text-sm font-semibold text-[#121617] dark:text-white mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="user_name"
                                name="user_name"
                                value={formData.user_name}
                                onChange={handleChange}
                                placeholder="e.g., John Doe"
                                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                                    errors.user_name
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1a1d21] text-[#121617] dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20'
                                }`}
                            />
                            {errors.user_name && (
                                <p className="text-red-500 text-xs mt-1">{errors.user_name}</p>
                            )}
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="user_email" className="block text-sm font-semibold text-[#121617] dark:text-white mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="user_email"
                                name="user_email"
                                value={formData.user_email}
                                onChange={handleChange}
                                placeholder="e.g., john@example.com"
                                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                                    errors.user_email
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1a1d21] text-[#121617] dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20'
                                }`}
                            />
                            {errors.user_email && (
                                <p className="text-red-500 text-xs mt-1">{errors.user_email}</p>
                            )}
                        </div>

                        {/* Job Title */}
                        <div>
                            <label htmlFor="job_title" className="block text-sm font-semibold text-[#121617] dark:text-white mb-2">
                                Job Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="job_title"
                                name="job_title"
                                value={formData.job_title}
                                onChange={handleChange}
                                placeholder="e.g., Senior Software Engineer"
                                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                                    errors.job_title
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1a1d21] text-[#121617] dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20'
                                }`}
                            />
                            {errors.job_title && (
                                <p className="text-red-500 text-xs mt-1">{errors.job_title}</p>
                            )}
                        </div>

                        {/* Company Name */}
                        <div>
                            <label htmlFor="company_name" className="block text-sm font-semibold text-[#121617] dark:text-white mb-2">
                                Company Name
                            </label>
                            <input
                                type="text"
                                id="company_name"
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                placeholder="e.g., Tech Company Inc."
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1a1d21] text-[#121617] dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>

                        {/* Experience Level */}
                        <div>
                            <label htmlFor="experience_level" className="block text-sm font-semibold text-[#121617] dark:text-white mb-2">
                                Experience Level
                            </label>
                            <input
                                type="text"
                                id="experience_level"
                                name="experience_level"
                                value={formData.experience_level}
                                onChange={handleChange}
                                placeholder="e.g., Senior, Mid-Level, Junior"
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1a1d21] text-[#121617] dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className={`flex-1 px-6 py-3.5 ${
                                loading 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-primary hover:bg-primary/90 hover:shadow-xl'
                            } text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base`}
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-xl">autorenew</span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-xl">save</span>
                                    Save Profile
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => navigateTo('welcome')}
                            disabled={loading}
                            className="px-6 py-3.5 bg-white dark:bg-[#1a1d21] border-2 border-gray-300 dark:border-gray-600 text-[#121617] dark:text-gray-100 font-bold rounded-xl shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-[#252a30] hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                {/* Info Section */}
                <div className="w-full max-w-4xl mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 flex-shrink-0">info</span>
                        <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Why we collect this information</h3>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                This information is used to personalize your interview experience and create detailed performance reports. Your data is stored securely and used only for your interview coaching.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ProfileScreen;
