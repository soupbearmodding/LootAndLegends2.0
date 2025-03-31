import { v4 as uuidv4 } from 'uuid';
import { ICharacterRepository, CharacterRepository } from '../repositories/characterRepository.js'; // Import interface and concrete repo
import { IUserRepository, UserRepository } from '../repositories/userRepository.js'; // Import interface and concrete repo
import { ZoneService, ZoneWithStatus } from './zoneService.js'; // Import ZoneService and ZoneWithStatus
import { Character, User, Zone } from '../types.js';
import { characterClasses, calculateMaxHp, calculateMaxMana, zones, xpForLevel, xpRequiredForLevel } from '../gameData.js';
// Removed import { getZoneStatuses, ZoneStatus, ZoneWithStatus } from '../zone.js';

const MAX_CHARACTERS_PER_ACCOUNT = 5;

// Define result types for service methods (optional but good practice)
export interface SelectCharacterResult {
    characterData: Character;
    currentZoneData: Zone | undefined;
    zoneStatuses: ZoneWithStatus[];
}

export class CharacterService {
    // Use interfaces for dependencies
    private characterRepository: ICharacterRepository;
    private userRepository: IUserRepository;
    private zoneService: ZoneService; // Inject ZoneService

    constructor(
        characterRepository: ICharacterRepository,
        userRepository: IUserRepository,
        zoneService: ZoneService // Add ZoneService to constructor
    ) {
        this.characterRepository = characterRepository;
        this.userRepository = userRepository;
        this.zoneService = zoneService; // Store injected service
    }

    /**
     * Creates a new character for a given user.
     * @param userId The ID of the user creating the character.
     * @param name The desired name for the character.
     * @param classId The ID of the desired character class.
     * @returns A promise that resolves to the newly created Character object.
     * @throws Error if user not found (unless using dev skip ID), class invalid, character limit reached, or DB error occurs.
     */
    async createCharacter(userId: string, name: string, classId: string): Promise<Character> {
        let user: User | null = null;
        let usernameForLog = userId;

        if (userId !== 'dev-user-skipped-login') {
            user = await this.userRepository.findById(userId); // Use injected repo
            if (!user) {
                throw new Error(`User not found (ID: ${userId})`);
            }
            usernameForLog = user.username;

            if (user.characterIds.length >= MAX_CHARACTERS_PER_ACCOUNT) {
                throw new Error('Maximum characters reached for this account');
            }
        } else {
            console.warn("CharacterService (DEV MODE): Bypassing user validation for character creation.");
        }

        const chosenClass = characterClasses.get(classId);
        if (!chosenClass) {
            throw new Error(`Invalid class selected: ${classId}`);
        }

        if (name.length < 3 || name.length > 16) {
            throw new Error('Character name must be between 3 and 16 characters');
        }

        const newCharacter: Character = {
            id: uuidv4(),
            userId: userId,
            name: name,
            class: classId,
            level: 1,
            experience: 0,
            stats: { ...chosenClass.baseStats },
            maxHp: calculateMaxHp(chosenClass.baseStats),
            currentHp: calculateMaxHp(chosenClass.baseStats),
            maxMana: calculateMaxMana(chosenClass.baseStats),
            currentMana: calculateMaxMana(chosenClass.baseStats),
            currentZoneId: 'town',
            inventory: [],
            equipment: {},
            groundLoot: [],
            gold: 0,
            potionSlot1: undefined,
            potionSlot2: undefined,
        };

        try {
            await this.characterRepository.save(newCharacter); // Use injected repo

            if (userId !== 'dev-user-skipped-login' && user) {
                const updated = await this.userRepository.updateCharacterList(userId, newCharacter.id, 'add'); // Use injected repo
                if (!updated) {
                    console.error(`Failed to add character ID ${newCharacter.id} to user ${userId}. Attempting rollback.`);
                    await this.characterRepository.deleteById(newCharacter.id); // Use injected repo
                    throw new Error("Failed to update user's character list after character creation.");
                }
            }

            console.log(`CharacterService: Created character ${newCharacter.name} (ID: ${newCharacter.id}) for user ${usernameForLog} (ID: ${userId}).`);
            return newCharacter;
        } catch (error) {
            console.error("CharacterService: Error during character creation:", error);
            if (error instanceof Error && !error.message.includes("Failed to update user's character list")) {
                 await this.characterRepository.deleteById(newCharacter.id); // Attempt cleanup
            }
            throw error;
        }
    }

