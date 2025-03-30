import WebSocket, { WebSocketServer } from 'ws';
import { connectToDatabase } from './db.js';
import { safeSend } from './utils.js';
import { handleRegister, handleLogin, handleLogout } from './auth.js'; // Keep auth for now
// Import new character handlers
import { handleCreateCharacter, handleSelectCharacter, handleDeleteCharacter } from './handlers/characterHandler.js';
import { handleTravel } from './zone.js'; // Keep zone for now
import { handleFindMonster } from './combat.js'; // Keep combat for now
import { handleEquipItem, handleUnequipItem, handleSellItem, handleAssignPotionSlot, handleUsePotionSlot, handleAutoEquipBestStat } from './inventory.js'; // Keep inventory for now
import { validateGameData } from './validation.js';
import {
    WebSocketMessage,
    ActiveConnectionsMap,
    ActiveEncountersMap,
    PlayerAttackIntervalsMap,
    MonsterAttackIntervalsMap,
    Monster,
    RateLimitInfo
} from './types.js';

console.log("Loot & Legends server starting...");

// --- Rate Limiting Constants ---
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
const RATE_LIMIT_MAX_MESSAGES = 10; // Max 10 messages per window

// --- In-Memory State Maps ---
// Store active WebSocket connections and their associated user/character info
const activeConnections: ActiveConnectionsMap = new Map();
// Store active combat encounters (player connection -> monster instance)
const activeEncounters: ActiveEncountersMap = new Map();
// Store separate combat loop intervals
const playerAttackIntervals: PlayerAttackIntervalsMap = new Map();
const monsterAttackIntervals: MonsterAttackIntervalsMap = new Map();
// Store rate limiting info per connection
const rateLimitTracker: Map<WebSocket, RateLimitInfo> = new Map();


// --- Server Startup ---
async function startServer() {
    // --- Validate Game Data First ---
    try {
        validateGameData(); // Run validation checks
    } catch (error) {
        console.error("Game data validation failed. Server cannot start.", error);
        process.exit(1); // Exit if validation fails
    }
    // --- End Validation ---

    await connectToDatabase(); // Connect to DB only after validation passes

    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
    const wss = new WebSocketServer({ port: PORT });

    console.log(`WebSocket server started on port ${PORT}`);

    wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');

        // Send a welcome message
        ws.send(JSON.stringify({ type: 'message', payload: 'Welcome to Loot & Legends!' }));

        ws.on('message', (message: Buffer) => {
            // --- Rate Limiting Check ---
            const now = Date.now();
            let limitInfo = rateLimitTracker.get(ws);

            if (!limitInfo || now > limitInfo.windowStart + RATE_LIMIT_WINDOW_MS) {
                // Start new window or first message
                limitInfo = { count: 1, windowStart: now };
            } else {
                // Increment count in current window
                limitInfo.count++;
            }
            rateLimitTracker.set(ws, limitInfo); // Update tracker

            if (limitInfo.count > RATE_LIMIT_MAX_MESSAGES) {
                console.warn(`Rate limit exceeded for client. Count: ${limitInfo.count}`);
                return; // Ignore the message
            }
            // --- End Rate Limiting Check ---

            try {
                // Proceed with parsing only if rate limit not exceeded
                // const data = JSON.parse(message.toString()); // This seems redundant, messageData is parsed below
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
                        // Pass all state maps (update interval maps)
                        handleTravel(ws, messageData.payload, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
                        break;
                    case 'find_monster':
                        // Pass all state maps (update interval maps)
                        handleFindMonster(ws, messageData.payload, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
                        break;
                    case 'equip_item':
                        handleEquipItem(ws, messageData.payload, activeConnections);
                        break;
                    case 'unequip_item':
                        handleUnequipItem(ws, messageData.payload, activeConnections);
                        break;
                    case 'sell_item': // Add case for selling items
                        handleSellItem(ws, messageData.payload, activeConnections);
                        break;
                    case 'assign_potion_slot':
                        handleAssignPotionSlot(ws, messageData.payload, activeConnections);
                        break;
                    case 'use_potion_slot':
                        handleUsePotionSlot(ws, messageData.payload, activeConnections);
                        break;
                    case 'auto_equip_best_stat': // Add case for auto-equip
                        handleAutoEquipBestStat(ws, messageData.payload, activeConnections);
                        break;
                    case 'delete_character':
                        handleDeleteCharacter(ws, messageData.payload, activeConnections);
                        break;
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
            // Clean up rate limit tracker
            rateLimitTracker.delete(ws);
            // Use the imported handleLogout function for other cleanup (update interval maps)
            handleLogout(ws, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
        });

        ws.on('error', (error) => {
            // Clean up rate limit tracker on error too
            rateLimitTracker.delete(ws);
            console.error('WebSocket error:', error);
        });
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('Server shutting down...');
        wss.close(() => {
            console.log('WebSocket server closed.');
            process.exit(0);
        });
    });
}

startServer().catch(console.error);
