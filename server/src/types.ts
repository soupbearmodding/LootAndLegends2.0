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
    currentZoneId: string;
    zoneKills: Record<string, number>; // Tracks kills per zone ID
    inventory: Item[]; // Array to hold items in the character's inventory
    equipment: EquipmentSlots; // Object mapping equipment slots to equipped items
    // Add other character details: skills, position, etc.
}

// --- Equipment ---
export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'feet' | 'mainHand' | 'offHand' | 'ring1' | 'ring2' | 'amulet';

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
    killsToUnlock?: number; // Kills needed in the *previous* zone to unlock this one
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
    stats?: Partial<Character['stats']>; // Stats the item provides (using Partial for flexibility)
    quantity?: number; // For stackable items like potions
    // Add more properties: requirements, rarity, stackable, etc.
}

// Type for the map storing active WebSocket connections and their associated user/character info
export type ActiveConnectionsMap = Map<WebSocket, { userId: string; selectedCharacterId?: string }>;

// Type for the map storing active combat encounters
export type ActiveEncountersMap = Map<WebSocket, Monster>;

// Type for the map storing combat loop intervals
export type CombatIntervalsMap = Map<WebSocket, NodeJS.Timeout>;
