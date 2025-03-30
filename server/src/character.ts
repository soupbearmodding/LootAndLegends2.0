import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { UpdateFilter } from 'mongodb'; // Import UpdateFilter
import { usersCollection, charactersCollection } from './db.js';
import { safeSend } from './utils.js';
import { Character, ActiveConnectionsMap, User } from './types.js'; // Import User type
import { characterClasses, calculateMaxHp, calculateMaxMana, zones, xpForLevel } from './gameData.js'; // Import calculateMaxMana, xpForLevel
import { getZoneStatuses } from './zone.js'; // Import the new helper function

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

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        typeof payload.name !== 'string' || payload.name.trim() === '' ||
        typeof payload.classId !== 'string' || payload.classId.trim() === '')
    {
        safeSend(ws, { type: 'create_character_fail', payload: 'Invalid payload format: Requires non-empty name and classId strings.' });
        console.warn(`Invalid create_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }

    const name = payload.name.trim();
    const classId = payload.classId.trim().toLowerCase(); // Trim and lowercase classId

    if (name.length < 3 || name.length > 16) {
         safeSend(ws, { type: 'create_character_fail', payload: 'Character name must be between 3 and 16 characters' });
        return;
    }
    // TODO: Add check for unique character name *per user* in DB
    // --- End Validation ---

    const chosenClass = characterClasses.get(classId); // Use validated classId
    if (!chosenClass) {
        safeSend(ws, { type: 'create_character_fail', payload: `Invalid class selected: ${classId}` });
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
        name: name, // Use validated name
        class: classId, // Use validated classId
        level: 1,
        experience: 0,
        stats: { ...chosenClass.baseStats }, // Copy base stats
        maxHp: calculateMaxHp(chosenClass.baseStats),
        currentHp: calculateMaxHp(chosenClass.baseStats), // Start with full HP
        maxMana: calculateMaxMana(chosenClass.baseStats), // Calculate initial max mana
        currentMana: calculateMaxMana(chosenClass.baseStats), // Start with full mana
        currentZoneId: 'town', // Start everyone in town
        // zoneKills: {}, // Removed kill tracker initialization
        inventory: [], // Initialize empty inventory
        equipment: {}, // Initialize empty equipment slots
        groundLoot: [], // Initialize empty ground loot
        gold: 0, // Initialize gold
        potionSlot1: undefined, // Initialize potion slot 1
        potionSlot2: undefined, // Initialize potion slot 2
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

        // Enhanced Logging
        console.log(`Character created: ${newCharacter.name} (ID: ${newCharacter.id}, Class: ${newCharacter.class}) for user ${user.username} (ID: ${userId}).`);
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

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        typeof payload.characterId !== 'string' || payload.characterId.trim() === '')
    {
        safeSend(ws, { type: 'select_character_fail', payload: 'Invalid payload format: Requires non-empty characterId string.' });
        console.warn(`Invalid select_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    const characterId = payload.characterId;
    // --- End Validation ---

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

        // Enhanced Logging
        console.log(`User ${user.username} (ID: ${userId}) selected character ${character.name} (ID: ${characterId}, Class: ${character.class}, Level: ${character.level}).`);

        // Ensure equipment field exists (for backward compatibility with older characters)
        if (!character.equipment) {
            console.warn(`Character ${character.id} loaded from DB is missing 'equipment' field. Initializing as empty object.`);
            character.equipment = {};
        }

        // --- Force Start in Town & Heal ---
        let finalCharacterData = { ...character }; // Copy character data to modify
        let finalCurrentZoneId = character.currentZoneId;
        let dbUpdateNeeded = false;
        const updates: Partial<Character> = {};

        if (finalCurrentZoneId !== 'town') {
            console.log(`Character ${character.name} was in ${finalCurrentZoneId}, moving to Town on login.`);
            finalCurrentZoneId = 'town';
            updates.currentZoneId = finalCurrentZoneId;
            dbUpdateNeeded = true;
        }

        // Heal if starting in (or moved to) Town
        if (finalCurrentZoneId === 'town') {
            const maxHp = calculateMaxHp(character.stats);
            if (character.currentHp < maxHp) {
                console.log(`Healing character ${character.name} to full HP (${maxHp}) on login in town.`);
                updates.currentHp = maxHp;
                finalCharacterData.currentHp = maxHp; // Update local copy for payload
                dbUpdateNeeded = true;
            }
        }

        // Update DB if necessary (zone change or healing)
        if (dbUpdateNeeded) {
            await charactersCollection.updateOne({ id: character.id }, { $set: updates });
            // Update the character object we use for calculations below
            finalCharacterData.currentZoneId = finalCurrentZoneId; // Ensure local data reflects the change
        }
        // --- End Force Start in Town ---


        // Send confirmation and initial game state using potentially modified data
        const currentZoneData = zones.get(finalCurrentZoneId); // Use the final zone ID
        // Calculate zone statuses based on character's progress (using original character data is fine here)
        const zoneStatuses = getZoneStatuses(character);

        // --- Debug Log ---
        console.log(`Server: Sending zoneStatuses for character select. Count: ${zoneStatuses.length}`);
        // console.log("Server: Sending zoneStatuses content:", JSON.stringify(zoneStatuses, null, 2)); // Optional: Log full content if needed

        // Calculate XP needed for the next level bracket and current XP within this level (use finalCharacterData)
        const totalXpForCurrentLevel = xpForLevel(finalCharacterData.level);
        const totalXpForNextLevel = xpForLevel(finalCharacterData.level + 1);
        const currentLevelXp = finalCharacterData.experience - totalXpForCurrentLevel;
        const xpToNextLevelBracket = totalXpForNextLevel - totalXpForCurrentLevel;

        // Add calculated XP values to the character data being sent (use finalCharacterData)
        const characterDataForPayload = {
            ...finalCharacterData, // Use the potentially updated character data (zone, HP)
            currentLevelXp: currentLevelXp,
            xpToNextLevelBracket: xpToNextLevelBracket
        };

        safeSend(ws, {
            type: 'select_character_success',
            payload: {
                message: `Character ${finalCharacterData.name} selected. Welcome to ${currentZoneData?.name ?? 'the game'}!`,
                characterData: characterDataForPayload, // Send potentially updated character data
                currentZoneData: currentZoneData, // Send data for the actual starting zone ('town')
                zoneStatuses: zoneStatuses // Send the detailed zone status list
                // TODO: Add initial inventory etc.
            }
        });
    } catch (error) {
         console.error("Select character error:", error);
         safeSend(ws, { type: 'select_character_fail', payload: 'Server error during character selection' });
    }
}


