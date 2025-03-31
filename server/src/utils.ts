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
import { Character, Item, EquipmentSlot, ItemStats } from './types.js'; // Import ItemStats directly

/**
 * Calculates the character's final stats including equipment bonuses.
 * Also recalculates derived stats like max HP.
 * @param character The character object with base stats and equipment.
 * @returns A new character object with updated stats and derived values.
 */
export function calculateCharacterStats(character: Character): Character {
    // Start with base stats defined on the character document
    const baseStats = { ...character.stats };
    // Use the imported ItemStats interface which includes all potential stats
    const finalStats: Partial<ItemStats> = { ...baseStats }; // Use Partial as not all stats might exist initially
    let totalFlatDefense = 0;
    let totalDefenseBonusPercent = 0;

    // Add stats from equipment
    for (const slotKey in character.equipment) {
        const slot = slotKey as EquipmentSlot;
        const item = character.equipment[slot];

        // Add flat defense from base item definition (if it exists)
        // Need to import baseItems from lootData for this
        // Let's assume baseItems is imported as 'itemDefinitions' like in inventoryService
        // const baseItemDef = item ? itemDefinitions.get(item.baseId) : undefined;
        // if (baseItemDef?.defense) {
        //     totalFlatDefense += baseItemDef.defense;
        // }
        // NOTE: The above requires importing itemDefinitions. A simpler approach for now
        // is to assume flat defense is part of the item.stats object if needed.
        // Let's add 'defense' to ItemStats and sum it here.

        if (item?.stats) {
            // Iterate over the keys of the item's stats object
            for (const statKey in item.stats) {
                // Ensure the key is a valid key of ItemStats
                const stat = statKey as keyof ItemStats;
                const value = item.stats[stat] ?? 0; // Get the value, default to 0

                if (stat === 'defense') {
                    totalFlatDefense += value;
                } else if (stat === 'defenseBonusPercent') {
                    totalDefenseBonusPercent += value;
                } else if (stat in finalStats) { // Check if it's one of the base stats (str, dex, vit, enr)
                    // Use type assertion here as we've checked `stat in finalStats`
                    (finalStats as any)[stat] = ((finalStats as any)[stat] || 0) + value;
                } else {
                    // Handle other potential stats from ItemStats if needed (e.g., resistances)
                    // For now, we only explicitly add base stats, defense, and defenseBonusPercent
                    // We could add other stats to finalStats if required:
                    // finalStats[stat] = (finalStats[stat] || 0) + value;
                }
            }
        }
    }

    // --- Sanity Check Stats (Ensure non-negative) ---
    (Object.keys(finalStats) as Array<keyof ItemStats>).forEach(statKey => {
        // Use nullish coalescing to handle potentially undefined stats
        if ((finalStats[statKey] ?? 0) < 0) {
            console.warn(`Character ${character.id}: Calculated stat ${statKey} was negative (${finalStats[statKey]}). Clamping to 0.`);
            finalStats[statKey] = 0; // Clamp to 0
        }
    });

    // --- Calculate Derived Stats ---
    // Example: Base defense from Dexterity? (Common in ARPGs)
    const baseDefenseFromStats = Math.floor((finalStats.dexterity ?? 0) / 4); // Use nullish coalescing
    totalFlatDefense += baseDefenseFromStats;

    // Apply percentage bonus
    let calculatedDefense = Math.floor(totalFlatDefense * (1 + totalDefenseBonusPercent)); // Use let

    let calculatedMaxHp = 50 + (finalStats.vitality ?? 0) * 5; // Example formula, use nullish coalescing

    // --- Sanity Check Derived Stats ---
    if (calculatedDefense < 0) {
        console.warn(`Character ${character.id}: Calculated defense was negative (${calculatedDefense}). Clamping to 0.`);
        calculatedDefense = 0;
    }
    if (calculatedMaxHp < 1) {
        console.warn(`Character ${character.id}: Calculated maxHp was less than 1 (${calculatedMaxHp}). Clamping to 1.`);
        calculatedMaxHp = 1;
    }

    // Ensure currentHp is valid and doesn't exceed new maxHp
    const finalCurrentHp = Math.max(0, Math.min(character.currentHp, calculatedMaxHp));

    // Return a *new* character object with the calculated final stats and derived stats
    // Ensure all original character properties are preserved
    // Ensure the 'stats' object conforms to the required Character['stats'] type
    const finalCharacterStats: Character['stats'] = {
        strength: finalStats.strength ?? 0,
        dexterity: finalStats.dexterity ?? 0,
        vitality: finalStats.vitality ?? 0,
        energy: finalStats.energy ?? 0,
    };

    const updatedCharacter: Character = {
        ...character, // Spread original character data first
        stats: finalCharacterStats, // Assign the correctly typed stats object
        maxHp: calculatedMaxHp, // Overwrite with calculated max HP
        defense: calculatedDefense, // Add calculated defense
        currentHp: finalCurrentHp, // Overwrite with validated current HP
        // Note: Other potential stats from ItemStats (like resistances) are not explicitly added
        // back to the Character object here unless the Character type is updated to include them.
    };

    return updatedCharacter;
}
