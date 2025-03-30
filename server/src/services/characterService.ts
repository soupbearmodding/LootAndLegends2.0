import { v4 as uuidv4 } from 'uuid';
import { CharacterRepository } from '../repositories/characterRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { Character, User, Zone } from '../types.js'; // Removed ZoneStatus from here
import { characterClasses, calculateMaxHp, calculateMaxMana, zones, xpForLevel, xpRequiredForLevel } from '../gameData.js';
import { getZoneStatuses, ZoneStatus, ZoneWithStatus } from '../zone.js'; // Import ZoneStatus AND ZoneWithStatus from zone.ts

const MAX_CHARACTERS_PER_ACCOUNT = 5;

/**
 * Creates a new character for a given user.
 * @param userId The ID of the user creating the character.
 * @param name The desired name for the character.
 * @param classId The ID of the desired character class.
 * @returns A promise that resolves to the newly created Character object.
 * @throws Error if user not found, class invalid, character limit reached, or DB error occurs.
 */
async function createCharacter(userId: string, name: string, classId: string): Promise<Character> {
    const user = await UserRepository.findById(userId);
    if (!user) {
        throw new Error(`User not found (ID: ${userId})`);
    }

    if (user.characterIds.length >= MAX_CHARACTERS_PER_ACCOUNT) {
        throw new Error('Maximum characters reached for this account');
    }

    const chosenClass = characterClasses.get(classId);
    if (!chosenClass) {
        throw new Error(`Invalid class selected: ${classId}`);
    }

    // Basic name validation (can be expanded)
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
        currentZoneId: 'town', // Start in town
        inventory: [],
        equipment: {},
        groundLoot: [], // Initialize ground loot
        gold: 0,
        potionSlot1: undefined,
        potionSlot2: undefined,
    };

    try {
        // Save the character first
        await CharacterRepository.save(newCharacter);

        // Then add the character ID to the user's list
        const updated = await UserRepository.updateCharacterList(userId, newCharacter.id, 'add');
        if (!updated) {
            // Attempt to roll back character creation if user update fails (best effort)
            console.error(`Failed to add character ID ${newCharacter.id} to user ${userId}. Attempting rollback.`);
            await CharacterRepository.deleteById(newCharacter.id);
            throw new Error("Failed to update user's character list after character creation.");
        }

        console.log(`CharacterService: Created character ${newCharacter.name} (ID: ${newCharacter.id}) for user ${user.username} (ID: ${userId}).`);
        return newCharacter;
    } catch (error) {
        console.error("CharacterService: Error during character creation:", error);
        // Attempt rollback if character might have been saved but user update failed
        if (error instanceof Error && !error.message.includes("Failed to update user's character list")) {
             await CharacterRepository.deleteById(newCharacter.id); // Attempt cleanup
        }
        throw error; // Re-throw the original or new error
    }
}

/**
 * Selects a character for a user, applying login rules (start in town, heal).
 * @param userId The ID of the user selecting the character.
 * @param characterId The ID of the character being selected.
 * @returns A promise resolving to an object containing the character data, current zone data, and zone statuses (including full zone info).
 * @throws Error if user/character not found, character doesn't belong to user, or DB error.
 */
