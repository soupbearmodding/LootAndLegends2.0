import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import '../styles.css'; // Removed import from here

console.log('React Renderer script loaded.');

// Access the API exposed by the preload script
// Note: We need to declare the type for window.electronAPI
declare global {
    interface Window {
        electronAPI: {
            sendMessage: (channel: string, data?: any) => void;
            invoke: (channel: string, data?: any) => Promise<any>;
            on: (channel: string, func: (...args: any[]) => void) => () => void; // Returns a cleanup function
            removeListener: (channel: string, func: (...args: any[]) => void) => void;
        }
    }
}

// --- React App Initialization ---
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Fatal: Could not find root element.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
