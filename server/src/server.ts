import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import { connectToDatabase } from './db.js';
import { safeSend } from './utils.js';

// Load environment variables from .env file FIRST
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Load from server/.env
// Remove old auth imports: import { handleRegister, handleLogin, handleLogout } from './auth.js';
// Removed JSON DB Imports
// Import necessary functions/data for post-processing loaded character
import { calculateMaxHp, calculateMaxMana, xpForLevel, zones } from './gameData.js';
import { CharacterRepository } from './repositories/characterRepository.js';
import { UserRepository } from './repositories/userRepository.js';
import { AuthService } from './services/authService.js';
import { AuthHandler } from './handlers/authHandler.js';
// Remove old character handler imports: import { handleCreateCharacter, handleSelectCharacter, handleDeleteCharacter } from './handlers/characterHandler.js';
// Remove old zone import: import { handleTravel } from './zone.js';
// Remove old combat import: import { handleFindMonster } from './combat.js';
// Remove old inventory imports: import { handleEquipItem, handleUnequipItem, handleSellItem, handleAssignPotionSlot, handleUsePotionSlot, handleAutoEquipBestStat } from './inventory.js';
import { InventoryService } from './services/inventoryService.js';
import { InventoryHandler } from './handlers/inventoryHandler.js';
import { CombatService } from './services/combatService.js';
import { CombatHandler } from './handlers/combatHandler.js';
import { ZoneService } from './services/zoneService.js';
import { ZoneHandler } from './handlers/zoneHandler.js';
import { CharacterService } from './services/characterService.js'; // Import CharacterService
import { CharacterHandler } from './handlers/characterHandler.js'; // Import CharacterHandler
import { validateGameData } from './validation.js';
import {
    WebSocketMessage,
    ActiveConnectionsMap,
    ActiveEncountersMap,
    PlayerAttackIntervalsMap,
    MonsterAttackIntervalsMap,
    Monster,
    RateLimitInfo,
    Character // Import Character type
} from './types.js';

console.log("Loot & Legends server starting...");

// --- Rate Limiting Constants ---
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
const RATE_LIMIT_MAX_MESSAGES = 10; // Max 10 messages per window

// --- In-Memory State Maps ---
// Store active WebSocket connections and their associated user/character info
export const activeConnections: ActiveConnectionsMap = new Map(); // Exported
// Store active combat encounters (player connection -> monster instance)
export const activeEncounters: ActiveEncountersMap = new Map(); // Export needed? Check usage in other handlers/services
// Store separate combat loop intervals
export const playerAttackIntervals: PlayerAttackIntervalsMap = new Map(); // Export needed? Check usage
export const monsterAttackIntervals: MonsterAttackIntervalsMap = new Map(); // Export needed? Check usage
// Store rate limiting info per connection
const rateLimitTracker: Map<WebSocket, RateLimitInfo> = new Map();

// --- Instantiate Services and Handlers ---
// Assuming Repositories are the exported objects with methods
const authService = new AuthService(UserRepository);
const authHandler = new AuthHandler(authService);
const inventoryService = new InventoryService(CharacterRepository);
const inventoryHandler = new InventoryHandler(inventoryService);
// Instantiate CombatService, passing the state maps
const combatService = new CombatService(CharacterRepository, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
const combatHandler = new CombatHandler(combatService);
const zoneService = new ZoneService(CharacterRepository);
const zoneHandler = new ZoneHandler(zoneService, combatService, combatHandler);
// Instantiate CharacterService and Handler
const characterService = new CharacterService(CharacterRepository, UserRepository, zoneService);
const characterHandler = new CharacterHandler(characterService, UserRepository, CharacterRepository);


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

        // Make the message handler async to allow await
        ws.on('message', async (message: Buffer) => {
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
                        // Use the new AuthHandler
                        await authHandler.handleRegister(ws, messageData.payload);
                        break;
                    case 'login':
                        // Use the new AuthHandler
                        await authHandler.handleLogin(ws, messageData.payload);
                        break;
                    case 'create_character':
                        // Use the new CharacterHandler
                        await characterHandler.handleCreateCharacter(ws, messageData.payload);
                        break;
                    case 'select_character':
                        // Use the new CharacterHandler
                        await characterHandler.handleSelectCharacter(ws, messageData.payload);
                        break;
                    case 'travel':
                        // Use the new ZoneHandler
                        await zoneHandler.handleTravel(ws, messageData.payload);
                        break;
                    case 'find_monster':
                        // Use the new CombatHandler
                        await combatHandler.handleFindMonster(ws, messageData.payload);
                        break;
                    case 'equip_item':
                        // Use the new InventoryHandler
                        await inventoryHandler.handleEquipItem(ws, messageData.payload);
                        break;
                    case 'unequip_item':
                         // Use the new InventoryHandler
                        await inventoryHandler.handleUnequipItem(ws, messageData.payload);
                        break;
                    case 'sell_item':
                         // Use the new InventoryHandler
                        await inventoryHandler.handleSellItem(ws, messageData.payload);
                        break;
                    case 'assign_potion_slot':
                         // Use the new InventoryHandler
                        await inventoryHandler.handleAssignPotionSlot(ws, messageData.payload);
                        break;
                    case 'use_potion_slot':
                         // Use the new InventoryHandler
                        await inventoryHandler.handleUsePotionSlot(ws, messageData.payload);
                        break;
                    case 'auto_equip_best_stat':
                         // Use the new InventoryHandler
                        await inventoryHandler.handleAutoEquipBestStat(ws, messageData.payload);
                        break;
                    case 'delete_character':
                         // Use the new CharacterHandler
                        await characterHandler.handleDeleteCharacter(ws, messageData.payload);
                        break;
                    // --- Save Character Handler ---
                    // TODO: Move saveCharacter logic to CharacterService/Handler?
                    case 'saveCharacter':
                        // Assumes client sends the full character object to save
                        // TODO: Add validation for the received character data
                        const characterToSave = messageData.payload.characterData as Character;
                        const connectionInfoSave = activeConnections.get(ws);
                        if (connectionInfoSave && connectionInfoSave.selectedCharacterId === characterToSave?.id) {
                            try {
                                await CharacterRepository.save(characterToSave);
                                console.log(`Saved character ${characterToSave.id}`);
                                safeSend(ws, { type: 'save_success', payload: { message: 'Character saved.' } });
                            } catch (saveError) {
                                console.error(`Error saving character ${characterToSave.id}:`, saveError);
                                safeSend(ws, { type: 'save_fail', payload: 'Failed to save character data.' });
                            }
                        } else {
                             console.warn(`Attempt to save character failed: No active character selected or ID mismatch.`);
                             safeSend(ws, { type: 'save_fail', payload: 'No active character selected or data mismatch.' });
                        }
                        break;
                    // Removed forceJsonSave, saveCharacterToJson, loadCharacterFromJson handlers
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
            // Use the new AuthHandler for logout logic
            authHandler.handleLogout(ws); // Handles removing from activeConnections
            // Use the CombatService to clear any combat state for this connection
            combatService.clearCombatState(ws);
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
