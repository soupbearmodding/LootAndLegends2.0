import WebSocket from 'ws';
import { CharacterService } from '../services/characterService.js';
import { safeSend } from '../utils.js';
import { ActiveConnectionsMap, Character } from '../types.js';
import { UserRepository } from '../repositories/userRepository.js'; // Needed for updated list after create/delete
import { CharacterRepository } from '../repositories/characterRepository.js'; // Import CharacterRepository

// --- Input Validation Helpers ---

function isValidCharacterCreatePayload(payload: any): payload is { name: string; classId: string } {
    return (
        typeof payload === 'object' && payload !== null &&
        typeof payload.name === 'string' && payload.name.trim() !== '' &&
        typeof payload.classId === 'string' && payload.classId.trim() !== ''
    );
}

function isValidCharacterSelectPayload(payload: any): payload is { characterId: string } {
    return (
        typeof payload === 'object' && payload !== null &&
        typeof payload.characterId === 'string' && payload.characterId.trim() !== ''
    );
}

function isValidCharacterDeletePayload(payload: any): payload is { characterId: string } {
    return (
        typeof payload === 'object' && payload !== null &&
        typeof payload.characterId === 'string' && payload.characterId.trim() !== ''
    );
}

// --- Character Handlers ---

export async function handleCreateCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    let userId: string | undefined;
    const connectionInfo = activeConnections.get(ws);

    // --- DEV ONLY: Allow character creation if skipped login ---
    // Check if the client sent the specific dummy ID used in App.tsx's handleSkipLogin
    // IMPORTANT: Remove this check before production!
    if (payload?.devUserId === 'dev-user-skipped-login') {
        console.warn("DEV MODE: Allowing character creation with skipped login.");
        userId = 'dev-user-skipped-login'; // Use the dummy ID
        // Optionally add this dummy user to activeConnections if needed downstream,
        // but it might be better to handle the null case where needed.
        // if (!connectionInfo) {
        //     activeConnections.set(ws, { userId: userId });
        // }
    } else {
        // --- Regular Login Check ---
        if (!connectionInfo || !connectionInfo.userId) {
            safeSend(ws, { type: 'create_character_fail', payload: 'User not logged in' });
            return;
        }
        userId = connectionInfo.userId;
    }
    // -------------------------------------------------------

    if (!userId) { // Should not happen if logic above is correct, but safety check
         safeSend(ws, { type: 'create_character_fail', payload: 'User ID could not be determined.' });
         return;
    }

    if (!isValidCharacterCreatePayload(payload)) {
        safeSend(ws, { type: 'create_character_fail', payload: 'Invalid payload format: Requires non-empty name and classId strings.' });
        console.warn(`Invalid create_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }

    // Trim and lowercase classId before passing to service
    const name = payload.name.trim();
    const classId = payload.classId.trim().toLowerCase();

    try {
        const newCharacter = await CharacterService.createCharacter(userId, name, classId);

        // Send success message with the new character data
        safeSend(ws, { type: 'create_character_success', payload: newCharacter });

        // Send updated character list to client after creation (Skip for DEV user)
        if (userId !== 'dev-user-skipped-login') {
            try {
                const user = await UserRepository.findById(userId);
                if (user) {
                    const userCharacters = await CharacterRepository.findByUserId(user.id);
                    safeSend(ws, { type: 'character_list_update', payload: userCharacters });
                } else {
                     console.warn(`Could not find user ${userId} to send character list update after creation.`);
                }
            } catch (listError) {
                 console.error(`Error fetching character list for user ${userId} after creation:`, listError);
            }
        }

    } catch (error: any) {
        console.error("Handler: Character creation error:", error);
        safeSend(ws, { type: 'create_character_fail', payload: error.message || 'Server error during character creation' });
    }
}

export async function handleSelectCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    // Validate payload first
    if (!isValidCharacterSelectPayload(payload)) {
        safeSend(ws, { type: 'select_character_fail', payload: 'Invalid payload format: Requires non-empty characterId string.' });
        console.warn(`Invalid select_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    const characterId = payload.characterId; // Declare characterId once here

    let userId: string | undefined;
    let connectionInfo = activeConnections.get(ws); // Get initial connection info

    // --- DEV ONLY: Allow character selection if skipped login ---
    // Check if the character being selected belongs to the dummy user ID
    // IMPORTANT: Remove this check before production!
    let isDevSkip = false;
    try { // Add try block for fetching character
        const characterToCheck = await CharacterRepository.findById(characterId);
        if (characterToCheck?.userId === 'dev-user-skipped-login') {
            console.warn("DEV MODE: Allowing character selection with skipped login.");
            userId = 'dev-user-skipped-login';
            isDevSkip = true;
            // Ensure the connection is associated with the dummy user ID
            if (!connectionInfo) {
                connectionInfo = { userId: userId }; // Create new info object
                activeConnections.set(ws, connectionInfo);
            } else if (connectionInfo.userId !== userId) {
                connectionInfo.userId = userId; // Update existing info object
                activeConnections.set(ws, connectionInfo);
            }
            // connectionInfo is now guaranteed to exist and have the correct userId
        }
    } catch (fetchError) {
        console.error("Error fetching character during dev skip check:", fetchError);
        // Proceed to normal login check which will likely fail if fetch failed
    } // Close try block

    if (!isDevSkip) {
        // --- Regular Login Check ---
        // Re-fetch connectionInfo in case it was just set by dev skip logic
        connectionInfo = activeConnections.get(ws);
        if (!connectionInfo || !connectionInfo.userId) {
            safeSend(ws, { type: 'select_character_fail', payload: 'User not logged in' });
            return;
        }
        userId = connectionInfo.userId; // Assign userId from potentially updated connectionInfo
    }
    // -------------------------------------------------------

    // At this point, userId should be defined (either real or dummy)
    if (!userId) {
         safeSend(ws, { type: 'select_character_fail', payload: 'User ID could not be determined (Internal Error).' });
         console.error("Internal Error: userId is undefined in handleSelectCharacter after checks.");
         return;
    }

    try {
        // The service layer already has the dev skip logic for user validation
        // Pass the guaranteed string userId
        const { characterData, currentZoneData, zoneStatuses } = await CharacterService.selectCharacter(userId, characterId);

        // Update the connection info with the selected character ID
        // connectionInfo is guaranteed to exist here if userId is set
        connectionInfo!.selectedCharacterId = characterId; // Use non-null assertion
        activeConnections.set(ws, connectionInfo!); // Update the map entry

        console.log(`Handler: User ${userId} selected character ${characterId}.`);

        // Send confirmation and initial game state
        safeSend(ws, {
            type: 'select_character_success',
            payload: {
                message: `Character ${characterData.name} selected. Welcome to ${currentZoneData?.name ?? 'the game'}!`,
                characterData: characterData,
                currentZoneData: currentZoneData,
                zoneStatuses: zoneStatuses
            }
        });

    } catch (error: any) {
         console.error("Handler: Select character error:", error);
         safeSend(ws, { type: 'select_character_fail', payload: error.message || 'Server error during character selection' });
    }
}


export async function handleDeleteCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId) {
        safeSend(ws, { type: 'delete_character_fail', payload: 'User not logged in' });
        return;
    }
    const userId = connectionInfo.userId;

    if (!isValidCharacterDeletePayload(payload)) {
        safeSend(ws, { type: 'delete_character_fail', payload: 'Invalid payload format: Requires non-empty characterId string.' });
        console.warn(`Invalid delete_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    const characterId = payload.characterId;

    try {
        await CharacterService.deleteCharacter(userId, characterId);

        console.log(`Handler: Character ${characterId} deleted by user ${userId}.`);
        safeSend(ws, { type: 'delete_character_success', payload: { characterId: characterId } }); // Send back the ID

        // Send updated character list to client after deletion
        const userCharacters = await UserRepository.findByUsername(
             (await UserRepository.findById(userId))?.username ?? ''
        ).then(user => user ? CharacterRepository.findByUserId(user.id) : []);

        safeSend(ws, { type: 'character_list_update', payload: userCharacters });

    } catch (error: any) {
        console.error("Handler: Delete character error:", error);
        safeSend(ws, { type: 'delete_character_fail', payload: error.message || 'Server error during character deletion' });
    }
}
