// Router Module
const routes = {
    'welcome': {
        path: '/screens/welcome.html',
        title: 'Welcome to AI Interview Coach'
    },
    'setup': {
        path: '/screens/setup.html',
        title: 'Setup Your Interview'
    },
    'listening': {
        path: '/screens/listening.html',
        title: 'Listening State'
    },
    'speaking-1': {
        path: '/screens/interviewer-speaking-1.html',
        title: 'Interviewer Speaking'
    },
    'speaking-2': {
        path: '/screens/interviewer-speaking-2.html',
        title: 'Interviewer Speaking'
    },
    'adaptive-transition': {
        path: '/screens/adaptive-topic-transition.html',
        title: 'Topic Transition'
    },
    'evaluating': {
        path: '/screens/evaluating-answer.html',
        title: 'Evaluating Your Answer'
    },
    'results': {
        path: '/screens/results-summary.html',
        title: 'Interview Results'
    },
    'q-and-a-review': {
        path: '/screens/q-and-a-review.html',
        title: 'Q&A Review'
    },
    'voice-feedback-1': {
        path: '/screens/voice-feedback-1.html',
        title: 'Voice Feedback'
    },
    'voice-feedback-2': {
        path: '/screens/voice-feedback-2.html',
        title: 'Voice Feedback'
    },
    'microphone-error': {
        path: '/screens/microphone-error.html',
        title: 'Microphone Connection Error'
    }
};

export function initRouter(appState) {
    // Handle browser back/forward
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            window.app.navigateTo(event.state.screen);
        }
    });
}

export function getRoute(screenName) {
    return routes[screenName] || null;
}

export function getAllRoutes() {
    return routes;
}
