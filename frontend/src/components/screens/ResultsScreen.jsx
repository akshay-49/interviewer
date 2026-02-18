import React, { useEffect, useRef } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { historyApi } from '../../utils/api';

const ResultsScreen = () => {
    const { interview, navigateTo } = useInterview();
    const saveAttemptedRef = useRef(false);

    // Save session results to Cosmos DB when component mounts
    useEffect(() => {
        if (!saveAttemptedRef.current && interview.sessionId && interview.summary) {
            saveAttemptedRef.current = true;
            saveSessionResults();
        }
    }, [interview.sessionId, interview.summary]);

    const saveSessionResults = async () => {
        try {
            console.log('Saving session results to Cosmos DB...');
            console.log('interview.questionWiseFeedback at save time:', interview.questionWiseFeedback);
            console.log('interview.questionWiseFeedback length:', interview.questionWiseFeedback?.length);
            
            // Calculate duration in seconds
            const now = new Date();
            const startTime = interview.startedAt ? new Date(interview.startedAt) : now;
            const durationSeconds = Math.round((now - startTime) / 1000);
            
            const sessionData = {
                session_id: interview.sessionId,
                user_id: interview.userId || 'anonymous',
                user_email: interview.userEmail || 'unknown@example.com',
                user_name: interview.userName,
                job_title: interview.jobTitle,
                company_name: interview.companyName,
                summary: interview.summary,
                overall_score: (interview.answers?.length > 0) 
                    ? interview.summary.average_score || 0 
                    : 0,
                hints_used: interview.hintsUsed || 0,
                questions_skipped: interview.questionsSkipped || 0,
                total_questions: interview.totalQuestions || 0,
                answers: interview.answers || [],
                question_wise_feedback: interview.questionWiseFeedback || [],
                recording_mode: interview.recordingMode || 'audio',
                session_recording_blob_url: interview.sessionRecordingUrl || null,
                started_at: interview.startedAt || now.toISOString(),
                completed_at: now.toISOString(),
                duration_seconds: durationSeconds
            };
            
            console.log('Session data to save:', sessionData);
            console.log('question_wise_feedback in sessionData:', sessionData.question_wise_feedback);
            console.log('question_wise_feedback length in sessionData:', sessionData.question_wise_feedback.length);
            
            const result = await historyApi.saveSessionResults(sessionData);
            console.log('Session saved successfully:', result);
        } catch (error) {
            console.error('Failed to save session results:', error);
            // Don't block UI if saving fails
        }
    };



    return (
        <div className="bg-background-light dark:bg-background-dark font-display h-full flex flex-col overflow-hidden">
            {/* Main */}
            <main className="flex-1 flex flex-col items-center justify-center p-3 md:p-6 w-full">
                {/* Completion Success */}
                <div className="flex flex-col items-center text-center max-w-md">
                    {/* Success Icon */}
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-6 shadow-lg">
                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    
                    {/* Message */}
                    <h1 className="text-3xl md:text-4xl font-black text-[#0d191b] dark:text-white mb-3">
                        Interview Complete
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 text-base md:text-lg mb-8">
                        Thank you for taking the time to complete this interview. Your responses have been recorded.
                    </p>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 w-full">
                        <button 
                            onClick={() => navigateTo('invite-entrance')}
                            className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-lg transition-all"
                        >
                            Return Home
                        </button>
                    </div>

                    {/* Footer Message */}
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-8">
                        © 2026 Accellor. All rights reserved.
                    </p>
                </div>
            </main>
        </div>
    );
};
export default ResultsScreen;
