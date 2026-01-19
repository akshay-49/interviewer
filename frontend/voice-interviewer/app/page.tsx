"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API = "http://127.0.0.1:8000";

type Role = "Model Based Systems Engineer" | "Software Engineer" | "Product Manager" | "Data Scientist";
type Experience = "Intern" | "Junior" | "Mid-level" | "Senior" | "Lead";

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [finished, setFinished] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("Software Engineer");
  const [selectedExperience, setSelectedExperience] = useState<string>("Junior");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [areasToFocus, setAreasToFocus] = useState<string[]>([]);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recognitionRef, setRecognitionRef] = useState<any>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  const [sttSupported, setSttSupported] = useState<boolean>(true);
  const [recordingTime, setRecordingTime] = useState<number>(0); // Recording duration in seconds
  const [showEndConfirmation, setShowEndConfirmation] = useState<boolean>(false);
  const [sessionTimeout, setSessionTimeout] = useState<number>(0); // Seconds until session expires
  const [isPaused, setIsPaused] = useState<boolean>(false); // Interview paused state
  const [manualRecording, setManualRecording] = useState<boolean>(false); // Manual re-record mode disables auto-stop/submit

  // Refs for proper object persistence across renders
  const recognitionRefObj = useRef<any>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const isPausedRef = useRef<boolean>(false);
  const manualRecordingRef = useRef<boolean>(false);
  const answerRef = useRef<string>("");

  // Check STT support on component mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttSupported(false);
      setError("Speech Recognition not supported in your browser. Please use Chrome, Edge, or Safari. You can still type your answers manually.");
    }
  }, []);

  // Sync isPaused state to ref for callbacks
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Sync manualRecording state to ref for callbacks
  useEffect(() => {
    manualRecordingRef.current = manualRecording;
  }, [manualRecording]);

  // Sync answer state to ref for callbacks
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  // Recording timer effect
  useEffect(() => {
    if (!isRecording) return;
    
    const timer = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isRecording]);

  // Session timeout effect (30 minute timeout)
  useEffect(() => {
    if (!sessionId || finished) return;
    
    // Set initial timeout to 30 minutes
    if (sessionTimeout === 0) {
      setSessionTimeout(1800);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionTimeout <= 0 || !sessionId) return;
    
    // Warn user at 5 minutes remaining
    if (sessionTimeout === 300 && sessionTimeout > 0) {
      setError("Session expires in 5 minutes. Please complete your answer soon.");
    }
    
    // Auto end session at 0
    if (sessionTimeout === 1) {
      setError("Session timeout. Starting new interview...");
      setTimeout(() => resetInterview(), 2000);
      return;
    }
    
    const timer = setInterval(() => {
      setSessionTimeout((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sessionTimeout]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit answer
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && sessionId && !loading) {
        if (isReviewMode && answer.trim()) {
          // Submit from review mode
          setIsReviewMode(false);
          sendAnswer();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isReviewMode, sessionId, answer, loading]);

  useEffect(() => {
    if (!isReviewMode) return;
  }, [isReviewMode]);

  // Auto-send countdown effect - auto-submit after countdown reaches 0
  useEffect(() => {
    if (!isReviewMode) return;
  }, [isReviewMode]);

  function playBase64Audio(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(
      [...binary].map((c) => c.charCodeAt(0))
    );
    const blob = new Blob([bytes], { type: "audio/wav" });
    const audio = new Audio(URL.createObjectURL(blob));
    
    // Set volume to maximum
    audio.volume = 1.0;
    
    audio.onplay = () => setIsAudioPlaying(true);
    audio.onended = () => {
      setIsAudioPlaying(false);
      // Wait 1.5 seconds after question finishes before auto-starting recording
      setTimeout(() => startRecording(), 1500);
    };
    audio.onerror = () => setIsAudioPlaying(false);
    
    setCurrentAudio(audio);
    audio.play();
  }

  // ---------------------------------------
  // STT (Speech-to-Text) helper
  // ---------------------------------------

  function startRecording() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech Recognition is not supported in your browser. Please use Chrome, Edge, or Safari. Type your answer instead.");
      setSttSupported(false);
      return;
    }

    // Stop any existing recognition
    if (recognitionRefObj.current) {
      recognitionRefObj.current.stop();
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      const SILENCE_THRESHOLD = 5000; // 5 seconds of silence before auto-stop

      recognition.onstart = () => {
        setIsRecording(true);
        setIsPaused(false);
        setTranscript("");
        lastSpeechTimeRef.current = Date.now();
        
        // Clear any existing interval
        if (silenceCheckIntervalRef.current) {
          clearInterval(silenceCheckIntervalRef.current);
        }
        
        // Start checking for silence (only if not manual recording)
        if (!manualRecording) {
          silenceCheckIntervalRef.current = setInterval(() => {
            const now = Date.now();
            if (now - lastSpeechTimeRef.current > SILENCE_THRESHOLD) {
              // 3 seconds of silence - auto-stop and submit
              if (silenceCheckIntervalRef.current) {
                clearInterval(silenceCheckIntervalRef.current);
                silenceCheckIntervalRef.current = null;
              }
              recognition.stop();
            }
          }, 500);
        }
      };

      recognition.onresult = (event: any) => {
        lastSpeechTimeRef.current = Date.now();
        let interimTranscript = "";
        let newFinalText = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptSegment = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            newFinalText += transcriptSegment;
          } else {
            interimTranscript += transcriptSegment;
          }
        }
        
        if (newFinalText) {
          setAnswer((prev) => (prev + " " + newFinalText).trim());
        }
        
        setTranscript(interimTranscript);
      };

      recognition.onerror = (event: any) => {
        let errorMsg = `Speech recognition error: ${event.error}`;
        
        if (event.error === "no-speech") {
          errorMsg = "No speech detected. Please make sure your microphone is working and try again.";
        } else if (event.error === "network") {
          errorMsg = "Network error. Please check your connection and try again.";
        } else if (event.error === "not-allowed") {
          errorMsg = "Microphone permission denied. Please enable microphone access in your browser settings.";
        }
        
        setError(errorMsg);
        setIsRecording(false);
        if (silenceCheckIntervalRef.current) {
          clearInterval(silenceCheckIntervalRef.current);
          silenceCheckIntervalRef.current = null;
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        setTranscript("");
        if (silenceCheckIntervalRef.current) {
          clearInterval(silenceCheckIntervalRef.current);
          silenceCheckIntervalRef.current = null;
        }
        
        // Check refs (not state) since setState is asynchronous
        // If paused, just stay paused. If stopped and not manual recording, enter review mode
        if (!isPausedRef.current && !manualRecordingRef.current) {
          setIsReviewMode(true);
        }
      };

      recognition.start();
      recognitionRefObj.current = recognition;
      setRecognitionRef(recognition);
    } catch (err) {
      setError(`Failed to start recording: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  function stopRecording() {
    setIsPaused(false);
    setManualRecording(false);
    if (recognitionRefObj.current) {
      recognitionRefObj.current.stop();
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    setIsRecording(false);
    setTranscript("");
  }

  function togglePause() {
    if (!recognitionRefObj.current) return;
    
    if (!isPaused) {
      // Pausing - set pause flag FIRST, then stop
      setIsPaused(true);
      recognitionRefObj.current.stop();
    } else {
      // Resuming - set pause flag to false FIRST, then start
      setIsPaused(false);
      try {
        recognitionRefObj.current.start();
      } catch (err) {
        console.error("Resume failed:", err);
        setIsPaused(false);
        startRecording();
      }
    }
  }

  // ---------------------------------------
  // Start Interview
  // ---------------------------------------


  // Input validation
  const validateInputs = (): boolean => {
    if (!selectedRole.trim() || selectedRole.length < 2) {
      setError("Please enter a valid role (at least 2 characters)");
      return false;
    }
    if (!selectedExperience.trim() || selectedExperience.length < 2) {
      setError("Please enter a valid experience level (at least 2 characters)");
      return false;
    }
    return true;
  };


  // Retry logic for API calls
  const fetchWithRetry = async (
    url: string, 
    options: RequestInit = {}, 
    maxRetries: number = 3
  ): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        if (!response.ok && attempt < maxRetries) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 1.5s, 2.25s
          const delay = 1000 * Math.pow(1.5, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  };


  async function startInterview() {
    if (!validateInputs()) return;
    setLoading(true);
    setError(null);
    setFeedbackMessage(null);

    try {
      const res = await fetchWithRetry(`${API}/interview/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          experience: selectedExperience,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to start interview. Please check the backend server.");
      }

      const data = await res.json();

      setSessionId(data.session_id);
      setQuestion(data.question);
      setFeedbackMessage("Interview started! Listen to the first question.");
      playBase64Audio(data.audio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------
  // Send Answer
  // ---------------------------------------

  async function sendAnswer() {
    if (!sessionId) return;

    console.log('[DEBUG] sendAnswer called');
    setLoading(true);
    setError(null);
    setFeedbackMessage(null);

    // Use default message if no answer provided
    const finalAnswer = answer.trim() || "The user did not provide an answer";

    try {
      const res = await fetchWithRetry(`${API}/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          answer: finalAnswer,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit answer. Please try again.");
      }

      const data = await res.json();
      setAnswer("");
      setIsReviewMode(false);

      if (data.final) {
        setFinished(true);
        setQuestion(data.spoken_closing);
        setFeedbackMessage("Interview completed! Thank you for participating.");
        if (data.areas_to_focus) {
          setAreasToFocus(data.areas_to_focus);
        }
        playBase64Audio(data.audio);
      } else {
        setQuestion(data.question);
        setFeedbackMessage("Answer submitted. Next question is ready.");
        playBase64Audio(data.audio);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function resetInterview() {
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Stop recording
    if (recognitionRef) {
      recognitionRef.stop();
    }
    
    setSessionId(null);
    setQuestion("");
    setAnswer("");
    setFinished(false);
    setError(null);
    setFeedbackMessage(null);
    setAreasToFocus([]);
    setIsRecording(false);
    setIsAudioPlaying(false);
    setTranscript("");
    setIsReviewMode(false);
    setRecordingTime(0);
    setSessionTimeout(0);
    setShowEndConfirmation(false);
    setIsPaused(false);
    setManualRecording(false);
  }

  // ---------------------------------------
  // UI
  // ---------------------------------------



  // End interview confirmation modal
  const EndConfirmationModal = () => {
    if (!showEndConfirmation) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}>
        <div style={{
          backgroundColor: '#1e293b',
          padding: '24px',
          borderRadius: '12px',
          maxWidth: '400px',
          border: '1px solid #334155'
        }}>
          <h3 style={{ marginTop: 0, color: '#f1f5f9' }}>End Interview?</h3>
          <p style={{ color: '#cbd5e1' }}>Are you sure you want to end this interview? Your progress will be lost.</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowEndConfirmation(false)} style={{ flex: 1, backgroundColor: '#64748b', color: '#f1f5f9', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => { setShowEndConfirmation(false); resetInterview(); }} style={{ flex: 1, backgroundColor: '#ef4444', color: '#f1f5f9', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              End Interview
            </button>
          </div>
        </div>
      </div>
    );
  };


    return (
    <main className="container">
      <h1>Interview</h1>
      <p className="subtitle">Professional AI-powered interview experience</p>

      {feedbackMessage && (
        <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
          <p className="success">{feedbackMessage}</p>
        </div>
      )}

      {!sessionId && (
        <div className="card">
          <h2>Get Started</h2>
          <div className="form-group">
            <label htmlFor="role">Select Role:</label>
            <input
              id="role"
              type="text"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={loading}
              placeholder="e.g., Software Engineer"
            />
          </div>

          <div className="form-group">
            <label htmlFor="experience">Experience Level:</label>
            <input
              id="experience"
              type="text"
              value={selectedExperience}
              onChange={(e) => setSelectedExperience(e.target.value)}
              disabled={loading}
              placeholder="e.g., Junior"
            />
          </div>

          <button onClick={startInterview} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Starting..." : "Start Interview"}
          </button>
        </div>
      )}

      {sessionId && (
        <div className="layout-wrapper">
          {!finished && (
            <div className="layout-left">
              <div className="card">
                <h3>Question</h3>
                <p style={{ fontSize: "16px", lineHeight: "1.6", margin: "0" }}>{question}</p>
              </div>

              <div className="card">
                <h3>Your Answer</h3>
                <textarea
                  rows={3}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your answer will appear here..."
                  disabled={loading || isAudioPlaying}
                  style={{ marginBottom: "8px" }}
                />
                
                {transcript && (
                  <div style={{ marginBottom: "8px", padding: "10px", backgroundColor: "#1e293b", borderRadius: "6px", fontSize: "13px", color: "#60a5fa", borderLeft: "3px solid #3b82f6" }}>
                    Interim: <em>{transcript}</em>
                  </div>
                )}
              </div>
            </div>
          )}

          {!finished && (
            <div className="layout-right">
              <div className="card">
                <h3>Status</h3>
                {isAudioPlaying && (
                  <div className="status-indicator status-speaking">
                    <span>Listening to question</span>
                  </div>
                )}
                {isRecording && !isAudioPlaying && (
                  <div className="status-indicator status-listening">
                    <span>
                      {isPaused ? "Paused" : "Recording"} {recordingTime > 0 && `(${formatTime(recordingTime)})`}
                    </span>
                  </div>
                )}
                {isReviewMode && (
                  <div className="status-indicator status-review">
                    <span>Review Mode - Ready to Submit</span>
                  </div>
                )}
                {!isAudioPlaying && !isRecording && !isReviewMode && (
                  <div className="status-indicator status-ready">
                    <span>Ready</span>
                  </div>
                )}
              </div>

              <div className="card">
                <h3>Controls</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {!isRecording && !isReviewMode ? (
                    <button onClick={startRecording} disabled={loading || isAudioPlaying || !sttSupported} style={{ width: "100%" }}>
                      Record Answer
                    </button>
                  ) : isRecording && !isReviewMode ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={stopRecording} disabled={false} style={{ flex: 1, backgroundColor: "#ef4444" }}>
                        Stop Recording
                      </button>
                      <button onClick={togglePause} disabled={false} style={{ flex: 1, backgroundColor: "#8b5cf6" }}>
                        {isPaused ? "Resume" : "Pause"}
                      </button>
                    </div>
                  ) : isReviewMode ? (
                    <button onClick={() => { setIsReviewMode(false); setAnswer(""); setRecordingTime(0); setManualRecording(true); startRecording(); }} style={{ width: "100%", backgroundColor: "#f59e0b" }}>
                      Re-record
                    </button>
                  ) : null}
                  <button onClick={() => setAnswer("")} disabled={loading || isRecording || isAudioPlaying || isReviewMode} style={{ width: "100%", backgroundColor: "#64748b" }}>
                    Clear
                  </button>
                  <button onClick={() => { setIsReviewMode(false); sendAnswer(); }} disabled={loading || isAudioPlaying || isRecording} style={{ width: "100%" }}>
                    {loading ? "Submitting..." : "Submit"}
                  </button>
                  <button onClick={() => setShowEndConfirmation(true)} disabled={loading} style={{ width: "100%", backgroundColor: "#64748b" }}>
                    End
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {finished && (
        <div className="card" style={{ borderLeft: "4px solid #10b981" }}>
          <h3 className="success">Interview Complete</h3>
          <p style={{ fontSize: "15px", lineHeight: "1.6", marginBottom: "14px" }}>{question}</p>
          
          {areasToFocus && areasToFocus.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <h4 style={{ marginBottom: "10px", color: "#f59e0b", fontSize: "15px" }}>Areas to Focus On</h4>
              <ul style={{ marginLeft: "18px", lineHeight: "1.7", fontSize: "14px" }}>
                {areasToFocus.map((area, index) => (
                  <li key={index} style={{ marginBottom: "6px" }}>{area}</li>
                ))}
              </ul>
            </div>
          )}
          
          <button onClick={resetInterview} style={{ width: "100%" }}>
            Start New Interview
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "16px", marginTop: "16px" }}>
          <p className="loading">Processing...</p>
        </div>
      )}

      <EndConfirmationModal />
    </main>
  );
}
