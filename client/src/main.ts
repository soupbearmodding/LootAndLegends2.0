import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Points to dist-electron/preload.js after build
            contextIsolation: true, // Protect against prototype pollution
            nodeIntegration: false, // Keep Node.js integration disabled in renderer
        },
    });

    // Load the index.html from Vite dev server or build output
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // Load the index.html file from the Vite build output directory (dist)
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open the DevTools (optional)
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// --- WebSocket Management ---
let ws: WebSocket | null = null;

function sendToRenderer(channel: string, data: any) {
    if (mainWindow) {
        mainWindow.webContents.send(channel, data);
    } else {
        console.error("Cannot send to renderer: mainWindow is null");
    }
}

ipcMain.handle('connect-ws', async (event, args: { url: string }) => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket already connected or connecting.');
        return { success: true, message: 'Already connected or connecting' };
    }

    console.log(`Main process received request to connect to WebSocket: ${args.url}`);
    try {
        ws = new WebSocket(args.url);

        ws.on('open', () => {
            console.log('WebSocket connection opened');
            sendToRenderer('ws-connect-status', { connected: true });
        });

        // Add type 'RawData' from 'ws'
        ws.on('message', (data: WebSocket.RawData) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('Message from server received in main:', message);
                sendToRenderer('ws-message', message); // Forward to renderer
            } catch (error) {
                console.error('Failed to parse WebSocket message:', data.toString(), error);
                // Optionally send raw data or an error message to renderer
                sendToRenderer('ws-message', { type: 'error', payload: 'Received unparseable message from server' });
            }
        });

        // Add types 'number' and 'Buffer'
        ws.on('close', (code: number, reason: Buffer) => {
            console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason.toString()}`);
            ws = null;
            sendToRenderer('ws-connect-status', { connected: false, error: `Connection closed (Code: ${code})` });
        });

        // Add type 'Error'
        ws.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
            if (ws && ws.readyState !== WebSocket.OPEN) {
                 // Only send disconnect status if it wasn't already open (avoids duplicate messages on failed connect)
                 sendToRenderer('ws-connect-status', { connected: false, error: error.message });
            }
            ws?.close(); // Ensure cleanup on error
            ws = null;
        });

        return { success: true, message: 'Connection initiated' };

    } catch (error: any) {
        console.error('Failed to create WebSocket connection:', error);
        ws = null;
        sendToRenderer('ws-connect-status', { connected: false, error: error.message });
        return { success: false, message: `Failed to initiate connection: ${error.message}` };
    }
});

// Handle sending messages from renderer to the WebSocket server
ipcMain.handle('send-ws-message', async (event, message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            // --- Secure Logging ---
            // Perform a DEEP COPY for logging to avoid modifying original payload
            let logData: any = JSON.parse(JSON.stringify(message));
            if (logData.type === 'login' || logData.type === 'register') {
                if (logData.payload && typeof logData.payload.password === 'string') {
                    logData.payload.password = '********'; // Mask password in the deep copy
                }
            }
            console.log('Message sent to server via main:', logData); // Log masked deep copy

            // Send the ORIGINAL message with the actual password
            ws.send(JSON.stringify(message)); // <--- Make sure this uses 'message', not 'logData'
            return { success: true };
        } catch (error: any) {
            console.error('Failed to send WebSocket message:', error);
            return { success: false, message: `Failed to send: ${error.message}` };
        }
    } else {
        console.warn('WebSocket not connected. Cannot send message.');
        return { success: false, message: 'WebSocket not connected' };
    }
});


// IPC handler
ipcMain.handle('some-action', async (event, args) => {
    console.log('IPC message received in main process:', args);
    // Do something in the main process
    return { reply: 'Data processed in main' };
});


console.log("Electron main process started.");

// Ensure WebSocket is closed when the app quits
app.on('quit', () => {
    if (ws) {
        console.log('Closing WebSocket connection on app quit.');
        ws.close();
    }
});
