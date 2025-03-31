// Shared types copied from server/src/types.ts to satisfy client's rootDir constraint

// --- Equipment ---
export type EquipmentSlot = 'head' | 'chest' | 'waist' | 'hands' | 'feet' | 'mainHand' | 'offHand' | 'ring1' | 'ring2' | 'amulet';

// --- Item Stats ---
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

// --- Item Affixes (Copied from server) ---
export interface Affix {
    id: string;
    name: string;
    type: 'prefix' | 'suffix';
    statModifiers?: Partial<ItemStats>;
    // Add other potential affix properties if needed by client (e.g., levelReq?)
}

// --- Item Quality (Copied from server) ---
export type ItemQuality = 'Gray' | 'White' | 'Green' | 'Blue' | 'Purple' | 'Red';


// --- Item (Basic structure needed for components) ---
export interface Item {
    id: string;
    baseId: string;
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    equipmentSlot?: EquipmentSlot;
    stats?: Partial<ItemStats>;
    quantity?: number;
    quality: ItemQuality; // Added quality
    prefixes: Affix[]; // Added prefixes
    suffixes: Affix[]; // Added suffixes
    rarity?: 'common' | 'magic' | 'rare' | 'unique' | 'legendary';
    upgradeCount?: number; // Added for upgrade system
    maxUpgrades?: number; // Added for upgrade system
    baseName?: string; // Add baseName back for client-side display logic
}

// --- Equipment Slots (Needed by components) ---
export type EquipmentSlots = {
    [key in EquipmentSlot]?: Item; // Optional because a slot might be empty
};

// --- Character Data (Simplified for client components if full Character type isn't needed) ---
export interface CharacterDataForClient {
    id: string;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    experience: number;
    currentLevelXp?: number;
    xpToNextLevelBracket?: number;
    currentMana?: number; // Added mana
    maxMana?: number; // Added mana
    availableAttributePoints?: number;
    currentZoneId: string;
    stats: ItemStats; // Use ItemStats here as it covers base stats + more
    inventory: Item[];
    equipment: EquipmentSlots;
    groundLoot: Item[];
    gold: number;
    monsterEssence: number; // Added resource
    scrapMetal: number; // Added resource
    potionSlot1?: string;
    potionSlot2?: string;
    combatStats?: any; // Keep any for now if structure is complex/variable
}

// --- Zone Status (Needed by InGameScreen) ---
export type ZoneStatus = 'unlocked' | 'locked';
export interface ZoneWithStatus {
    id: string;
    name: string;
    description?: string;
    requiredLevel: number;
    connectedZoneIds: string[];
    monsterIds: string[];
    status: ZoneStatus;
}

// --- Encounter Data (Needed by InGameScreen) ---
export interface EncounterData {
    id: string;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    hitRateVsPlayer?: number;
}

// --- Character Class (Used in Character Creation) ---
export interface CharacterClass {
    name: string;
    description: string;
    baseStats: ItemStats; // Use the more general ItemStats which includes base stats
}
