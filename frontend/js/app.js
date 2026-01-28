// Enhanced App with Backend Integration
import { api, recordAudio, playAudioFromBase64 } from './api.js';

// Screen mappings to original HTML files
const screens = {
    'welcome': 'screens/ui/welcome_to_ai_interview_coach_2/code.html',
    'setup': 'screens/ui/setup_your_interview_2/code.html',
    'listening': 'screens/ui/listening_state_-_speak_now/code.html',
    'speaking-1': 'screens/ui/interviewer_speaking_state_1/code.html',
    'speaking-2': 'screens/ui/interviewer_speaking_state_2/code.html',
    'adaptive-transition': 'screens/ui/adaptive_topic_transition/code.html',
    'evaluating': 'screens/ui/evaluating_your_answer/code.html',
    'q-and-a-review': 'screens/ui/interview_q&a_review_3/code.html',
    'results': 'screens/ui/interview_results_summary/code.html',
    'voice-feedback-1': 'screens/ui/voice_feedback_summary_1/code.html',
    'voice-feedback-2': 'screens/ui/voice_feedback_summary_3/code.html',
    'microphone-error': 'screens/ui/microphone_connection_error/code.html'
};

// App State
const appState = {
    currentScreen: 'welcome',
    userSettings: {
        darkMode: false,
    },
    interview: {
        sessionId: null,
        role: null,
        roleDisplay: '',
        experience: null,
        currentQuestion: null,
        questionAudio: null,
        audioPlaying: false,
        isRecording: false,
        recognition: null,
        questionNumber: 0,
        totalQuestions: 5,
        answers: [],
        summary: null,
    },
    backendAvailable: false
};

// Load and display screen using iframe
function loadScreen(screenName) {
    const path = screens[screenName];
    if (!path) {
        console.error(`Screen not found: ${screenName}`);
        return;
    }
    
    const app = document.getElementById('app');
    const existingIframe = document.getElementById('screen-iframe');
    
    // If iframe exists, fade out first
    if (existingIframe) {
        console.log(`Transitioning from ${appState.currentScreen} to ${screenName}`);
        existingIframe.classList.add('fade-out');
        
        setTimeout(() => {
            // Create new iframe with initial opacity 0
            const newIframe = document.createElement('iframe');
            newIframe.id = 'screen-iframe';
            newIframe.src = path;
            newIframe.style.opacity = '0';
            
            // Replace old iframe with new one
            app.innerHTML = '';
            app.appendChild(newIframe);
            appState.currentScreen = screenName;
            
            // Setup communication with iframe
            setupIframeMessaging(screenName);
            
            // Fade in after a brief delay to ensure DOM is ready
            setTimeout(() => {
                newIframe.classList.remove('fade-out');
                newIframe.style.opacity = '1';
            }, 50);
        }, 300); // Match transition duration
    } else {
        // First load, no transition needed
        console.log(`Initial load: ${screenName}`);
        app.innerHTML = `<iframe id="screen-iframe" src="${path}"></iframe>`;
        appState.currentScreen = screenName;
        setupIframeMessaging(screenName);
    }
}

// Switch right panel from speaking to listening state and start recording
function switchToListeningState(iframeDoc) {
    console.log('Switching to listening state');
    
    try {
        // Find the right panel
        const rightPanel = iframeDoc.querySelector('.w-full.md\\:w-\\[320px\\]');
        if (!rightPanel) {
            console.warn('Right panel not found');
            return;
        }
        
        // Replace the right panel content with listening state
        rightPanel.innerHTML = `
            <!-- Visualizer Container -->
            <div class="flex-1 flex flex-col items-center justify-center w-full">
                <!-- Animated Waveform -->
                <div aria-hidden="true" class="h-32 flex items-center justify-center gap-2 mb-6">
                    <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-12 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style="animation-delay: 0.1s"></div>
                    <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-20 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style="animation-delay: 0.2s"></div>
                    <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-16 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style="animation-delay: 0.3s"></div>
                    <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-24 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style="animation-delay: 0.1s"></div>
                    <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-10 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style="animation-delay: 0.4s"></div>
                </div>
                <p class="text-primary font-bold text-lg animate-pulse">Listening... Please answer</p>
                <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Speak clearly into your microphone</p>
            </div>
            <!-- Active Mic Button and Done Button -->
            <div class="mt-auto pt-8 w-full flex flex-col items-center gap-4">
                <!-- I'm Done Speaking Button -->
                <button id="done-speaking-btn" class="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg">
                    I'm Done Speaking
                </button>
                <!-- Active Mic Indicator -->
                <div class="relative group">
                    <div class="absolute -inset-1 bg-primary/20 rounded-full blur animate-pulse"></div>
                    <div class="relative size-12 flex items-center justify-center rounded-full bg-primary shadow-lg">
                        <span class="material-symbols-outlined text-white text-2xl">mic</span>
                    </div>
                </div>
                <span class="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">Recording...</span>
            </div>
        `;
        
        // Start speech recognition
        startRecording(iframeDoc);
        
    } catch (error) {
        console.error('Error switching to listening state:', error);
    }
}