    /**
     * Selects a character for a user, applying login rules (start in town, heal).
     * @param userId The ID of the user selecting the character.
     * @param characterId The ID of the character being selected.
     * @returns A promise resolving to an object containing the character data, current zone data, and zone statuses.
     * @throws Error if user/character not found, character doesn't belong to user, or DB error.
     */
    async selectCharacter(userId: string, characterId: string): Promise<SelectCharacterResult> {
        const character = await this.characterRepository.findById(characterId); // Use injected repo
        let user: User | null = null;
        let usernameForLog = userId;

        if (userId !== 'dev-user-skipped-login') {
            user = await this.userRepository.findById(userId); // Use injected repo
            if (!user) {
                 throw new Error(`User not found (ID: ${userId}) during character selection.`);
            }
            usernameForLog = user.username;
            if (!character || character.userId !== userId || !user.characterIds.includes(characterId)) {
                throw new Error('Invalid character selected or character does not belong to user');
            }
        } else {
             console.warn("CharacterService (DEV MODE): Bypassing user validation for character selection.");
             if (!character) {
                 throw new Error(`Character not found (ID: ${characterId})`);
             }
        }

        if (!character.equipment) {
            character.equipment = {};
        }

        let dbUpdateNeeded = false;
        const updates: Partial<Character> = {};

        if (character.currentZoneId !== 'town') {
            console.log(`CharacterService: Character ${character.name} was in ${character.currentZoneId}, moving to Town on select.`);
            character.currentZoneId = 'town';
            updates.currentZoneId = 'town';
            dbUpdateNeeded = true;
        }

        if (character.currentZoneId === 'town') {
            const maxHp = calculateMaxHp(character.stats);
            if (character.currentHp < maxHp) {
                console.log(`CharacterService: Healing character ${character.name} to full HP (${maxHp}) on select in town.`);
                character.currentHp = maxHp;
                updates.currentHp = maxHp;
                dbUpdateNeeded = true;
            }
        }

        if (dbUpdateNeeded) {
            try {
                await this.characterRepository.update(character.id, updates); // Use injected repo
            } catch (error) {
                 console.error(`CharacterService: Failed to update character ${character.id} during selection:`, error);
                 throw error;
            }
        }

        const currentZoneData = zones.get(character.currentZoneId);
        const zoneStatuses = this.zoneService.getZoneStatuses(character); // Use injected zoneService

        const totalXpForCurrentLevel = xpForLevel(character.level);
        const totalXpForNextLevel = xpForLevel(character.level + 1);
        const currentLevelXp = character.experience - totalXpForCurrentLevel;
        const xpToNextLevelBracket = totalXpForNextLevel - totalXpForCurrentLevel;

        const characterDataForPayload = {
            ...character,
            currentLevelXp: currentLevelXp,
            xpToNextLevelBracket: xpToNextLevelBracket
        };

        console.log(`CharacterService: User ${usernameForLog} (ID: ${userId}) selected character ${character.name} (ID: ${characterId}).`);

        return {
            characterData: characterDataForPayload,
            currentZoneData: currentZoneData,
            zoneStatuses: zoneStatuses
        };
    }

