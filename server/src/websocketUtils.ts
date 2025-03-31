import WebSocket from 'ws';
import { WebSocketMessage, ConnectionData } from './types.js';
import { activeConnections } from './server.js';

/**
 * Sends a message to a specific WebSocket client.
 * Handles potential errors during sending.
 */
export function send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message:', error);
            // Optionally handle specific errors or close the connection
        }
    } else {
        console.warn('Attempted to send message to a non-open WebSocket connection.');
    }
}

/**
 * Broadcasts a message to all connected clients, optionally excluding one.
 */
export function broadcast(message: WebSocketMessage, excludeWs?: WebSocket): void {
    console.log(`Broadcasting message type: ${message.type}`);
    const messageString = JSON.stringify(message);
    // Add explicit types for the callback parameters
    activeConnections.forEach((connectionData: ConnectionData, ws: WebSocket) => {
        if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageString);
            } catch (error) {
                console.error(`Failed to broadcast message to client ${connectionData.username || connectionData.userId}:`, error);
                // Optionally remove the connection if sending fails persistently
            }
        }
    });
}

// Add other WebSocket utility functions as needed, e.g., safeClose(ws)