async function selectCharacter(userId: string, characterId: string): Promise<{ characterData: Character, currentZoneData: Zone | undefined, zoneStatuses: ZoneWithStatus[] }> { // Changed ZoneStatus[] to ZoneWithStatus[]
    const character = await CharacterRepository.findById(characterId);
    const user = await UserRepository.findById(userId); // Fetch user to verify ownership

    if (!character || !user || character.userId !== userId || !user.characterIds.includes(characterId)) {
        throw new Error('Invalid character selected or character does not belong to user');
    }

    // Ensure equipment field exists (backward compatibility)
    if (!character.equipment) {
        character.equipment = {};
    }

    let dbUpdateNeeded = false;
    const updates: Partial<Character> = {};

    // --- Force Start in Town & Heal Logic ---
    if (character.currentZoneId !== 'town') {
        console.log(`CharacterService: Character ${character.name} was in ${character.currentZoneId}, moving to Town on select.`);
        character.currentZoneId = 'town'; // Update local object
        updates.currentZoneId = 'town';
        dbUpdateNeeded = true;
    }

    // Heal if starting in (or moved to) Town
    if (character.currentZoneId === 'town') {
        const maxHp = calculateMaxHp(character.stats); // Use potentially updated stats if level up happened before save
        if (character.currentHp < maxHp) {
            console.log(`CharacterService: Healing character ${character.name} to full HP (${maxHp}) on select in town.`);
            character.currentHp = maxHp; // Update local object
            updates.currentHp = maxHp;
            dbUpdateNeeded = true;
        }
    }

    // Update DB only if necessary
    if (dbUpdateNeeded) {
        try {
            await CharacterRepository.update(character.id, updates);
        } catch (error) {
             console.error(`CharacterService: Failed to update character ${character.id} during selection:`, error);
             throw error; // Re-throw DB error
        }
    }
    // --- End Force Start in Town ---

    const currentZoneData = zones.get(character.currentZoneId); // Use the final zone ID
    const zoneStatuses = getZoneStatuses(character); // Calculate based on character state

    // Calculate XP breakdown for payload
    const totalXpForCurrentLevel = xpForLevel(character.level);
    const totalXpForNextLevel = xpForLevel(character.level + 1);
    const currentLevelXp = character.experience - totalXpForCurrentLevel;
    const xpToNextLevelBracket = totalXpForNextLevel - totalXpForCurrentLevel;

    // Add calculated XP values to the character data being returned
    const characterDataForPayload = {
        ...character,
        currentLevelXp: currentLevelXp,
        xpToNextLevelBracket: xpToNextLevelBracket
    };

    console.log(`CharacterService: User ${user.username} (ID: ${userId}) selected character ${character.name} (ID: ${characterId}).`);

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
async function deleteCharacter(userId: string, characterId: string): Promise<void> {
    const character = await CharacterRepository.findById(characterId);
    const user = await UserRepository.findById(userId); // Fetch user to verify ownership

    if (!character || !user || character.userId !== userId || !user.characterIds.includes(characterId)) {
        throw new Error('Character not found or does not belong to user');
    }

    try {
        // 1. Delete the character document
        const deleted = await CharacterRepository.deleteById(characterId);
        if (!deleted) {
            // Should not happen if validation passed, but handle defensively
            throw new Error(`Failed to delete character document ${characterId}`);
        }

        // 2. Remove character ID from user's list
        const updated = await UserRepository.updateCharacterList(userId, characterId, 'remove');
        if (!updated) {
            // Log inconsistency but don't throw - character is gone.
            console.warn(`CharacterService: Character ${characterId} deleted, but failed to remove ID from user ${userId}'s list.`);
        }

        console.log(`CharacterService: Deleted character ${character.name} (ID: ${characterId}) for user ${user.username} (ID: ${userId}).`);

    } catch (error) {
        console.error("CharacterService: Error during character deletion:", error);
        throw error; // Re-throw error
    }
}

/**
 * Adds experience to a character, handles level ups, and returns the updated state.
 * NOTE: This function MODIFIES the passed character object directly.
 * @param character The character object (will be modified).
 * @param xpGained The amount of XP gained.
 * @returns An object indicating if level up occurred and any stat increases.
 */
function addExperience(character: Character, xpGained: number): { leveledUp: boolean, statIncreases: any } {
    if (xpGained <= 0) {
        return { leveledUp: false, statIncreases: {} };
    }

    character.experience = (character.experience ?? 0) + xpGained;
    console.log(`CharacterService: ${character.name} gained ${xpGained} XP. Total XP: ${character.experience}.`);

    let leveledUp = false;
    // Initialize with expected structure to satisfy TypeScript
    let statIncreases: { strength?: number; dexterity?: number; vitality?: number; energy?: number } = {};

    // Use xpRequiredForLevel which calculates the total XP needed for the *next* level
    while (character.experience >= xpRequiredForLevel(character.level)) {
        leveledUp = true;
        const oldLevel = character.level;
        character.level++; // Increment level
        console.log(`CharacterService: Level Up! ${character.name} reached level ${character.level}.`);

        // --- Apply Stat Increases (Example: +1 to all) ---
        if (!character.stats) character.stats = { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
        const increaseAmount = 1; // Define increase per level
        character.stats.strength = (character.stats.strength ?? 0) + increaseAmount;
        character.stats.dexterity = (character.stats.dexterity ?? 0) + increaseAmount;
        character.stats.vitality = (character.stats.vitality ?? 0) + increaseAmount;
        character.stats.energy = (character.stats.energy ?? 0) + increaseAmount;

        // Accumulate stat increases for the payload
        statIncreases = {
            strength: (statIncreases.strength ?? 0) + increaseAmount,
            dexterity: (statIncreases.dexterity ?? 0) + increaseAmount,
            vitality: (statIncreases.vitality ?? 0) + increaseAmount,
            energy: (statIncreases.energy ?? 0) + increaseAmount,
        };
        console.log(`CharacterService: Stats increased: +${increaseAmount} to all.`);

        // Recalculate Max HP/Mana based on new stats
        character.maxHp = calculateMaxHp(character.stats);
        character.maxMana = calculateMaxMana(character.stats); // Also update mana if applicable
        // Restore HP/Mana to full on level up
        character.currentHp = character.maxHp;
        character.currentMana = character.maxMana;
        console.log(`CharacterService: Max HP/Mana updated to ${character.maxHp}/${character.maxMana}. HP/Mana restored.`);
    }

    return { leveledUp, statIncreases };
}


// Export the service functions
export const CharacterService = {
    createCharacter,
    selectCharacter,
    deleteCharacter,
    addExperience
};