    /**
     * Deletes a character and removes it from the user's list.
     * @param userId The ID of the user deleting the character.
     * @param characterId The ID of the character to delete.
     * @returns A promise that resolves when deletion is complete.
     * @throws Error if user/character not found, ownership mismatch, or DB error.
     */
    async deleteCharacter(userId: string, characterId: string): Promise<void> {
        let user: User | null = null;
        let usernameForLog = userId;

        if (userId !== 'dev-user-skipped-login') {
            user = await this.userRepository.findById(userId); // Use injected repo
            if (!user) {
                throw new Error(`User not found (ID: ${userId}) during character deletion.`);
            }
            usernameForLog = user.username;
        } else {
            console.warn("CharacterService (DEV MODE): Bypassing user validation for character deletion.");
        }

        const character = await this.characterRepository.findById(characterId); // Use injected repo

        if (userId !== 'dev-user-skipped-login') {
            if (!character || !user || character.userId !== userId || !user.characterIds.includes(characterId)) {
                throw new Error('Character not found or does not belong to user');
            }
        } else {
            if (!character) {
                 throw new Error(`Character not found (ID: ${characterId})`);
            }
        }

        try {
            const deleted = await this.characterRepository.deleteById(characterId); // Use injected repo
            if (!deleted) {
                throw new Error(`Failed to delete character document ${characterId}`);
            }

            if (userId !== 'dev-user-skipped-login' && user) {
                const updated = await this.userRepository.updateCharacterList(userId, characterId, 'remove'); // Use injected repo
                if (!updated) {
                    console.warn(`CharacterService: Character ${characterId} deleted, but failed to remove ID from user ${userId}'s list.`);
                }
            }

            console.log(`CharacterService: Deleted character ${character.name} (ID: ${characterId}) for user ${usernameForLog} (ID: ${userId}).`);

        } catch (error) {
            console.error("CharacterService: Error during character deletion:", error);
            throw error;
        }
    }

    /**
     * Adds experience to a character, handles level ups, and returns the updated state.
     * NOTE: This function MODIFIES the passed character object directly.
     * @param character The character object (will be modified).
     * @param xpGained The amount of XP gained.
     * @returns An object indicating if level up occurred and any stat increases.
     */
    addExperience(character: Character, xpGained: number): { leveledUp: boolean, statIncreases: any } {
        // This method doesn't interact with repositories directly, only modifies the passed object
        // It can remain largely the same, but is now part of the service instance
        if (xpGained <= 0) {
            return { leveledUp: false, statIncreases: {} };
        }

        character.experience = (character.experience ?? 0) + xpGained;
        console.log(`CharacterService: ${character.name} gained ${xpGained} XP. Total XP: ${character.experience}.`);

        let leveledUp = false;
        let statIncreases: { strength?: number; dexterity?: number; vitality?: number; energy?: number } = {};

        while (character.experience >= xpRequiredForLevel(character.level)) {
            leveledUp = true;
            character.level++;
            console.log(`CharacterService: Level Up! ${character.name} reached level ${character.level}.`);

            if (!character.stats) character.stats = { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
            const increaseAmount = 1;
            character.stats.strength = (character.stats.strength ?? 0) + increaseAmount;
            character.stats.dexterity = (character.stats.dexterity ?? 0) + increaseAmount;
            character.stats.vitality = (character.stats.vitality ?? 0) + increaseAmount;
            character.stats.energy = (character.stats.energy ?? 0) + increaseAmount;

            statIncreases = {
                strength: (statIncreases.strength ?? 0) + increaseAmount,
                dexterity: (statIncreases.dexterity ?? 0) + increaseAmount,
                vitality: (statIncreases.vitality ?? 0) + increaseAmount,
                energy: (statIncreases.energy ?? 0) + increaseAmount,
            };
            console.log(`CharacterService: Stats increased: +${increaseAmount} to all.`);

            character.maxHp = calculateMaxHp(character.stats);
            character.maxMana = calculateMaxMana(character.stats);
            character.currentHp = character.maxHp;
            character.currentMana = character.maxMana;
            console.log(`CharacterService: Max HP/Mana updated to ${character.maxHp}/${character.maxMana}. HP/Mana restored.`);
        }

        return { leveledUp, statIncreases };
    }
}

// Remove the old static export:
// export const CharacterService = { ... };
