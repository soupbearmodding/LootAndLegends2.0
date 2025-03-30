import { Character, Monster, Zone, CharacterClass } from './types.js';

// --- Combat Calculation Helpers (Very Basic) ---
export function calculateMaxHp(stats: Character['stats']): number {
    // Example: Base HP + HP per vitality point
    return 50 + (stats.vitality * 5);
}

// Calculate max mana based on energy
export function calculateMaxMana(stats: Character['stats']): number {
    // Example: Base Mana + Mana per energy point
    return 20 + (stats.energy * 2);
}

/**
 * Calculates the total XP required to reach a given level.
 * Using a simple exponential curve: 100 * (level-1)^1.5
 * Level 2: 100 XP
 * Level 3: ~283 XP
 * Level 4: ~520 XP
 * Level 5: ~800 XP
 * ...
 * @param level The target level.
 * @returns The total XP required.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }
  // Ensure level is at least 2 for the calculation base
  const baseLevel = Math.max(2, level);
  return Math.floor(100 * Math.pow(baseLevel - 1, 1.5));
}

/**
 * Calculates the amount of XP required to advance *through* a given level.
 * e.g., xpRequiredForLevel(5) returns the XP needed to go from level 5 to level 6.
 * @param level The current level.
 * @returns The XP needed to reach the next level from the start of the current level.
 */
export function xpRequiredForLevel(level: number): number {
    if (level < 1) return 0; // Or handle as error
    const xpForNext = xpForLevel(level + 1);
    const xpForCurrent = xpForLevel(level);
    return xpForNext - xpForCurrent;
}


// --- Game Data ---
export const monsters: Map<string, Monster> = new Map([
    // Town Monsters (example)
    ['rat1', { id: 'rat1', name: 'Giant Rat', level: 1, stats: { strength: 5, dexterity: 8, vitality: 10 }, maxHp: 20, currentHp: 20, baseDamage: 1, attackSpeed: 1500, lootTableId: 'low_level_common' }],
    ['goblin1', { id: 'goblin1', name: 'Goblin Scout', level: 2, stats: { strength: 8, dexterity: 10, vitality: 15 }, maxHp: 30, currentHp: 30, baseDamage: 2, attackSpeed: 2000, lootTableId: 'low_level_common' }],
    // Crimson Fen Monsters (example)
    ['swamp_leech', { id: 'swamp_leech', name: 'Swamp Leech', level: 5, stats: { strength: 6, dexterity: 5, vitality: 25 }, maxHp: 50, currentHp: 50, baseDamage: 3, attackSpeed: 2500, lootTableId: 'mid_level_common' }],
    ['fen_lurker', { id: 'fen_lurker', name: 'Fen Lurker', level: 6, stats: { strength: 12, dexterity: 8, vitality: 30 }, maxHp: 65, currentHp: 65, baseDamage: 4, attackSpeed: 2200, lootTableId: 'mid_level_common' }],
]);

// Define connections and monsters for zones
export const zones: Map<string, Zone> = new Map([
    ['town', { id: 'town', name: 'Town', description: 'A relatively safe starting area.', requiredLevel: 1, connectedZoneIds: ['crimson_fen', 'stonebound_field', 'whispering_woods'], monsterIds: [] }], // No monsters in town
    ['whispering_woods', { id: 'whispering_woods', name: 'Whispering Woods', description: 'A quiet forest near the town.', requiredLevel: 1, connectedZoneIds: ['town', 'stonebound_field'], monsterIds: ['rat1'] }], // Connects TO Stonebound
    ['stonebound_field', { id: 'stonebound_field', name: 'Stonebound Field', description: 'Rocky fields.', requiredLevel: 3, connectedZoneIds: ['town', 'whispering_woods', 'crimson_fen', 'icy_flats'], monsterIds: ['goblin1', 'rat1'] }],
    ['crimson_fen', { id: 'crimson_fen', name: 'Crimson Fen', description: 'A murky swamp.', requiredLevel: 5, connectedZoneIds: ['town', 'stonebound_field', 'shadow_swamp'], monsterIds: ['swamp_leech', 'fen_lurker'] }],
    ['shadow_swamp', { id: 'shadow_swamp', name: 'Shadow Swamp', description: 'A darker, more dangerous swamp.', requiredLevel: 8, connectedZoneIds: ['crimson_fen'], monsterIds: ['fen_lurker'] }],
    ['icy_flats', { id: 'icy_flats', name: 'Icy Flats', description: 'A frozen wasteland.', requiredLevel: 10, connectedZoneIds: ['stonebound_field', 'windswept_highland'], monsterIds: [] }],
    ['windswept_highland', { id: 'windswept_highland', name: 'Windswept Highland', description: 'High altitude plains.', requiredLevel: 12, connectedZoneIds: ['icy_flats'], monsterIds: [] }],
]);

