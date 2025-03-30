import WebSocket from 'ws';
import { WebSocketMessage } from './types.js';

/**
 * Safely sends a JSON message to a WebSocket client, handling potential errors.
 * @param ws The WebSocket client connection.
 * @param message The message object to send.
 */
export function safeSend(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState !== WebSocket.OPEN) {
        console.error("Attempted to send message to a non-open WebSocket.");
        return; // Don't attempt to send if the socket isn't open
    }
    try {
        ws.send(JSON.stringify(message));
    } catch (error) {
        console.error("Failed to send message:", error);
        // Optionally, you might want to close the connection here if sending fails repeatedly
    }
}

/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- Character Stat Calculation ---
// Import necessary types, getting ItemStats from Character
import { Character, Item, EquipmentSlot } from './types.js';
type ItemStats = Character['stats']; // Use the stats type from Character

/**
 * Calculates the character's final stats including equipment bonuses.
 * Also recalculates derived stats like max HP.
 * @param character The character object with base stats and equipment.
 * @returns A new character object with updated stats and derived values.
 */
export function calculateCharacterStats(character: Character): Character {
    // Start with base stats defined on the character document
    const baseStats = { ...character.stats };
    const finalStats: ItemStats = { ...baseStats }; // Initialize final stats with base

    // Add stats from equipment
    for (const slotKey in character.equipment) {
        const slot = slotKey as EquipmentSlot;
        const item = character.equipment[slot];
        if (item?.stats) {
            for (const statKey in item.stats) {
                // Ensure statKey is treated as a key of ItemStats
                const stat = statKey as keyof ItemStats;
                if (stat in finalStats) { // Check if the stat exists on finalStats
                    finalStats[stat] = (finalStats[stat] || 0) + (item.stats[stat] || 0);
                }
            }
        }
    }

    // --- Sanity Check Stats (Ensure non-negative) ---
    (Object.keys(finalStats) as Array<keyof ItemStats>).forEach(statKey => {
        if (finalStats[statKey] < 0) {
            console.warn(`Character ${character.id}: Calculated stat ${statKey} was negative (${finalStats[statKey]}). Clamping to 0.`);
            finalStats[statKey] = 0;
        }
    });

    // --- Calculate Derived Stats ---
    // Example: Max HP based on Vitality (adjust formula as needed)
    let calculatedMaxHp = 50 + (finalStats.vitality || 0) * 5; // Example formula

    // --- Sanity Check Derived Stats ---
    if (calculatedMaxHp < 1) {
        console.warn(`Character ${character.id}: Calculated maxHp was less than 1 (${calculatedMaxHp}). Clamping to 1.`);
        calculatedMaxHp = 1;
    }
    // TODO: Add sanity checks for other derived stats (e.g., max resource, damage, defense)

    // Ensure currentHp is valid and doesn't exceed new maxHp
    const finalCurrentHp = Math.max(0, Math.min(character.currentHp, calculatedMaxHp));

    // Return a *new* character object with the calculated final stats and derived stats
    // Ensure all original character properties are preserved
    const updatedCharacter: Character = {
        ...character, // Spread original character data first
        stats: finalStats, // Overwrite with calculated final stats
        maxHp: calculatedMaxHp, // Overwrite with calculated max HP
        currentHp: finalCurrentHp, // Overwrite with validated current HP
        // TODO: Add other calculated derived stats here
    };

    // console.log(`Calculated stats for ${character.name}:`, updatedCharacter.stats, `MaxHP: ${updatedCharacter.maxHp}`); // Optional debug log
    return updatedCharacter;
}