export async function handleDeleteCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId) {
        safeSend(ws, { type: 'delete_character_fail', payload: 'User not logged in' });
        return;
    }
    const userId = connectionInfo.userId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        typeof payload.characterId !== 'string' || payload.characterId.trim() === '')
    {
        safeSend(ws, { type: 'delete_character_fail', payload: 'Invalid payload format: Requires non-empty characterId string.' });
        console.warn(`Invalid delete_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    const characterId = payload.characterId;
    // --- End Validation ---

    try {
        // Fetch character and user to validate ownership before deleting
        const character = await charactersCollection.findOne({ id: characterId });
        const user = await usersCollection.findOne({ id: userId });

        if (!character || !user || character.userId !== userId || !user.characterIds.includes(characterId)) {
            safeSend(ws, { type: 'delete_character_fail', payload: 'Character not found or does not belong to user' });
            return;
        }

        // 1. Delete the character document
        const deleteCharResult = await charactersCollection.deleteOne({ id: characterId });
        if (deleteCharResult.deletedCount !== 1) {
            console.error(`Failed to delete character document ${characterId}`);
            safeSend(ws, { type: 'delete_character_fail', payload: 'Server error deleting character data' });
            return; // Stop if character deletion failed
        }

        // 2. Remove character ID from user's list
        const updateUserResult = await usersCollection.updateOne(
            { id: userId },
            { $pull: { characterIds: characterId } }
        );

        if (updateUserResult.modifiedCount !== 1) {
            // This is problematic - character deleted but not removed from user list.
            // Log this inconsistency. For now, we'll still report success to the client
            // as the character *is* gone, but this needs monitoring/potential cleanup script.
            console.warn(`Character ${characterId} deleted, but failed to remove ID from user ${userId}'s list.`);
        }

        // Enhanced Logging
        console.log(`Character deleted: ${character.name} (ID: ${characterId}) by user ${user.username} (ID: ${userId}).`);
        safeSend(ws, { type: 'delete_character_success', payload: { characterId: characterId } }); // Send back the ID

        // Optional: Send updated character list? The client already handles removing it locally.
        // If consistency is paramount, fetch and send the updated list here.
        // const updatedUser = await usersCollection.findOne({ id: userId });
        // const userCharacters = updatedUser
        //     ? await charactersCollection.find({ id: { $in: updatedUser.characterIds } }).toArray()
        //     : [];
        // safeSend(ws, { type: 'character_list_update', payload: userCharacters });


    } catch (error) {
        console.error("Delete character error:", error);
        safeSend(ws, { type: 'delete_character_fail', payload: 'Server error during character deletion' });
    }
}
