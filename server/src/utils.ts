import WebSocket from 'ws';
import { WebSocketMessage } from './types.js';

/**
 * Safely sends a JSON message to a WebSocket client, handling potential errors.
 * @param ws The WebSocket client connection.
 * @param message The message object to send.
 */
export function safeSend(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState !== WebSocket.OPEN) {
        console.error("Attempted to send message to a non-open WebSocket.");
        return; // Don't attempt to send if the socket isn't open
    }
    try {
        ws.send(JSON.stringify(message));
    } catch (error) {
        console.error("Failed to send message:", error);
        // Optionally, you might want to close the connection here if sending fails repeatedly
    }
}

/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
