import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { api, speakText } from '../../utils/api';

const SetupScreen = () => {
    const { navigateTo, updateInterview, backendAvailable, theme, toggleTheme } = useInterview();
    const [formData, setFormData] = useState({
        role: '',
        experience: '',
        jobDescription: '',
        persona: 'strict'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!backendAvailable) {
            alert('Backend is not available. Please start the backend server first.');
            return;
        }

        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        const roleMap = {
            'frontend': 'Frontend Developer',
            'backend': 'Backend Developer',
            'fullstack': 'Full Stack Engineer',
            'devops': 'DevOps Engineer',
            'pm': 'Product Manager'
        };

        const experienceMap = {
            'intern': 'Intern',
            'junior': 'Junior',
            'mid': 'Mid-Level',
            'senior': 'Senior'
        };

        const role = roleMap[formData.role] || formData.role || 'Software Engineer';
        const experience = experienceMap[formData.experience] || formData.experience || 'Mid-Level';
        const roleDisplay = `${experience} ${role} Interview`;

        try {
            console.log('Calling backend API to start interview...');
            const result = await api.startInterview(role, experience, formData.jobDescription, formData.persona === 'coach' ? 'coach' : 'strict');

            updateInterview({
                sessionId: result.session_id,
                currentQuestion: result.question,
                questionNumber: 1,
                role,
                experience,
                roleDescription: formData.jobDescription || '',
                persona: formData.persona === 'coach' ? 'coach' : 'strict',
                roleDisplay,
                questionText: result.question,
            });

            console.log('Interview started successfully!');
            navigateTo('interview');
        } catch (error) {
            console.error('Error starting interview:', error);
            alert('Failed to start interview. Please check backend connection.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-[#121617] dark:text-[#f0f0f0] font-display min-h-screen flex flex-col">
            {/* Header */}
            <header className="w-full border-b border-[#ebefef] dark:border-gray-800 bg-white/50 dark:bg-[#22252a]/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-xl">graphic_eq</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight">InterviewPrep AI</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="inline-flex items-center justify-center size-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 text-gray-700 dark:text-gray-200 shadow-sm hover:shadow transition-all"
                            aria-label="Toggle color theme"
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            <span className="material-symbols-outlined text-lg">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                        </button>
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
                        <button
                            onClick={() => navigateTo('welcome')}
                            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-primary transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex items-center justify-center p-2 sm:p-3 md:p-4 relative w-full">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-80 md:w-96 h-64 sm:h-80 md:h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-56 sm:w-72 md:w-80 h-56 sm:h-72 md:h-80 bg-teal-200/10 dark:bg-teal-900/10 rounded-full blur-3xl -z-10 animate-pulse" style={{animationDelay: '1s'}}></div>

                <div className="glass-panel w-full max-w-6xl rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 overflow-hidden bg-white/70 dark:bg-[#1e2126]/70 backdrop-blur-xl border border-white/50 dark:border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6 md:p-8 items-center">
                        {/* Left Side - Information */}
                        <div className="space-y-3 sm:space-y-4">
                            <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 rounded-2xl bg-primary/10 dark:bg-primary/20">
                                <span className="material-symbols-outlined text-3xl sm:text-4xl text-primary">settings</span>
                            </div>

                            <div className="space-y-2 sm:space-y-3">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                                    Setup Your Interview
                                </h1>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                    Customize your interview based on your role, experience, and job description.
                                </p>
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-primary flex-shrink-0 text-lg mt-0.5">check_circle</span>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">Select Your Role</h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Tech positions</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-primary flex-shrink-0 text-lg mt-0.5">check_circle</span>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">Experience Level</h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Your expertise</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-primary flex-shrink-0 text-lg mt-0.5">check_circle</span>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm">Job Description</h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Optional for tailoring</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Form */}
                        <div className="bg-white dark:bg-[#2d3138] rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800">
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {/* Role Selection */}
                                <div>
                                    <label htmlFor="role" className="block text-xs font-semibold mb-1.5 text-gray-900 dark:text-white">Role</label>
                                    <input
                                        id="role"
                                        name="role"
                                        type="text"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Frontend Developer..."
                                        list="roles-list"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm"
                                    />
                                    <datalist id="roles-list">
                                        <option value="Frontend Developer" />
                                        <option value="Backend Developer" />
                                        <option value="Full Stack Engineer" />
                                        <option value="DevOps Engineer" />
                                        <option value="Product Manager" />
                                        <option value="Solutions Architect" />
                                        <option value="Security Engineer" />
                                        <option value="Data Engineer" />
                                        <option value="QA Engineer" />
                                    </datalist>
                                </div>

                                {/* Experience Level */}
                                <div>
                                    <label htmlFor="experience" className="block text-xs font-semibold mb-1.5 text-gray-900 dark:text-white">Experience Level</label>
                                    <input
                                        id="experience"
                                        name="experience"
                                        type="text"
                                        value={formData.experience}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Junior, Mid-Level..."
                                        list="experience-list"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:border-transparent text-xs sm:text-sm"
                                    />
                                    <datalist id="experience-list">
                                        <option value="Intern" />
                                        <option value="Junior" />
                                        <option value="Mid-Level" />
                                        <option value="Senior" />
                                        <option value="Staff" />
                                        <option value="Principal" />
                                        <option value="Entry-level" />
                                    </datalist>
                                </div>

                                {/* Interviewer Persona */}
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 pl-1 block mb-2">Interviewer Persona</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Strict Persona */}
                                        <label className="relative cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                name="persona" 
                                                value="strict"
                                                checked={formData.persona === 'strict'}
                                                onChange={handleInputChange}
                                                className="peer sr-only"
                                            />
                                            <div className="h-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 peer-checked:border-primary peer-checked:ring-1 peer-checked:ring-primary peer-checked:bg-primary/5 dark:peer-checked:bg-primary/10 shadow-sm transition-all hover:border-primary/50">
                                                <div className="flex flex-col items-center text-center gap-1">
                                                    <div className="p-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-400 peer-checked:bg-primary peer-checked:text-white shadow-sm transition-colors">
                                                        <span className="material-symbols-outlined text-base">gavel</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-xs text-[#121617] dark:text-white leading-tight">Strict</p>
                                                        <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Formal</p>
                                                    </div>
                                                </div>
                                                <div className="absolute top-1 right-1 opacity-0 peer-checked:opacity-100 text-primary transition-opacity">
                                                    <span className="material-symbols-outlined text-base" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                                </div>
                                            </div>
                                        </label>

                                        {/* Coach Persona */}
                                        <label className="relative cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                name="persona" 
                                                value="coach"
                                                checked={formData.persona === 'coach'}
                                                onChange={handleInputChange}
                                                className="peer sr-only"
                                            />
                                            <div className="h-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 peer-checked:border-primary peer-checked:ring-1 peer-checked:ring-primary peer-checked:bg-primary/5 dark:peer-checked:bg-primary/10 shadow-sm transition-all hover:border-primary/50">
                                                <div className="flex flex-col items-center text-center gap-1">
                                                    <div className="p-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-400 peer-checked:bg-primary peer-checked:text-white shadow-sm transition-colors">
                                                        <span className="material-symbols-outlined text-base">volunteer_activism</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-xs text-[#121617] dark:text-white leading-tight">Coach</p>
                                                        <p className="text-[9px] font-medium text-gray-500 dark:text-gray-400 leading-tight\">Encouraging</p>
                                                    </div>
                                                </div>
                                                <div className="absolute top-1 right-1 opacity-0 peer-checked:opacity-100 text-primary transition-opacity">
                                                    <span className="material-symbols-outlined text-base" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Job Description (Optional) */}
                                <div>
                                    <label htmlFor="job-description" className="block text-xs font-semibold mb-1.5 text-gray-900 dark:text-white">
                                        Job Description <span className="text-gray-400 font-normal">(Optional)</span>
                                    </label>
                                    <textarea
                                        id="job-description"
                                        name="jobDescription"
                                        value={formData.jobDescription}
                                        onChange={handleInputChange}
                                        rows={2}
                                        placeholder="Paste job description for tailored questions..."
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-xs sm:text-sm"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={!backendAvailable || isSubmitting}
                                    className="w-full py-3 sm:py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-lg sm:text-xl">progress_activity</span>
                                            <span>Starting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg sm:text-xl">play_arrow</span>
                                            <span>Begin Interview</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SetupScreen;
