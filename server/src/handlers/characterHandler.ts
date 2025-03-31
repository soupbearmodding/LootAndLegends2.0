import WebSocket from 'ws';
import { CharacterService } from '../services/characterService.js';
import { UserRepository } from '../repositories/userRepository.js';
import { CharacterRepository } from '../repositories/characterRepository.js';
import { send } from '../websocketUtils.js';
import { activeConnections } from '../server.js';
import {
    validatePayload,
    CreateCharacterPayloadSchema,
    SelectCharacterPayloadSchema,
    DeleteCharacterPayloadSchema
} from '../validation.js';
import { Character, SelectCharacterResult, IUserRepository, ICharacterRepository } from '../types.js';

// Helper function to get user ID (handles dev skip logic internally for now)
// Returns null if not logged in and not dev skip
function getUserId(ws: WebSocket, payload: any): string | null {
    let userId: string | undefined;
    let connectionInfo = activeConnections.get(ws);

    if (!userId) { // Should not happen if logic is correct
        send(ws, { type: 'error', payload: 'User ID could not be determined.' });
        return null;
    }
    return userId;
}


export class CharacterHandler {
    private characterService: CharacterService;
    // Inject repositories needed for list updates directly in handler (could be moved to service later)
    private userRepository: IUserRepository;
    private characterRepository: ICharacterRepository;

    constructor(
        characterService: CharacterService,
        userRepository: IUserRepository,
        characterRepository: ICharacterRepository
    ) {
        this.characterService = characterService;
        this.userRepository = userRepository;
        this.characterRepository = characterRepository;
    }

    /**
     * Handles character creation request.
     */
    async handleCreateCharacter(ws: WebSocket, payload: unknown): Promise<void> {
        const userId = getUserId(ws, payload); // Use helper to get userId (handles dev skip)
        if (!userId) return; // Error sent by helper

        if (!validatePayload(payload, CreateCharacterPayloadSchema)) {
            send(ws, { type: 'create_character_fail', payload: 'Invalid payload format.' });
            return;
        }
        // We know payload is an object with name and classId now
        const data = payload as { name: string; classId: string; devUserId?: string };
        const name = data.name.trim();
        const classId = data.classId.trim().toLowerCase();

        try {
            // Use injected service instance
            const newCharacter = await this.characterService.createCharacter(userId, name, classId);

            send(ws, { type: 'create_character_success', payload: newCharacter });

            // Send updated character list (Skip for DEV user)
            if (userId !== 'dev-user-skipped-login') {
                await this.sendUpdatedCharacterList(ws, userId);
            }

        } catch (error: any) {
            console.error("Handler: Character creation error:", error);
            send(ws, { type: 'create_character_fail', payload: error.message || 'Server error during character creation' });
        }
    }

    /**
     * Handles character selection request.
     */
    async handleSelectCharacter(ws: WebSocket, payload: unknown): Promise<void> {
        if (!validatePayload(payload, SelectCharacterPayloadSchema)) {
            send(ws, { type: 'select_character_fail', payload: 'Invalid payload format.' });
            return;
        }
        const { characterId } = payload as { characterId: string };

        // Use helper to get userId (handles dev skip based on character's owner)
        // Need to fetch character first for dev skip check
        let isDevSkip = false;
        let potentialOwnerId: string | undefined;
        try {
            const characterToCheck = await this.characterRepository.findById(characterId);
            potentialOwnerId = characterToCheck?.userId;
            if (potentialOwnerId === 'dev-user-skipped-login') {
                isDevSkip = true;
            }
        } catch (fetchError) {
             console.error("Handler: Error fetching character during dev skip check:", fetchError);
             send(ws, { type: 'select_character_fail', payload: 'Error checking character.' });
             return;
        }

        const userId = getUserId(ws, isDevSkip ? { devUserId: 'dev-user-skipped-login' } : {});
        if (!userId) return; // Error sent by helper

        // Re-verify ownership if not dev skip (belt-and-suspenders)
        if (!isDevSkip && potentialOwnerId !== userId) {
             send(ws, { type: 'select_character_fail', payload: 'Character does not belong to user.' });
             return;
        }


        try {
            // Use injected service instance
            const result: SelectCharacterResult = await this.characterService.selectCharacter(userId, characterId);

            // Update connection info
            const connectionInfo = activeConnections.get(ws);
            if (connectionInfo) { // Should always exist if userId was determined
                connectionInfo.selectedCharacterId = characterId;
                activeConnections.set(ws, connectionInfo);
                console.log(`Handler: User ${userId} selected character ${characterId}.`);

                 send(ws, {
                    type: 'select_character_success',
                    payload: {
                        message: `Character ${result.characterData.name} selected. Welcome to ${result.currentZoneData?.name ?? 'the game'}!`,
                        characterData: result.characterData,
                        currentZoneData: result.currentZoneData,
                        zoneStatuses: result.zoneStatuses
                    }
                });
            } else {
                 console.error("Handler: Connection info unexpectedly missing after userId check in selectCharacter.");
                 send(ws, { type: 'select_character_fail', payload: 'Internal connection error.' });
            }

        } catch (error: any) {
             console.error("Handler: Select character error:", error);
             send(ws, { type: 'select_character_fail', payload: error.message || 'Server error during character selection' });
        }
    }

    /**
     * Handles character deletion request.
     */
    async handleDeleteCharacter(ws: WebSocket, payload: unknown): Promise<void> {
        const userId = getUserId(ws, payload); // Use helper (dev skip doesn't apply directly here)
        if (!userId) return;

        if (!validatePayload(payload, DeleteCharacterPayloadSchema)) {
            send(ws, { type: 'delete_character_fail', payload: 'Invalid payload format.' });
            return;
        }
        const { characterId } = payload as { characterId: string };

        try {
            // Use injected service instance
            await this.characterService.deleteCharacter(userId, characterId);

            console.log(`Handler: Character ${characterId} deleted by user ${userId}.`);
            send(ws, { type: 'delete_character_success', payload: { characterId: characterId } });

            // Send updated character list (Skip for DEV user)
             if (userId !== 'dev-user-skipped-login') {
                await this.sendUpdatedCharacterList(ws, userId);
            }

        } catch (error: any) {
            console.error("Handler: Delete character error:", error);
            send(ws, { type: 'delete_character_fail', payload: error.message || 'Server error during character deletion' });
        }
    }

    /**
     * Fetches and sends the updated character list for a user.
     */
    private async sendUpdatedCharacterList(ws: WebSocket, userId: string): Promise<void> {
         try {
            // Use injected repository
            const userCharacters = await this.characterRepository.findByUserId(userId);
            send(ws, { type: 'character_list_update', payload: userCharacters });
        } catch (listError) {
            console.error(`Handler: Error fetching character list for user ${userId}:`, listError);
            // Optionally send an error to the client, but often just logging is sufficient here
        }
    }
}

// Remove old exports if they existed
// export { handleCreateCharacter, handleSelectCharacter, handleDeleteCharacter };