// Start speech recognition using Web Speech API
function startRecording(iframeDoc) {
    console.log('Starting speech recognition...');
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Speech recognition not supported in this browser. Please use Chrome.');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    let finalTranscript = '';
    
    recognition.onstart = () => {
        console.log('Speech recognition started');
        appState.interview.isRecording = true;
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                console.log('Final transcript:', transcript);
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update transcript display in real-time
        const currentTranscript = finalTranscript + interimTranscript;
        console.log('Current transcript:', currentTranscript);
        
        // Find and update the element that shows the example text with live transcript
        const iframe = document.getElementById('screen-iframe');
        if (iframe && iframe.contentDocument) {
            // Look for the paragraph that contains example text (usually after the main question)
            const flexGrowDiv = iframe.contentDocument.querySelector('.flex-grow');
            if (flexGrowDiv) {
                const allParagraphs = flexGrowDiv.querySelectorAll('p');
                // Find the paragraph with the example/context text
                for (let para of allParagraphs) {
                    if (para.textContent.includes('And give an example') || para.classList.contains('text-gray-500')) {
                        para.textContent = currentTranscript || 'Start speaking...';
                        para.style.fontStyle = currentTranscript ? 'normal' : 'italic';
                        para.style.opacity = currentTranscript ? '1' : '0.6';
                        break;
                    }
                }
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        appState.interview.isRecording = false;
    };
    
    recognition.onend = () => {
        console.log('Speech recognition ended');
        console.log('Final answer:', finalTranscript.trim());
        appState.interview.isRecording = false;
        
        // Submit the answer even if empty
        submitAnswer(finalTranscript.trim());
    };
    
    // Store recognition instance for stopping later
    appState.interview.recognition = recognition;
    
    // Start recognition first
    recognition.start();
    
    // Add done speaking button handler after a slight delay
    setTimeout(() => {
        const iframe = document.getElementById('screen-iframe');
        if (iframe && iframe.contentDocument) {
            const doneBtn = iframe.contentDocument.getElementById('done-speaking-btn');
            if (doneBtn) {
                console.log('Done speaking button found and handler attached');
                doneBtn.onclick = () => {
                    console.log('Done speaking button clicked');
                    if (recognition) {
                        recognition.stop();
                    }
                };
            } else {
                console.warn('Done speaking button not found');
            }
        }
    }, 500);
}

// Submit answer to backend
async function submitAnswer(answerText) {
    console.log('Submitting answer:', answerText);
    
    try {
        // Clear recognition to allow new one to start
        if (appState.interview.recognition) {
            appState.interview.recognition.abort();
            appState.interview.recognition = null;
        }
        
        // Show evaluating state in the right panel
        const iframe = document.getElementById('screen-iframe');
        if (iframe && iframe.contentDocument) {
            const rightPanel = iframe.contentDocument.querySelector('.w-full.md\\:w-\\[320px\\]');
            if (rightPanel) {
                rightPanel.innerHTML = `
                    <!-- Evaluating State -->
                    <div class="flex-1 flex flex-col items-center justify-center w-full p-6">
                        <!-- Orbital Loader -->
                        <div class="relative w-32 h-32 mb-8 flex items-center justify-center">
                            <!-- Core -->
                            <div class="absolute w-20 h-20 bg-gradient-to-tr from-primary/10 to-transparent rounded-full backdrop-blur-sm z-10 flex items-center justify-center border border-primary/20">
                                <span class="material-symbols-outlined text-3xl text-primary dark:text-[#5F9479] animate-pulse">psychology</span>
                            </div>
                            <!-- Inner Orbit -->
                            <div class="absolute w-24 h-24 rounded-full border border-dashed border-primary/30" style="animation: orbit-cw 8s linear infinite;">
                                <div class="absolute top-1/2 -right-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(54,92,99,0.6)]"></div>
                            </div>
                            <!-- Outer Orbit -->
                            <div class="absolute w-32 h-32 rounded-full border border-gray-100 dark:border-gray-700" style="animation: orbit-ccw 12s linear infinite;">
                                <div class="absolute bottom-1/2 -left-1.5 w-3 h-3 bg-teal-400 rounded-full shadow-[0_0_10px_rgba(95,148,121,0.6)]"></div>
                            </div>
                        </div>
                        <h3 class="text-lg font-bold text-primary dark:text-teal-400 mb-2">Evaluating...</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 text-center">Analyzing clarity, correctness, and depth</p>
                    </div>
                    <style>
                        @keyframes orbit-cw {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes orbit-ccw {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(-360deg); }
                        }
                    </style>
                `;
            }
        }
        
        console.log('Calling backend to submit answer...');
        const result = await api.submitAnswer(
            appState.interview.sessionId,
            answerText
        );
        
        console.log('Answer submitted, response:', result);
        
        // Store the answer
        appState.interview.answers.push({
            question: appState.interview.currentQuestion,
            answer: answerText
        });
        
        // Handle next question or end of interview
        // Backend returns either: { final: false, question: "...", audio: "..." }
        // or: { final: true, summary: "...", spoken_closing: "...", audio: "..." }
        if (!result.final && result.question) {
            console.log('Getting next question...');
            appState.interview.currentQuestion = result.question;
            appState.interview.questionAudio = result.audio;
            appState.interview.questionNumber++;
            appState.interview.audioPlaying = false; // Reset audio flag
            
            // Reset right panel to show "speaking" state first
            const iframe = document.getElementById('screen-iframe');
            if (iframe && iframe.contentDocument) {
                const rightPanel = iframe.contentDocument.querySelector('.w-full.md\\:w-\\[320px\\]');
                if (rightPanel) {
                    rightPanel.innerHTML = `
                        <!-- Visualizer Container -->
                        <div class="flex-1 flex flex-col items-center justify-center w-full">
                            <!-- Distinctive Sound Wave Visualization -->
                            <div aria-hidden="true" class="h-32 flex items-center justify-center gap-2 mb-6">
                                <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-12 wave-bar animate-[wave_0.8s_ease-in-out_infinite]" style="animation-delay: 0.1s"></div>
                                <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-20 wave-bar animate-[wave_1.1s_ease-in-out_infinite]" style="animation-delay: 0.2s"></div>
                                <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-16 wave-bar animate-[wave_1.3s_ease-in-out_infinite]" style="animation-delay: 0.3s"></div>
                                <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-24 wave-bar animate-[wave_0.9s_ease-in-out_infinite]" style="animation-delay: 0.1s"></div>
                                <div class="w-2.5 bg-primary/80 dark:bg-primary/90 rounded-full h-10 wave-bar animate-[wave_1.2s_ease-in-out_infinite]" style="animation-delay: 0.4s"></div>
                            </div>
                            <p class="text-primary font-bold text-lg animate-pulse">Interviewer is speaking...</p>
                            <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Please wait until they finish.</p>
                        </div>
                        <!-- Disabled User Control -->
                        <div class="mt-auto pt-8 w-full flex flex-col items-center gap-4">
                            <!-- Disabled Mic Button -->
                            <div class="relative group cursor-not-allowed opacity-50 grayscale transition-all duration-300">
                                <div class="absolute -inset-1 bg-gray-200 dark:bg-gray-700 rounded-full blur opacity-25"></div>
                                <button class="relative size-16 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm" disabled="">
                                    <span class="material-symbols-outlined text-gray-400 dark:text-gray-500 text-3xl">mic_off</span>
                                </button>
                            </div>
                            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Mic Disabled</span>
                        </div>
                    `;
                }
            }
            
            // Navigate to speaking-2 for the next question
            navigateTo('speaking-2');
        } else {
            // Interview complete
            console.log('Interview complete, showing results');
            navigateTo('results');
        }
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('Failed to submit answer. Please try again.');
    }
}

// Setup messaging between parent and iframe
function setupIframeMessaging(screenName) {
    const iframe = document.getElementById('screen-iframe');
    
    if (!iframe) return;
    
    iframe.onload = () => {
        const iframeWindow = iframe.contentWindow;
        const iframeDoc = iframe.contentDocument;
        
        console.log('Iframe loaded:', screenName);
        
        // Handle speaking-2 screen - inject question and play audio
        if (screenName === 'speaking-2' && appState.interview.currentQuestion && appState.interview.questionAudio) {
            console.log('Setting up speaking-2 screen with question');
            
            setTimeout(() => {
                try {
                    // Update header with role display
                    const headerRole = iframeDoc.querySelector('.hidden.md\\:flex.items-center.gap-4 .text-sm.font-medium');
                    if (headerRole && appState.interview.roleDisplay) {
                        headerRole.textContent = appState.interview.roleDisplay;
                        console.log('Header updated with role:', appState.interview.roleDisplay);
                    }
                    
                    const questionElement = iframeDoc.querySelector('h1');
                    if (questionElement) {
                        questionElement.textContent = appState.interview.currentQuestion;
                        console.log('Question injected into speaking screen');
                    }
                    
                    // Update question number
                    const questionNumberElement = iframeDoc.querySelector('.text-primary.font-bold.text-sm.uppercase');
                    if (questionNumberElement) {
                        questionNumberElement.textContent = `Question ${appState.interview.questionNumber} of ${appState.interview.totalQuestions}`;
                    }
                    
                    // Update progress bar
                    const progressBar = iframeDoc.querySelector('.h-full.bg-primary.rounded-full');
                    if (progressBar) {
                        const progressPercentage = (appState.interview.questionNumber / appState.interview.totalQuestions) * 100;
                        progressBar.style.width = `${progressPercentage}%`;
                        console.log(`Progress bar updated: ${progressPercentage}%`);
                    }
                    
                    // Play audio once
                    if (!appState.interview.audioPlaying) {
                        appState.interview.audioPlaying = true;
                        playAudioFromBase64(appState.interview.questionAudio)
                            .then(() => {
                                console.log('Question audio finished playing');
                                appState.interview.audioPlaying = false;
                                appState.interview.questionAudio = null; // Clear to prevent replay
                                
                                // Switch right panel to listening state
                                switchToListeningState(iframeDoc);
                            })
                            .catch((error) => {
                                console.warn('Failed to play audio:', error);
                                appState.interview.audioPlaying = false;
                                switchToListeningState(iframeDoc);
                            });
                    }
                } catch (error) {
                    console.warn('Error setting up speaking screen:', error);
                }
            }, 100);
        }
        
        // Inject navigation script into iframe
        if (iframeDoc) {
            // Add responsive styles to iframe
            const style = iframeDoc.createElement('style');
            style.textContent = `
                html, body {
                    height: 100%;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                }
                
                body {
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                }
                
                /* Compact spacing on smaller screens */
                @media (max-height: 900px) {
                    .p-8 { padding: 1.25rem !important; }
                    .py-6 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
                    .py-4 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
                    .gap-8 { gap: 1rem !important; }
                    .gap-6 { gap: 1rem !important; }
                    .mb-6 { margin-bottom: 1rem !important; }
                    .mb-8 { margin-bottom: 1rem !important; }
                }
                
                @media (max-height: 768px) {
                    .p-8 { padding: 1rem !important; }
                    .px-8 { padding-left: 1rem !important; padding-right: 1rem !important; }
                    .pb-8 { padding-bottom: 1rem !important; }
                    .pt-2 { padding-top: 0.5rem !important; }
                    .gap-6 { gap: 0.75rem !important; }
                    .gap-3 { gap: 0.5rem !important; }
                    h1 { font-size: 1.5rem !important; }
                    .text-3xl { font-size: 1.5rem !important; }
                    .min-h-\\[140px\\] { min-height: 100px !important; }
                }
            `;
            iframeDoc.head.appendChild(style);
            
            const script = iframeDoc.createElement('script');
            script.textContent = `
                window.addEventListener('click', (e) => {
                    const button = e.target.closest('button');
                    const link = e.target.closest('a');
                    
                    if (link) {
                        // Check if it's a navigation link
                        const text = link.innerText || link.textContent;
                        const icon = link.querySelector('.material-symbols-outlined');
                        
                        console.log('Link clicked:', text);
                        
                        if (icon) {
                            const iconText = icon.textContent || icon.innerText;
                            console.log('Link icon:', iconText);
                            if (iconText.includes('arrow_back') || text.includes('Back to Dashboard')) {
                                e.preventDefault();
                                console.log('Back to dashboard detected');
                                window.parent.postMessage({ action: 'navigate', screen: 'welcome' }, '*');
                                return;
                            }
                        }
                    }
                    
                    if (button) {
                        const text = button.innerText || button.textContent;
                        console.log('Button clicked:', text);
                        
                        // Check for arrow back icon (back button) - check first
                        const icon = button.querySelector('.material-symbols-outlined');
                        if (icon) {
                            const iconText = icon.textContent || icon.innerText;
                            console.log('Icon found:', iconText);
                            if (iconText.includes('arrow_back')) {
                                console.log('Back button detected, navigating to welcome');
                                window.parent.postMessage({ action: 'navigate', screen: 'welcome' }, '*');
                                return;
                            }
                        }
                        
                        // Route based on button text
                        if (text.includes('Start Interview Session')) {
                            window.parent.postMessage({ action: 'navigate', screen: 'setup' }, '*');
                        } else if (text.includes('Begin Interview')) {
                            // Collect form data from setup screen
                            const role = document.getElementById('role')?.value;
                            const experience = document.getElementById('experience')?.value;
                            const jobDescription = document.getElementById('job-description')?.value;
                            const persona = document.querySelector('input[name="persona"]:checked')?.value;
                            
                            console.log('Form data:', { role, experience, jobDescription, persona });
                            
                            if (!role || !experience) {
                                alert('Please select both role and experience level');
                                return;
                            }
                            
                            window.parent.postMessage({ 
                                action: 'startInterview', 
                                data: { role, experience, jobDescription, persona }
                            }, '*');
                        } else if (text.includes('Back to Home') || text.includes('Go Home')) {
                            window.parent.postMessage({ action: 'navigate', screen: 'welcome' }, '*');
                        } else if (text.includes('Try Another Interview') || text.includes('Try Again')) {
                            window.parent.postMessage({ action: 'navigate', screen: 'setup' }, '*');
                        }
                    }
                });
            `;
            iframeDoc.body.appendChild(script);
        }
    };
}

// Listen for messages from iframe
window.addEventListener('message', (event) => {
    const { action, screen, data } = event.data;
    console.log('Received message from iframe:', event.data);
    
    switch (action) {
        case 'navigate':
            navigateTo(screen);
            break;
        case 'startInterview':
            handleSetupComplete(data || {});
            break;
    }
});

// Handle start interview button click
async function handleStartInterview() {
    try {
        if (!appState.backendAvailable) {
            alert('Backend not available. Please check connection.');
            return;
        }
        
        console.log('Starting interview...');
        navigateTo('setup');
    } catch (error) {
        console.error('Error starting interview:', error);
        alert('Failed to start interview');
    }
}

// Handle setup form submission
async function handleSetupComplete(data) {
    try {
        console.log('Setup completed:', data);
        
        // Check if backend is available
        if (!appState.backendAvailable) {
            alert('Backend is not available. Please start the backend server first.');
            return;
        }
        
        // Map the form values to backend format
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
        
        appState.interview.role = roleMap[data.role] || data.role || 'Software Engineer';
        appState.interview.experience = experienceMap[data.experience] || data.experience || 'Mid-Level';
        appState.interview.roleDisplay = `${appState.interview.experience} ${appState.interview.role} Interview`;
        appState.interview.jobDescription = data.jobDescription || '';
        appState.interview.persona = data.persona || 'strict';
        
        console.log('Calling backend API to start interview...');
        console.log('Role:', appState.interview.role);
        console.log('Experience:', appState.interview.experience);
        
        console.log('Calling backend API to start interview...');
        
        // Call backend to start interview
        const result = await api.startInterview(
            appState.interview.role,
            appState.interview.experience
        );
        
        appState.interview.sessionId = result.session_id;
        appState.interview.currentQuestion = result.question;
        appState.interview.questionNumber = 1;
        
        console.log('Interview started successfully!');
        console.log('Session ID:', result.session_id);
        console.log('Question:', result.question);
        
        // Store question in app state
        appState.interview.currentQuestion = result.question;
        appState.interview.questionAudio = result.audio;
        
        // Navigate to speaking-2 screen
        navigateTo('speaking-2');
    } catch (error) {
        console.error('Error starting interview:', error);
        alert('Failed to start interview. Please check backend connection.');
        navigateTo('welcome');
    }
}

// Navigation function
function navigateTo(screenName) {
    console.log(`Navigating to: ${screenName}`);
    loadScreen(screenName);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== AI Interview Coach App Initialized ===');
    initDarkMode();
    
    // Check backend availability
    console.log('Checking backend connection...');
    try {
        const health = await api.healthCheck();
        if (health) {
            appState.backendAvailable = true;
            console.log('✅ Backend connected successfully:', health);
        } else {
            appState.backendAvailable = false;
            console.error('❌ Backend not available');
            alert('Warning: Backend not connected. Please ensure backend is running on http://localhost:8000');
        }
    } catch (error) {
        appState.backendAvailable = false;
        console.error('❌ Backend connection error:', error);
    }
    
    loadScreen('welcome');
    console.log('=== App ready ===');
});

// Dark Mode Toggle
function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.documentElement.classList.add('dark');
        appState.userSettings.darkMode = true;
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    appState.userSettings.darkMode = isDark;
    localStorage.setItem('darkMode', isDark);
}

// Export for global access
window.app = {
    navigateTo,
    toggleDarkMode,
    getState: () => appState,
    setState: (key, value) => {
        appState[key] = value;
    }
};
