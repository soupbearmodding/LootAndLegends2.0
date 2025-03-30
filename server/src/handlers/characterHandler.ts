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
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId) {
        safeSend(ws, { type: 'create_character_fail', payload: 'User not logged in' });
        return;
    }
    const userId = connectionInfo.userId;

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

        // Send updated character list to client after creation
        // Fetch updated list using UserRepository
        const userCharacters = await UserRepository.findByUsername( // Assuming username is available or fetch user first
             (await UserRepository.findById(userId))?.username ?? ''
        ).then(user => user ? CharacterRepository.findByUserId(user.id) : []); // Fetch characters based on user's updated list

        safeSend(ws, { type: 'character_list_update', payload: userCharacters });

    } catch (error: any) {
        console.error("Handler: Character creation error:", error);
        safeSend(ws, { type: 'create_character_fail', payload: error.message || 'Server error during character creation' });
    }
}

export async function handleSelectCharacter(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId) {
        safeSend(ws, { type: 'select_character_fail', payload: 'User not logged in' });
        return;
    }
    const userId = connectionInfo.userId;

    if (!isValidCharacterSelectPayload(payload)) {
        safeSend(ws, { type: 'select_character_fail', payload: 'Invalid payload format: Requires non-empty characterId string.' });
        console.warn(`Invalid select_character payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    const characterId = payload.characterId;

    try {
        const { characterData, currentZoneData, zoneStatuses } = await CharacterService.selectCharacter(userId, characterId);

        // Update the connection info with the selected character ID
        connectionInfo.selectedCharacterId = characterId;
        activeConnections.set(ws, connectionInfo); // Update the map entry

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
