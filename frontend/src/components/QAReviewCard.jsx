import React, { useState } from 'react';

export const QAReviewCard = ({ feedback, index }) => {
    const [isExpanded, setIsExpanded] = useState(index === 0); // First card expanded by default
    
    if (!feedback) return null;

    const scoreColor = feedback.score >= 7 ? 'bg-green-50 text-green-700 border-green-100' :
                       feedback.score >= 5 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                       'bg-red-50 text-red-700 border-red-100';
    
    const scoreLabel = feedback.score >= 7 ? 'Strong Answer' :
                       feedback.score >= 5 ? 'Good Attempt' :
                       'Needs Review';

    return (
        <div className="bg-white rounded-xl shadow-soft border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div
                className="p-5 flex items-start gap-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Question Number Badge */}
                <div className="flex-shrink-0 size-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                    Q{feedback.questionNumber}
                </div>

                {/* Question Text */}
                <div className="flex-grow pt-1">
                    <h3 className="text-lg font-semibold text-[#1c1f22] leading-tight">
                        {feedback.question}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${scoreColor}`}>
                            {scoreLabel}
                        </span>
                        <span className="text-xs text-gray-400">• Score: {feedback.score?.toFixed(1)}/10</span>
                    </div>
                </div>

                {/* Expand Icon */}
                <div className="flex-shrink-0 pt-1">
                    <span className={`material-symbols-outlined text-primary transform transition-transform ${isExpanded ? '' : 'rotate-180'}`}>
                        expand_more
                    </span>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-6 bg-white animate-fade-in border-t border-gray-100">
                    {/* Answer Section */}
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Your Answer</h4>
                        <p className="text-gray-700 leading-relaxed text-base">
                            {feedback.answer}
                        </p>
                    </div>

                    {/* Score Display */}
                    <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-primary uppercase tracking-wider">Score</span>
                            <span className="text-2xl font-bold text-primary">{feedback.score?.toFixed(1)}/10</span>
                        </div>
                        {feedback.topic && (
                            <div className="mt-2 text-xs text-gray-600">
                                Topic: <span className="font-semibold text-gray-700">{feedback.topic}</span>
                            </div>
                        )}
                    </div>

                    {/* Strengths Section */}
                    {feedback.strengths && feedback.strengths.length > 0 && (
                        <div className="rounded-xl border border-green-100 bg-[#518151]/5 p-5 mb-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-accent-green text-[20px]">check_circle</span>
                                <h4 className="font-bold text-accent-green text-sm uppercase tracking-wide">Strengths</h4>
                            </div>
                            <ul className="space-y-3">
                                {feedback.strengths.map((strength, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-[#121617]/80 leading-relaxed">
                                        <span className="mt-1.5 size-1.5 rounded-full bg-accent-green flex-shrink-0"></span>
                                        <span>{strength}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Weaknesses/Improvements Section */}
                    {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                        <div className="rounded-xl border border-amber-100 bg-[#A6835B]/5 p-5 mb-4">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-accent-gold text-[20px]">lightbulb</span>
                                <h4 className="font-bold text-accent-gold text-sm uppercase tracking-wide">Improvements</h4>
                            </div>
                            <ul className="space-y-3">
                                {feedback.weaknesses.map((weakness, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-[#121617]/80 leading-relaxed">
                                        <span className="mt-1.5 size-1.5 rounded-full bg-accent-gold flex-shrink-0"></span>
                                        <span>{weakness}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Additional Feedback */}
                    {feedback.feedback && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
                            <span className="font-semibold">Feedback: </span>
                            {feedback.feedback}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
