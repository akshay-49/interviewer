import React, { useEffect, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { playAudioFromBase64 } from '../../utils/api';
import { QAReviewCard } from '../QAReviewCard';
import html2pdf from 'html2pdf.js';

const ResultsScreen = () => {
    const { interview, navigateTo, theme, toggleTheme } = useInterview();
    const audioPlayedRef = useRef(false);
    const contentRef = useRef(null);

    const summary = interview.summary || {};
    const whatWentWell = summary.what_went_well || [];
    const areasForImprovement = summary.areas_for_improvement || [];

    // Debug logging
    useEffect(() => {
        console.log('ResultsScreen mounted with interview:', interview);
        console.log('hintsUsed:', interview.hintsUsed);
        console.log('questionsSkipped:', interview.questionsSkipped);
        console.log('questionWiseFeedback:', interview.questionWiseFeedback);
    }, [interview]);

    // Play closing audio when component mounts
    useEffect(() => {
        if (interview.closingAudio && !audioPlayedRef.current) {
            console.log('Playing closing audio feedback');
            audioPlayedRef.current = true;
            playAudioFromBase64(interview.closingAudio)
                .then(() => {
                    console.log('Closing audio finished playing');
                })
                .catch((error) => {
                    console.warn('Failed to play closing audio:', error);
                });
        }
    }, [interview.closingAudio]);

    const exportToPDF = async () => {
        try {
            const summary = interview.summary || {};
            const whatWentWell = summary.what_went_well || [];
            const areasForImprovement = summary.areas_for_improvement || [];
            const feedback = interview.questionWiseFeedback || [];
            
            // Create a clean HTML structure for PDF
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                    <h1 style="color: #365C63; text-align: center; margin-bottom: 10px;">Interview Results</h1>
                    <p style="text-align: center; color: #666; margin-bottom: 30px;">InterviewPrep AI - Interview Coaching Report</p>
                    
                    <hr style="border: 1px solid #ddd; margin: 30px 0;">
                    
                    <!-- Performance Section -->
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #365C63; font-size: 20px; border-bottom: 2px solid #365C63; padding-bottom: 10px; margin-bottom: 15px;">Performance Summary</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                            <div style="padding: 15px; background-color: #f5f5f5; border-radius: 5px; border-left: 4px solid #365C63;">
                                <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">OVERALL SCORE</p>
                                <p style="margin: 0; font-size: 32px; font-weight: bold; color: #365C63;">${summary.average_score || 0}/10</p>
                            </div>
                            <div style="padding: 15px; background-color: #f5f5f5; border-radius: 5px; border-left: 4px solid #365C63;">
                                <p style="margin: 0 0 5px 0; color: #666; font-size: 12px;">VERDICT</p>
                                <p style="margin: 0; font-size: 16px; font-weight: bold; color: #365C63;">${summary.verdict || 'Interview Complete'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Statistics Section -->
                    <div style="margin-bottom: 30px;">
                        <h2 style="color: #365C63; font-size: 20px; border-bottom: 2px solid #365C63; padding-bottom: 10px; margin-bottom: 15px;">Interview Statistics</h2>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div style="padding: 15px; background-color: #fff3cd; border-radius: 5px;">
                                <p style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: bold;">HINTS USED</p>
                                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #ff9800;">${interview.hintsUsed || 0}</p>
                            </div>
                            <div style="padding: 15px; background-color: #ffe0b2; border-radius: 5px;">
                                <p style="margin: 0 0 10px 0; color: #666; font-size: 12px; font-weight: bold;">QUESTIONS SKIPPED</p>
                                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #ff9800;">${interview.questionsSkipped || 0}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- What Went Well Section -->
                    <div style="margin-bottom: 30px; page-break-inside: avoid;">
                        <h2 style="color: #365C63; font-size: 20px; border-bottom: 2px solid #365C63; padding-bottom: 10px; margin-bottom: 15px;">✓ What Went Well</h2>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${whatWentWell.map(point => `
                                <li style="margin-bottom: 10px; padding-left: 25px; position: relative;">
                                    <span style="position: absolute; left: 0; color: #4caf50; font-weight: bold;">✓</span>
                                    ${point}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <!-- Areas for Improvement Section -->
                    <div style="margin-bottom: 30px; page-break-inside: avoid;">
                        <h2 style="color: #365C63; font-size: 20px; border-bottom: 2px solid #365C63; padding-bottom: 10px; margin-bottom: 15px;">→ Areas for Improvement</h2>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${areasForImprovement.map(point => `
                                <li style="margin-bottom: 10px; padding-left: 25px; position: relative;">
                                    <span style="position: absolute; left: 0; color: #ff9800; font-weight: bold;">!</span>
                                    ${point}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    
                    <!-- Q&A Review Section -->
                    ${feedback.length > 0 ? `
                        <div style="margin-bottom: 30px;">
                            <h2 style="color: #365C63; font-size: 20px; border-bottom: 2px solid #365C63; padding-bottom: 10px; margin-bottom: 15px;">Question-wise Feedback</h2>
                            ${feedback.map((item, index) => `
                                <div style="margin-bottom: 25px; padding: 15px; background-color: #f9f9f9; border-radius: 5px; page-break-inside: avoid;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                        <h3 style="margin: 0; color: #365C63; font-size: 16px;">Question ${index + 1}</h3>
                                        <span style="color: white; background-color: #365C63; padding: 5px 10px; border-radius: 3px; font-weight: bold;">Score: ${item.score || 0}/10</span>
                                    </div>
                                    <p style="margin: 10px 0; font-weight: bold; color: #555;"><strong>Topic:</strong> ${item.topic || 'N/A'}</p>
                                    <p style="margin: 10px 0; color: #333;"><strong>Question:</strong> ${item.question || 'N/A'}</p>
                                    <p style="margin: 10px 0; color: #333;"><strong>Your Answer:</strong> ${item.answer || 'Skipped'}</p>
                                    ${item.strengths && item.strengths.length > 0 ? `
                                        <div style="margin: 10px 0;">
                                            <strong style="color: #4caf50;">Strengths:</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px;">
                                                ${item.strengths.map(s => `<li>${s}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${item.weaknesses && item.weaknesses.length > 0 ? `
                                        <div style="margin: 10px 0;">
                                            <strong style="color: #ff9800;">Weaknesses:</strong>
                                            <ul style="margin: 5px 0; padding-left: 20px;">
                                                ${item.weaknesses.map(w => `<li>${w}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${item.feedback ? `
                                        <p style="margin: 10px 0; color: #333;"><strong>Feedback:</strong> ${item.feedback}</p>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <hr style="border: 1px solid #ddd; margin: 30px 0;">
                    <p style="text-align: center; color: #999; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
                </div>
            `;
            
            const opt = {
                margin: 10,
                filename: `Interview_Results_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, logging: false },
                jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            html2pdf().set(opt).fromString(htmlContent).save();
        } catch (error) {
            console.error('Failed to export PDF:', error);
            alert('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-[#ebefef] dark:border-gray-800 bg-white/80 dark:bg-[#22252a]/80 backdrop-blur-md">
                <div className="px-6 md:px-10 py-4 flex items-center justify-between max-w-[1400px] mx-auto">
                    <div className="flex items-center gap-3 text-primary dark:text-white">
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary dark:text-teal-300">
                            <span className="material-symbols-outlined text-2xl">graphic_eq</span>
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-[#121617] dark:text-white">InterviewPrep AI</h2>
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
                        <button onClick={() => navigateTo('welcome')} className="px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors">
                            Home
                        </button>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="flex-grow flex flex-col items-center justify-center p-3 md:p-6 max-w-7xl mx-auto w-full overflow-y-auto" ref={contentRef}>
                {/* Intro */}
                <div className="flex flex-col items-center w-full max-w-2xl text-center mb-6">
                    <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 dark:bg-primary/20 border border-primary/10 dark:border-primary/30">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-widest text-primary dark:text-teal-300">Analysis</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-[#121617] dark:text-white leading-snug mb-2">
                        Your Interview Feedback
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm max-w-lg">
                        Performance breakdown and recommendations.
                    </p>
                </div>

                {/* Score Display */}
                <div className="w-full max-w-3xl mb-6">
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-xl p-4 md:p-6 border border-primary/20 dark:border-primary/30">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-primary dark:text-teal-300 uppercase tracking-widest mb-1">Performance</p>
                                <h2 className="text-lg md:text-xl font-bold text-[#121617] dark:text-white mb-1">
                                    Score: <span className="text-primary dark:text-teal-300">{summary.average_score || 0}/10</span>
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 text-sm font-semibold">
                                    {summary.verdict || 'Interview Complete'}
                                </p>
                            </div>
                            <div className="flex-shrink-0">
                                <div className="relative w-24 h-24 md:w-28 md:h-28 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        {/* Background circle */}
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                                        {/* Progress circle */}
                                        <circle 
                                            cx="50" 
                                            cy="50" 
                                            r="45" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            strokeWidth="3" 
                                            strokeLinecap="round"
                                            className="text-primary dark:text-teal-400 transition-all duration-1000"
                                            strokeDasharray={`${(summary.average_score || 0) * 28.27} 282.7`}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <p className="text-xl md:text-2xl font-bold text-primary dark:text-teal-300">{summary.average_score || 0}</p>
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">out of 10</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Interview Stats */}
                <div className="w-full max-w-3xl mb-6">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-[#2C3035] rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-lg text-amber-500">lightbulb</span>
                                <p className="text-2xl font-bold text-amber-500">{interview.hintsUsed || 0}</p>
                            </div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Hints Used</p>
                        </div>
                        <div className="bg-white dark:bg-[#2C3035] rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-lg text-orange-500">skip_next</span>
                                <p className="text-2xl font-bold text-orange-500">{interview.questionsSkipped || 0}</p>
                            </div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Questions Skipped</p>
                        </div>
                    </div>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl mb-6">
                    {/* What Went Well */}
                    <div className="group relative bg-white dark:bg-[#2C3035] rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-teal-500/70">
                        <div className="absolute top-3 right-3 text-teal-500/40 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-3xl">thumb_up</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            </div>
                            <h3 className="text-sm font-bold text-[#121617] dark:text-white">What Went Well</h3>
                        </div>
                        <ul className="space-y-2">
                            {whatWentWell.map((point, i) => (
                                <li key={i} className="flex gap-2 text-[#121617] dark:text-gray-200 leading-snug text-sm">
                                    <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 mt-0.5 text-lg flex-shrink-0">arrow_right_alt</span>
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Areas for Improvement */}
                    <div className="group relative bg-white dark:bg-[#2C3035] rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300 border-t-4 border-rose-400/70">
                        <div className="absolute top-3 right-3 text-rose-400/40 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-3xl">psychology_alt</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-rose-400/10 text-rose-500 dark:text-rose-400">
                                <span className="material-symbols-outlined text-lg">tips_and_updates</span>
                            </div>
                            <h3 className="text-sm font-bold text-[#121617] dark:text-white">Areas for Improvement</h3>
                        </div>
                        <ul className="space-y-2">
                            {areasForImprovement.map((point, i) => (
                                <li key={i} className="flex gap-2 text-[#121617] dark:text-gray-200 leading-snug text-sm">
                                    <span className="material-symbols-outlined text-rose-500 dark:text-rose-400 mt-0.5 text-lg flex-shrink-0">priority_high</span>
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Q&A Review Section */}
                {interview.questionWiseFeedback && interview.questionWiseFeedback.length > 0 && (
                    <div className="w-full max-w-3xl mb-6">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-[#121617] dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">rate_review</span>
                                Q&A Review
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Detailed feedback for each question</p>
                        </div>
                        <div className="space-y-4">
                            {interview.questionWiseFeedback.map((feedback, index) => (
                                <QAReviewCard key={index} feedback={feedback} index={index} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 justify-center">
                    <button onClick={exportToPDF} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm shadow-lg transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">download</span>
                        Export as PDF
                    </button>
                    <button onClick={() => navigateTo('setup')} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg text-sm shadow-lg transition-all">Practice Again</button>
                    <button onClick={() => navigateTo('welcome')} className="px-4 py-2 bg-white dark:bg-[#2C3035] border border-gray-200 dark:border-gray-700 text-[#121617] dark:text-gray-100 font-bold rounded-lg text-sm shadow-sm transition-all">Home</button>
                </div>
            </main>
        </div>
    );
};
export default ResultsScreen;
