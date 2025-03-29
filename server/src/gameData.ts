import { Character, Monster, Zone, CharacterClass, Item } from './types.js'; // Import Item

// --- Combat Calculation Helpers (Very Basic) ---
export function calculateMaxHp(stats: Character['stats']): number {
    // Example: Base HP + HP per vitality point
    return 50 + (stats.vitality * 5);
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

// --- Game Data ---
export const monsters: Map<string, Monster> = new Map([
    // Town Monsters (example)
    ['rat1', { id: 'rat1', name: 'Giant Rat', level: 1, stats: { strength: 5, dexterity: 8, vitality: 10 }, maxHp: 20, currentHp: 20, baseDamage: 1, lootTableId: 'low_level_common' }],
    ['goblin1', { id: 'goblin1', name: 'Goblin Scout', level: 2, stats: { strength: 8, dexterity: 10, vitality: 15 }, maxHp: 30, currentHp: 30, baseDamage: 2, lootTableId: 'low_level_common' }],
    // Crimson Fen Monsters (example)
    ['swamp_leech', { id: 'swamp_leech', name: 'Swamp Leech', level: 5, stats: { strength: 6, dexterity: 5, vitality: 25 }, maxHp: 50, currentHp: 50, baseDamage: 3, lootTableId: 'mid_level_common' }],
    ['fen_lurker', { id: 'fen_lurker', name: 'Fen Lurker', level: 6, stats: { strength: 12, dexterity: 8, vitality: 30 }, maxHp: 65, currentHp: 65, baseDamage: 4, lootTableId: 'mid_level_common' }],
]);

// Define connections and monsters for zones
export const zones: Map<string, Zone> = new Map([
    ['town', { id: 'town', name: 'Town', description: 'A relatively safe starting area.', requiredLevel: 1, connectedZoneIds: ['crimson_fen', 'stonebound_field', 'whispering_woods'], monsterIds: [] }], // No monsters in town
    ['whispering_woods', { id: 'whispering_woods', name: 'Whispering Woods', description: 'A quiet forest near the town.', requiredLevel: 1, connectedZoneIds: ['town'], monsterIds: ['rat1'] }],
    ['crimson_fen', { id: 'crimson_fen', name: 'Crimson Fen', description: 'A murky swamp.', requiredLevel: 5, connectedZoneIds: ['town', 'shadow_swamp'], monsterIds: ['swamp_leech', 'fen_lurker'] }],
    ['icy_flats', { id: 'icy_flats', name: 'Icy Flats', description: 'A frozen wasteland.', requiredLevel: 10, connectedZoneIds: ['stonebound_field', 'windswept_highland'], monsterIds: [], killsToUnlock: 20 }], // Requires 20 kills in Stonebound Field
    ['stonebound_field', { id: 'stonebound_field', name: 'Stonebound Field', description: 'Rocky fields.', requiredLevel: 3, connectedZoneIds: ['town', 'icy_flats'], monsterIds: ['goblin1', 'rat1'] }], // Example reuse
    ['shadow_swamp', { id: 'shadow_swamp', name: 'Shadow Swamp', description: 'A darker, more dangerous swamp.', requiredLevel: 8, connectedZoneIds: ['crimson_fen'], monsterIds: ['fen_lurker'], killsToUnlock: 20 }], // Requires 20 kills in Crimson Fen
    ['windswept_highland', { id: 'windswept_highland', name: 'Windswept Highland', description: 'High altitude plains.', requiredLevel: 12, connectedZoneIds: ['icy_flats'], monsterIds: [], killsToUnlock: 20 }], // Requires 20 kills in Icy Flats
]);

export const characterClasses: Map<string, CharacterClass> = new Map([
    ['warrior', { name: 'Warrior', description: 'Master of weapons and close combat', baseStats: { strength: 30, dexterity: 20, vitality: 25, energy: 10 } }],
    ['rogue', { name: 'Rogue', description: 'Master of ranged combat and traps', baseStats: { strength: 20, dexterity: 30, vitality: 20, energy: 15 } }],
    ['sorcerer', { name: 'Sorcerer', description: 'Master of elemental magic', baseStats: { strength: 15, dexterity: 15, vitality: 20, energy: 35 } }],
    ['monk', { name: 'Monk', description: 'Master of martial arts and holy magic', baseStats: { strength: 25, dexterity: 25, vitality: 20, energy: 15 } }],
    ['barbarian', { name: 'Barbarian', description: 'Master of melee combat and battle cries', baseStats: { strength: 40, dexterity: 20, vitality: 25, energy: 0 } }],
]);

// --- Item Data ---
// Base definitions for items
export const baseItems: Map<string, Omit<Item, 'id'>> = new Map([
    // Potions
    ['minor_health_potion', { baseId: 'minor_health_potion', name: 'Minor Health Potion', type: 'potion', description: 'Restores a small amount of health.', quantity: 1 }],
    // Weapons (very basic)
    ['rusty_dagger', { baseId: 'rusty_dagger', name: 'Rusty Dagger', type: 'weapon', description: 'A simple, worn dagger.', equipmentSlot: 'mainHand', stats: { dexterity: 1 } }],
    ['short_sword', { baseId: 'short_sword', name: 'Short Sword', type: 'weapon', description: 'A basic short sword.', equipmentSlot: 'mainHand', stats: { strength: 1, dexterity: 1 } }],
    // Armor (very basic)
    ['leather_cap', { baseId: 'leather_cap', name: 'Leather Cap', type: 'armor', description: 'A simple cap made of hardened leather.', equipmentSlot: 'head', stats: { vitality: 1 } }],
    // Misc
    ['gold_coins', { baseId: 'gold_coins', name: 'Gold Coins', type: 'misc', description: 'The currency of the realm.', quantity: 1 }], // Quantity will be randomized on drop
]);

// Loot Tables - Define potential drops for monsters
interface LootTableEntry {
    baseId: string; // ID from baseItems
    chance: number; // Probability (e.g., 0.5 for 50%)
    minQuantity?: number;
    maxQuantity?: number;
}

export const lootTables: Map<string, LootTableEntry[]> = new Map([
    // Example: Low-level monsters (rats, goblins)
    ['low_level_common', [
        { baseId: 'gold_coins', chance: 0.8, minQuantity: 1, maxQuantity: 10 }, // 80% chance for gold
        { baseId: 'minor_health_potion', chance: 0.3 }, // 30% chance for potion
        { baseId: 'rusty_dagger', chance: 0.1 }, // 10% chance for dagger
        { baseId: 'leather_cap', chance: 0.05 }, // 5% chance for cap
    ]],
    // Example: Slightly higher level (swamp monsters)
    ['mid_level_common', [
        { baseId: 'gold_coins', chance: 0.9, minQuantity: 5, maxQuantity: 25 },
        { baseId: 'minor_health_potion', chance: 0.5 },
        { baseId: 'short_sword', chance: 0.15 },
        { baseId: 'leather_cap', chance: 0.1 },
    ]],
    // Add more tables for different monster types/levels/difficulties
]);
