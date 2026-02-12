import React, { useState } from 'react';
import { useInterview } from '../../context/InterviewContext';

const ModeSelectionScreen = ({ autoStart = false, preselectedMode = null }) => {
    const { navigateTo, updateInterview, interview } = useInterview();
    const [selectedMode, setSelectedMode] = useState(preselectedMode || 'audio');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleModeSelect = async (mode) => {
        setSelectedMode(mode);
    };

    const handleStartInterview = async () => {
        if (!interview.sessionId) {
            setError('No session ID available');
            return;
        }

        setLoading(true);
        try {
            // Update interview context with recording mode
            updateInterview({ recordingMode: selectedMode });
            
            console.log(`Starting interview in ${selectedMode} mode`);
            navigateTo('interview');
        } catch (err) {
            console.error('Failed to start interview:', err);
            setError(err.message || 'Failed to start interview');
        } finally {
            setLoading(false);
        }
    };

    if (autoStart && preselectedMode) {
        // Auto-start the interview with preselected mode
        React.useEffect(() => {
            handleStartInterview();
        }, []);
    }

    return (
        <div className="bg-white dark:bg-slate-900 font-display h-full flex flex-col items-center justify-center p-8">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Interview Setup
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        Choose your interview recording mode
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                    </div>
                )}

                {/* Mode Selection Cards */}
                <div className="space-y-4 mb-8">
                    {/* Audio Mode */}
                    <button
                        onClick={() => handleModeSelect('audio')}
                        disabled={loading}
                        className={`w-full p-6 border-2 rounded-xl transition-all ${
                            selectedMode === 'audio'
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-gray-200 dark:border-slate-700 hover:border-primary/50'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                                <span className="material-symbols-outlined text-4xl text-primary">
                                    mic
                                </span>
                            </div>
                            <div className="text-left flex-grow">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Audio Only
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    Record your voice responses
                                </p>
                            </div>
                            {selectedMode === 'audio' && (
                                <span className="material-symbols-outlined text-primary">
                                    check_circle
                                </span>
                            )}
                        </div>
                    </button>

                    {/* Video Mode */}
                    <button
                        onClick={() => handleModeSelect('video')}
                        disabled={loading}
                        className={`w-full p-6 border-2 rounded-xl transition-all ${
                            selectedMode === 'video'
                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                : 'border-gray-200 dark:border-slate-700 hover:border-primary/50'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                                <span className="material-symbols-outlined text-4xl text-primary">
                                    videocam
                                </span>
                            </div>
                            <div className="text-left flex-grow">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Video + Audio
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    Record video and voice responses
                                </p>
                            </div>
                            {selectedMode === 'video' && (
                                <span className="material-symbols-outlined text-primary">
                                    check_circle
                                </span>
                            )}
                        </div>
                    </button>
                </div>

                {/* Info Box */}
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                        {selectedMode === 'audio'
                            ? '📻 Audio mode: Your microphone will be used to record answers'
                            : '🎥 Video mode: Both your webcam and microphone will be used'}
                    </p>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStartInterview}
                    disabled={loading}
                    className={`w-full py-3 rounded-lg font-semibold transition-all ${
                        loading
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-primary hover:bg-primary/90 text-white'
                    }`}
                >
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined animate-spin">
                                redo
                            </span>
                            Starting Interview...
                        </div>
                    ) : (
                        'Start Interview'
                    )}
                </button>
            </div>
        </div>
    );
};

export default ModeSelectionScreen;
