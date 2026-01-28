import React from 'react';
import { InterviewProvider } from './context/InterviewContext';
import ScreenManager from './components/ScreenManager';

function App() {
    return (
        <InterviewProvider>
            <ScreenManager />
        </InterviewProvider>
    );
}

export default App;
