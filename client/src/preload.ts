import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

console.log('Preload script loaded.');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Send message from renderer to main
    sendMessage: (channel: string, data: any) => {
        // Whitelist channels
        const validChannels = ['some-action', 'connect-ws', 'send-ws-message']; // Add more channels as needed
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.error(`Invalid channel used in sendMessage: ${channel}`);
        }
    },
    // Send message from renderer to main and expect a response
    invoke: (channel: string, data: any): Promise<any> => {
         // Whitelist channels
        const validChannels = ['some-action', 'connect-ws', 'send-ws-message']; // Add more channels as needed
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        } else {
             console.error(`Invalid channel used in invoke: ${channel}`);
             return Promise.reject(new Error(`Invalid channel: ${channel}`));
        }
    },
    // Receive messages from main
    on: (channel: string, func: (...args: any[]) => void) => {
        const subscription = (event: IpcRendererEvent, ...args: any[]) => func(...args);
        // Whitelist channels
        const validChannels = ['ws-message', 'ws-connect-status']; // Add more channels as needed
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, subscription);
            // Return a cleanup function
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        } else {
            console.error(`Invalid channel used in on: ${channel}`);
            return () => {}; // Return empty cleanup function
        }
    },
    // Remove listener (optional, if you need more granular control than the cleanup function)
    removeListener: (channel: string, func: (...args: any[]) => void) => {
         ipcRenderer.removeListener(channel, func);
    }
});

// You can also expose other Node.js modules or custom APIs here securely
// contextBridge.exposeInMainWorld('myAPI', {
//   doSomething: () => { ... }
// });
