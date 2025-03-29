import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { UpdateFilter } from 'mongodb'; // Import UpdateFilter
import { usersCollection, charactersCollection } from './db.js';
import { safeSend } from './utils.js';
import { Character, ActiveConnectionsMap, User } from './types.js'; // Import User type
import { characterClasses, calculateMaxHp, zones, xpForLevel } from './gameData.js'; // Import xpForLevel

// --- Character Handlers ---

export async function handleCreateCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId) {
        safeSend(ws, { type: 'create_character_fail', payload: 'User not logged in' });
        return;
    }
    const userId = connectionInfo.userId;

    // Find user in DB
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
        // This shouldn't happen if user is logged in via activeConnections
        console.error(`CreateCharacter: User not found in DB despite being logged in (ID: ${userId})`);
        safeSend(ws, { type: 'create_character_fail', payload: 'User session error' });
        return;
    }

    // Basic validation
    if (!payload || typeof payload.name !== 'string' || typeof payload.classId !== 'string') {
        safeSend(ws, { type: 'create_character_fail', payload: 'Invalid character data' });
        return;
    }
    if (payload.name.length < 3 || payload.name.length > 16) {
         safeSend(ws, { type: 'create_character_fail', payload: 'Character name must be between 3 and 16 characters' });
        return;
    }
    // TODO: Add check for unique character name *per user* in DB

    const chosenClass = characterClasses.get(payload.classId.toLowerCase());
    if (!chosenClass) {
        safeSend(ws, { type: 'create_character_fail', payload: 'Invalid class selected' });
        return;
    }

    // Limit characters per account (example)
    if (user.characterIds.length >= 5) {
         safeSend(ws, { type: 'create_character_fail', payload: 'Maximum characters reached for this account' });
        return;
    }

    const newCharacter: Character = {
        id: uuidv4(),
        userId: userId,
        name: payload.name,
        class: payload.classId.toLowerCase(), // Use the class ID string
        level: 1,
        experience: 0,
        stats: { ...chosenClass.baseStats }, // Copy base stats
        maxHp: calculateMaxHp(chosenClass.baseStats),
        currentHp: calculateMaxHp(chosenClass.baseStats), // Start with full HP
        currentZoneId: 'town', // Start everyone in town
        zoneKills: {}, // Initialize zone kill tracker
        inventory: [], // Initialize empty inventory
        equipment: {}, // Initialize empty equipment slots
        // Initialize other fields (if any remain after adding inventory/equipment)
    };

    try {
        // Insert character into DB
        const insertResult = await charactersCollection.insertOne(newCharacter);
        if (!insertResult.insertedId) {
            throw new Error("Character insertion failed");
        }

        // Define the update operation with explicit typing
        const updateOperation: UpdateFilter<User> = {
            $push: { characterIds: newCharacter.id }
        };

        // Add character ID to user document in DB
        const updateResult = await usersCollection.updateOne(
            { id: userId },
            updateOperation
        );

        if (updateResult.modifiedCount !== 1) {
            // Attempt to roll back character insertion if user update fails? Complex.
            console.error(`Failed to add character ID ${newCharacter.id} to user ${userId}`);
            // Consider deleting the character document here if consistency is critical
            throw new Error("Failed to update user's character list");
        }

        console.log(`Character created: ${newCharacter.name} (ID: ${newCharacter.id}) for user ${user.username}`);
        safeSend(ws, { type: 'create_character_success', payload: newCharacter });

        // Send updated character list to client after creation
        // Fetch updated list from DB
        const updatedUser = await usersCollection.findOne({ id: userId });
        const userCharacters = updatedUser
            ? await charactersCollection.find({ id: { $in: updatedUser.characterIds } }).toArray()
            : [];
        safeSend(ws, { type: 'character_list_update', payload: userCharacters });

    } catch (error) {
        console.error("Character creation error:", error);
        safeSend(ws, { type: 'create_character_fail', payload: 'Server error during character creation' });
    }
}

export async function handleSelectCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId) {
        safeSend(ws, { type: 'select_character_fail', payload: 'User not logged in' });
        return;
    }
    const userId = connectionInfo.userId;

    if (!payload || typeof payload.characterId !== 'string') {
        safeSend(ws, { type: 'select_character_fail', payload: 'Invalid character selection data' });
        return;
    }

    const characterId = payload.characterId;

    try {
        // Fetch character and user from DB to validate ownership
        const character = await charactersCollection.findOne({ id: characterId });
        const user = await usersCollection.findOne({ id: userId });

        if (!character || !user || character.userId !== userId || !user.characterIds.includes(characterId)) {
            safeSend(ws, { type: 'select_character_fail', payload: 'Invalid character selected or character does not belong to user' });
            return;
        }

        // Update the connection info with the selected character
        connectionInfo.selectedCharacterId = characterId;
        activeConnections.set(ws, connectionInfo); // Update the map entry

        console.log(`User ${user.username} selected character ${character.name} (ID: ${characterId})`);

        // Ensure equipment field exists (for backward compatibility with older characters)
        if (!character.equipment) {
            console.warn(`Character ${character.id} loaded from DB is missing 'equipment' field. Initializing as empty object.`);
            character.equipment = {};
        }

        // Send confirmation and initial game state (Corrected Payload Keys)
        const currentZoneData = zones.get(character.currentZoneId);
        const allZonesArray = Array.from(zones.values()); // Get all zones for the client UI

        // --- Debug Log ---
        console.log(`Server: Sending allZones for character select. Count: ${allZonesArray.length}`);
        // console.log("Server: Sending allZonesArray content:", JSON.stringify(allZonesArray, null, 2)); // Optional: Log full content if needed

        // Calculate XP needed for the next level
        const xpToNext = xpForLevel(character.level + 1);

        // Add xpToNextLevel to the character data being sent
        const characterDataWithXp = {
            ...character,
            xpToNextLevel: xpToNext
        };

        safeSend(ws, {
            type: 'select_character_success',
            payload: {
                message: `Character ${character.name} selected. Welcome to ${currentZoneData?.name ?? 'the game'}!`,
                characterData: characterDataWithXp, // Send character data including xpToNextLevel
                currentZoneData: currentZoneData, // Correct key
                allZones: allZonesArray // Correct key
                // TODO: Add initial inventory etc.
            }
        });
    } catch (error) {
         console.error("Select character error:", error);
         safeSend(ws, { type: 'select_character_fail', payload: 'Server error during character selection' });
    }
}
