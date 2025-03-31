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

// Specific payload types for validation
export interface RegisterPayload extends UserCredentials {
    // Inherits username and password
}

export interface LoginPayload extends UserCredentials {
    // Inherits username and password
}

export interface User {
    id: string;
    username: string;
    passwordHash: string;
    characterIds: string[];
}

export interface CharacterClass {
    name: string;
    description: string;
    baseStats: {
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
    class: string;
    level: number;
    experience: number;
    stats: {
        strength: number;
        dexterity: number;
        vitality: number;
        energy: number;
    };
    currentHp: number;
    maxHp: number;
    currentMana: number;
    maxMana: number;
    currentZoneId: string;
    inventory: Item[];
    equipment: EquipmentSlots;
    groundLoot: Item[];
    gold: number;
    potionSlot1?: string;
    potionSlot2?: string;
}

// Explicit type for stats that can appear on items
export interface ItemStats {
    strength?: number; dexterity?: number; vitality?: number; energy?: number;
    fireRes?: number; coldRes?: number; lightningRes?: number; poisonRes?: number;
    maxHp?: number; maxMana?: number; attackRating?: number;
    increasedAttackSpeed?: number;
    fasterHitRecovery?: number;
    magicFind?: number;
    goldFind?: number;
    lifeStealPercent?: number;
    manaStealPercent?: number;
    defenseBonusPercent?: number;
    attackSpeed?: number; // Base attack speed (ms), primarily for weapons
}


// --- Equipment ---
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
}

// --- Item System (Basic) ---
export interface Item {
    id: string; // Unique instance ID for this specific item
    baseId: string; // Identifier for the base item type (e.g., 'short_sword', 'health_potion')
    name: string; // Display name (could be modified by prefixes/suffixes later)
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    equipmentSlot?: EquipmentSlot;
    stats?: Partial<ItemStats>;
    quantity?: number; // For stackable items like potions
    quality: ItemQuality;
    prefixes: Affix[];
    suffixes: Affix[];
    rarity?: 'common' | 'magic' | 'rare' | 'unique' | 'legendary';
}

// --- Item Quality ---
export type ItemQuality = 'Gray' | 'White' | 'Green' | 'Blue' | 'Purple' | 'Red';

// --- Item Affixes ---
export interface Affix {
    id: string; // Unique ID for the affix definition (e.g., 'str_1', 'fire_res_t1')
    name: string; // Display name (e.g., "of Strength", "Fiery")
    type: 'prefix' | 'suffix';
    statModifiers?: Partial<ItemStats>;
}

// Type for the value stored in the activeConnections map
export interface ConnectionData {
    userId: string;
    username: string; // Added username based on usage in authHandler
    selectedCharacterId: string | null; // Explicitly allow null
}

// Type for the map storing active WebSocket connections and their associated user/character info
export type ActiveConnectionsMap = Map<WebSocket, ConnectionData>;

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
export interface PlayerAttackUpdatePayload {
    playerDamageDealt: number;
    monsterUpdate: { currentHp: number };
}

export interface MonsterAttackUpdatePayload {
    monsterDamageTaken: number;
    characterUpdate: { currentHp: number };
}
