import WebSocket from 'ws';

// --- Interfaces ---
export interface WebSocketMessage {
    type: string;
    payload: any;
}

export interface UserCredentials {
    username: string;
    password: string;
}

export interface User {
    id: string;
    username: string;
    passwordHash: string;
    characterIds: string[];
}

export interface CharacterClass {
    name: string;
    description: string; // Added description back
    baseStats: { // Renamed back to baseStats
        strength: number;
        dexterity: number;
        vitality: number;
        energy: number;
    };
}

export interface Character {
    id: string;
    userId: string;
    name: string;
    class: string; // Changed back to string identifier
    level: number; // Added level
    experience: number; // Added experience
    stats: {
        strength: number;
        dexterity: number;
        vitality: number;
        energy: number;
    };
    currentHp: number;
    maxHp: number;
    currentMana: number; // Added currentMana
    maxMana: number; // Added maxMana
    currentZoneId: string;
    // zoneKills: Record<string, number>; // Removed kill tracking
    inventory: Item[]; // Array to hold items in the character's inventory
    equipment: EquipmentSlots; // Object mapping equipment slots to equipped items
    groundLoot: Item[]; // Array to hold the last N items dropped on the ground near the player
    gold: number; // Currency
    potionSlot1?: string; // baseId of the potion in slot 1
    potionSlot2?: string; // baseId of the potion in slot 2
    // Add other character details: skills, position, etc.
}

// Explicit type for stats that can appear on items (subset of Character stats + potentially others)
// Using Partial<Character['stats']> is often sufficient, but an explicit type can be clearer.
// Let's define it based on what InventoryPanel seems to use/need.
export interface ItemStats {
    strength?: number; dexterity?: number; vitality?: number; energy?: number;
    fireRes?: number; coldRes?: number; lightningRes?: number; poisonRes?: number;
    maxHp?: number; maxMana?: number; attackRating?: number;
    // Add other potential item-specific stats here if they differ from Character['stats']
    increasedAttackSpeed?: number; // Example from Item interface
    fasterHitRecovery?: number; // Example
    magicFind?: number; // Example
    goldFind?: number; // Example
    lifeStealPercent?: number; // Example
    manaStealPercent?: number; // Example
    defenseBonusPercent?: number; // Example
    // addedDamage?: any; // Avoid 'any' if possible
    attackSpeed?: number; // Base attack speed (ms), primarily for weapons
}


// --- Equipment ---
// Added 'hands' and 'waist', removed 'legs'
export type EquipmentSlot = 'head' | 'chest' | 'waist' | 'hands' | 'feet' | 'mainHand' | 'offHand' | 'ring1' | 'ring2' | 'amulet';

export type EquipmentSlots = {
    [key in EquipmentSlot]?: Item; // Optional because a slot might be empty
};

export interface Zone {
    id: string;
    name: string;
    description: string;
    requiredLevel: number;
    connectedZoneIds: string[];
    monsterIds: string[];
    // killsToUnlock?: number; // Removed kill requirement
    // unlockedByZoneId?: string; // Removed kill requirement prerequisite
    // Add other zone properties: NPCs, etc.
}

export interface Monster {
    id: string;
    name: string;
    level: number;
    stats: {
        strength: number;
        dexterity: number;
        vitality: number;
    };
    currentHp: number;
    maxHp: number;
    baseDamage: number;
    attackSpeed: number; // Time in milliseconds between attacks
    lootTableId?: string; // Optional: ID linking to a loot table in gameData
    // Add more monster properties: abilities, resistances, etc.
}

// --- Item System (Basic) ---
export interface Item {
    id: string; // Unique instance ID for this specific item
    baseId: string; // Identifier for the base item type (e.g., 'short_sword', 'health_potion')
    name: string; // Display name (could be modified by prefixes/suffixes later)
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string; // Detailed description for tooltips
    equipmentSlot?: EquipmentSlot; // Which slot the item goes into, if equippable
    stats?: Partial<ItemStats>; // Use the explicit ItemStats type
    // attackSpeed?: number; // Included in ItemStats now
    quantity?: number; // For stackable items like potions
    quality: ItemQuality; // Added quality
    prefixes: Affix[]; // Added prefixes
    suffixes: Affix[]; // Added suffixes
    rarity?: 'common' | 'magic' | 'rare' | 'unique' | 'legendary'; // Added rarity for client display mapping
    // Add more properties: requirements, stackable, etc.
}

// --- Item Quality ---
export type ItemQuality = 'Gray' | 'White' | 'Green' | 'Blue' | 'Purple' | 'Red';

// --- Item Affixes ---
export interface Affix {
    id: string; // Unique ID for the affix definition (e.g., 'str_1', 'fire_res_t1')
    name: string; // Display name (e.g., "of Strength", "Fiery")
    type: 'prefix' | 'suffix';
    // Define how the affix modifies stats or adds effects
    // This could be a simple stat bonus, a special effect trigger, etc.
    // Example:
    statModifiers?: Partial<ItemStats>; // Use ItemStats here too
    // increasedAttackSpeed?: number; // Included in ItemStats now
    // Add other potential effects: damage bonuses, resistances, skill bonuses, etc.
    // Example for rolled values:
    // statRolls?: { stat: keyof Character['stats']; min: number; max: number }[];
    // For now, keeping it simple with direct modifiers
}


// Type for the map storing active WebSocket connections and their associated user/character info
export type ActiveConnectionsMap = Map<WebSocket, { userId: string; selectedCharacterId?: string }>;

// Type for the map storing active combat encounters
export type ActiveEncountersMap = Map<WebSocket, Monster>;

// Types for the maps storing separate combat loop intervals
export type PlayerAttackIntervalsMap = Map<WebSocket, NodeJS.Timeout>;
export type MonsterAttackIntervalsMap = Map<WebSocket, NodeJS.Timeout>;

// --- Rate Limiting Type ---
export interface RateLimitInfo {
    count: number;
    windowStart: number;
}

// --- WebSocket Message Types (Examples for Combat) ---
// Consider a more generic 'combat_action' type later if needed
export interface PlayerAttackUpdatePayload {
    playerDamageDealt: number;
    monsterUpdate: { currentHp: number };
}

export interface MonsterAttackUpdatePayload {
    monsterDamageTaken: number;
    characterUpdate: { currentHp: number };
}