export const characterClasses: Map<string, CharacterClass> = new Map([
    ['warrior', { name: 'Warrior', description: 'Master of weapons and close combat', baseStats: { strength: 30, dexterity: 20, vitality: 25, energy: 10 } }],
    ['rogue', { name: 'Rogue', description: 'Master of ranged combat and traps', baseStats: { strength: 20, dexterity: 30, vitality: 20, energy: 15 } }],
    ['sorcerer', { name: 'Sorcerer', description: 'Master of elemental magic', baseStats: { strength: 15, dexterity: 15, vitality: 20, energy: 35 } }],
    ['monk', { name: 'Monk', description: 'Master of martial arts and holy magic', baseStats: { strength: 25, dexterity: 25, vitality: 20, energy: 15 } }],
    ['barbarian', { name: 'Barbarian', description: 'Master of melee combat and battle cries', baseStats: { strength: 40, dexterity: 20, vitality: 25, energy: 0 } }],
]);

import { ItemQuality } from './types.js';

// --- Item Quality Weights ---
// Define the probability distribution for item qualities.
// Weights don't have to sum to 1, they represent relative chances.
export const qualityWeights: { quality: ItemQuality; weight: number }[] = [
    { quality: 'Gray', weight: 25 },
    { quality: 'White', weight: 40 },
    { quality: 'Green', weight: 20 },
    { quality: 'Blue', weight: 10 },
    { quality: 'Purple', weight: 4 },
    { quality: 'Red', weight: 1 },
];

// Loot Tables - Define potential drops for monsters
// Note: baseId now refers to keys in server/src/lootData.ts
interface LootTableEntry {
    baseId: string; // ID from baseItems
    chance: number; // Probability (e.g., 0.5 for 50%)
    minQuantity?: number;
    maxQuantity?: number;
}

export const lootTables: Map<string, LootTableEntry[]> = new Map([
    // Example: Low-level monsters (rats, goblins)
    // --- Loot Tables ---
    // More granular tables, can be combined or assigned based on monster level/type
    ['junk', [ // Very low chance of anything useful
        { baseId: 'gold_coins', chance: 0.5, minQuantity: 1, maxQuantity: 5 },
        { baseId: 'rusty_dagger', chance: 0.02 },
        { baseId: 'club', chance: 0.02 },
        { baseId: 'sash', chance: 0.01 },
    ]],
    ['low_level_common', [ // Level 1-5 monsters
        { baseId: 'gold_coins', chance: 0.8, minQuantity: 1, maxQuantity: 10 },
        { baseId: 'minor_health_potion', chance: 0.3 },
        { baseId: 'rusty_dagger', chance: 0.08 },
        { baseId: 'club', chance: 0.08 },
        { baseId: 'short_sword', chance: 0.05 },
        { baseId: 'hand_axe', chance: 0.05 },
        { baseId: 'short_bow', chance: 0.04 },
        { baseId: 'short_staff', chance: 0.04 },
        { baseId: 'leather_cap', chance: 0.06 },
        { baseId: 'quilted_armor', chance: 0.05 },
        { baseId: 'leather_gloves', chance: 0.05 },
        { baseId: 'leather_boots', chance: 0.05 },
        { baseId: 'sash', chance: 0.04 },
        { baseId: 'buckler', chance: 0.03 },
    ]],
    ['mid_level_common', [ // Level 6-10 monsters
        { baseId: 'gold_coins', chance: 0.9, minQuantity: 5, maxQuantity: 25 },
        { baseId: 'minor_health_potion', chance: 0.5 }, 
        // Increased chance for better base types
        { baseId: 'dagger', chance: 0.08 },
        { baseId: 'scimitar', chance: 0.06 },
        { baseId: 'long_sword', chance: 0.04 },
        { baseId: 'spiked_club', chance: 0.07 },
        { baseId: 'hand_axe', chance: 0.06 },
        { baseId: 'short_bow', chance: 0.05 },
        { baseId: 'short_staff', chance: 0.05 },
        { baseId: 'skull_cap', chance: 0.07 },
        { baseId: 'leather_armor', chance: 0.06 },
        { baseId: 'leather_gloves', chance: 0.06 },
        { baseId: 'leather_boots', chance: 0.06 },
        { baseId: 'sash', chance: 0.05 },
        { baseId: 'buckler', chance: 0.04 },
    ]],
]);
