import WebSocket, { WebSocketServer } from 'ws';
import { connectToDatabase } from './db.js';
import { safeSend } from './utils.js';
import { handleRegister, handleLogin, handleLogout } from './auth.js';
import { handleCreateCharacter, handleSelectCharacter } from './character.js';
import { handleTravel } from './zone.js';
import { handleFindMonster } from './combat.js';
import { handleEquipItem, handleUnequipItem } from './inventory.js'; // Import inventory handlers
import { WebSocketMessage, ActiveConnectionsMap, ActiveEncountersMap, CombatIntervalsMap, Monster } from './types.js'; // Import types

console.log("Loot & Legends server starting...");

// --- In-Memory State Maps ---
// Store active WebSocket connections and their associated user/character info
const activeConnections: ActiveConnectionsMap = new Map();
// Store active combat encounters (player connection -> monster instance)
const activeEncounters: ActiveEncountersMap = new Map();
// Store combat loop intervals (player connection -> interval ID)
const combatIntervals: CombatIntervalsMap = new Map();


// --- Server Startup ---
async function startServer() {
    await connectToDatabase(); // Connect to DB before starting WebSocket server

    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    const wss = new WebSocketServer({ port: PORT });

    console.log(`WebSocket server started on port ${PORT}`);

    wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');

        // Send a welcome message
        ws.send(JSON.stringify({ type: 'message', payload: 'Welcome to Loot & Legends!' }));

        ws.on('message', (message: Buffer) => {
            try {
                const data = JSON.parse(message.toString()); // Keep original parsing if needed elsewhere, though seems redundant
                const messageData: WebSocketMessage = JSON.parse(message.toString()); // Original message data

                // --- Secure Logging ---
                // Perform a DEEP COPY for logging to avoid modifying original payload
                let logData: any = JSON.parse(JSON.stringify(messageData));
                if (logData.type === 'login' || logData.type === 'register') {
                    if (logData.payload && typeof logData.payload.password === 'string') {
                        logData.payload.password = '********'; // Mask password in the deep copy
                    }
                }
                console.log('Received:', logData); // Log the masked deep copy

                // --- Message Routing ---
                switch (messageData.type) { // Use original messageData for logic
                    case 'register':
                        handleRegister(ws, messageData.payload);
                        break;
                    case 'login':
                        // Pass activeConnections map to handleLogin
                        handleLogin(ws, messageData.payload, activeConnections);
                        break;
                    case 'create_character':
                        // Pass activeConnections map
                        handleCreateCharacter(ws, messageData.payload, activeConnections);
                        break;
                    case 'select_character':
                        // Pass activeConnections map
                        handleSelectCharacter(ws, messageData.payload, activeConnections);
                        break;
                    case 'travel':
                        // Pass all state maps
                        handleTravel(ws, messageData.payload, activeConnections, activeEncounters, combatIntervals);
                        break;
                    case 'find_monster':
                        // Pass all state maps
                        handleFindMonster(ws, messageData.payload, activeConnections, activeEncounters, combatIntervals);
                        break;
                    case 'equip_item':
                        handleEquipItem(ws, messageData.payload, activeConnections);
                        break;
                    case 'unequip_item':
                        handleUnequipItem(ws, messageData.payload, activeConnections);
                        break;
                    // Combat is now automatic via intervals, no direct 'attack' message needed from client
                    // TODO: Add cases for other game actions (skills, etc.)
                    default:
                        console.log(`Unknown message type: ${messageData.type}`);
                        safeSend(ws, { type: 'error', payload: `Unknown message type: ${messageData.type}` });
                }

            } catch (error) {
                console.error('Failed to parse message or invalid message format:', message.toString(), error);
                safeSend(ws, { type: 'error', payload: 'Invalid message format' });
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            // Use the imported handleLogout function for cleanup
            handleLogout(ws, activeConnections, activeEncounters, combatIntervals);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            // TODO: Handle specific errors
        });
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('Server shutting down...');
        wss.close(() => {
            console.log('WebSocket server closed.');
            // Add other cleanup logic here (e.g., close database connections)
            // Consider closing the MongoDB client connection here as well
            process.exit(0);
        });
    });
}

startServer().catch(console.error);
