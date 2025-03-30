import WebSocket, { WebSocketServer } from 'ws';
import { connectToDatabase, isMongoCollection } from './db.js'; // Import isMongoCollection
import { safeSend } from './utils.js';
import { handleRegister, handleLogin, handleLogout } from './auth.js';
// --- JSON DB Imports ---
import {
    saveData as saveJsonData, // Renamed to avoid conflict if needed, though 'saveData' is fine too
    loadCharacterFromJsonFile,
    saveCharacterToJsonFile
} from './jsonDb.js';
// ---------------------
// Import necessary functions/data for post-processing loaded character
import { calculateMaxHp, calculateMaxMana, xpForLevel, zones } from './gameData.js'; // Corrected path
import { CharacterRepository } from './repositories/characterRepository.js'; // Import CharacterRepository for saving

import { handleCreateCharacter, handleSelectCharacter, handleDeleteCharacter } from './handlers/characterHandler.js';
import { handleTravel } from './zone.js';
import { handleFindMonster } from './combat.js';
import { handleEquipItem, handleUnequipItem, handleSellItem, handleAssignPotionSlot, handleUsePotionSlot, handleAutoEquipBestStat } from './inventory.js';
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
                    // --- Save Character Handler ---
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
                    // --- Force JSON Save Handler (TEMP) ---
                    case 'forceJsonSave':
                        // TEMPORARY: Allows forcing a save of the JSON DB state for testing.
                        // Remove this case when the fallback system is removed or deemed stable.
                        console.log("Received request to force save in-memory JSON cache...");
                        try {
                            await saveJsonData(); // Saves the whole cache
                            console.log("In-memory JSON data cache force-saved successfully.");
                            safeSend(ws, { type: 'force_json_save_success', payload: { message: 'In-memory JSON cache saved.' } });
                        } catch (jsonSaveError) {
                            console.error("Error during force JSON cache save:", jsonSaveError);
                            safeSend(ws, { type: 'force_json_save_fail', payload: 'Failed to force save in-memory JSON cache.' });
                        }
                        break;
                    // --- Explicit JSON Save/Load Handlers ---
                    case 'saveCharacterToJson':
                        const charToJson = messageData.payload.characterData as Character;
                        const connInfoSaveJson = activeConnections.get(ws);
                        if (connInfoSaveJson && connInfoSaveJson.selectedCharacterId === charToJson?.id) {
                            try {
                                await saveCharacterToJsonFile(charToJson);
                                safeSend(ws, { type: 'save_json_success', payload: { message: 'Character saved to JSON file.' } });
                            } catch (saveJsonError) {
                                console.error(`Error saving character ${charToJson.id} to JSON file:`, saveJsonError);
                                safeSend(ws, { type: 'save_json_fail', payload: 'Failed to save character to JSON file.' });
                            }
                        } else {
                             console.warn(`Attempt to save character to JSON failed: No active character or ID mismatch.`);
                             safeSend(ws, { type: 'save_json_fail', payload: 'No active character selected or data mismatch.' });
                        }
                        break;
                    case 'loadCharacterFromJson':
                        const connInfoLoadJson = activeConnections.get(ws);
                        const charIdToLoad = messageData.payload.characterId as string;
                        // Ensure the user is trying to load their own character? Or allow loading any for now?
                        // Let's assume they can only load the currently selected character ID for simplicity/security.
                        if (connInfoLoadJson && connInfoLoadJson.selectedCharacterId === charIdToLoad) {
                            try {
                                let loadedChar = await loadCharacterFromJsonFile(charIdToLoad);
                                if (loadedChar) {
                                    console.log(`Loaded character ${charIdToLoad} from JSON file.`);

                                    // --- Post-process loaded character data (similar to CharacterService.selectCharacter) ---
                                    let updateRequired = false;
                                    const updatesForDb: Partial<Character> = {};

                                    // Ensure equipment exists
                                    if (!loadedChar.equipment) loadedChar.equipment = {};

                                    // Force start in town & heal
                                    if (loadedChar.currentZoneId !== 'town') {
                                        console.log(`Server: Forcing loaded character ${loadedChar.name} to town.`);
                                        loadedChar.currentZoneId = 'town';
                                        updatesForDb.currentZoneId = 'town';
                                        updateRequired = true;
                                    }
                                    if (loadedChar.currentZoneId === 'town') {
                                        const maxHp = calculateMaxHp(loadedChar.stats);
                                        if (loadedChar.currentHp < maxHp) {
                                            console.log(`Server: Healing loaded character ${loadedChar.name} in town.`);
                                            loadedChar.currentHp = maxHp;
                                            updatesForDb.currentHp = maxHp;
                                            updateRequired = true;
                                        }
                                        // Optionally heal mana too
                                        // const maxMana = calculateMaxMana(loadedChar.stats);
                                        // if (loadedChar.currentMana < maxMana) { ... }
                                    }

                                    // If changes were made (moved to town/healed), save them back to the primary DB
                                    // This keeps the primary DB consistent with the state sent to client after JSON load.
                                    if (updateRequired) {
                                         try {
                                             await CharacterRepository.update(loadedChar.id, updatesForDb);
                                             console.log(`Server: Updated primary DB for character ${loadedChar.id} after JSON load.`);
                                         } catch(updateError) {
                                             console.error(`Server: Failed to update primary DB for ${loadedChar.id} after JSON load:`, updateError);
                                             // Continue anyway, client will get the processed state
                                         }
                                    }

                                    // Calculate XP breakdown
                                    const totalXpForCurrentLevel = xpForLevel(loadedChar.level);
                                    const totalXpForNextLevel = xpForLevel(loadedChar.level + 1);
                                    const currentLevelXp = loadedChar.experience - totalXpForCurrentLevel;
                                    const xpToNextLevelBracket = totalXpForNextLevel - totalXpForCurrentLevel;

                                    const characterDataForPayload = {
                                        ...loadedChar,
                                        currentLevelXp: currentLevelXp,
                                        xpToNextLevelBracket: xpToNextLevelBracket
                                    };
                                    // -----------------------------------------------------------------------------

                                    // Send the *processed* data back
                                    safeSend(ws, { type: 'load_json_success', payload: { characterData: characterDataForPayload, message: 'Character loaded from JSON file.' } });
                                } else {
                                    safeSend(ws, { type: 'load_json_fail', payload: 'Character not found in JSON file.' });
                                }
                            } catch (loadJsonError) {
                                console.error(`Error loading character ${charIdToLoad} from JSON file:`, loadJsonError);
                                safeSend(ws, { type: 'load_json_fail', payload: 'Failed to load character from JSON file.' });
                            }
                        } else {
                             console.warn(`Attempt to load character from JSON failed: No active character or ID mismatch.`);
                             safeSend(ws, { type: 'load_json_fail', payload: 'Cannot load character: No active character selected or ID mismatch.' });
                        }
                        break;
                    // ------------------------------------
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
