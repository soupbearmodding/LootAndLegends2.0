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

// --- Item (Basic structure needed for components) ---
// It's often better to import the full type if possible, but copying essentials works too.
export interface Item {
    id: string;
    baseId: string;
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    equipmentSlot?: EquipmentSlot;
    stats?: Partial<ItemStats>;
    quantity?: number;
    rarity?: 'common' | 'magic' | 'rare' | 'unique' | 'legendary';
    baseName?: string; // Add baseName back for client-side display logic
    // Add other properties if needed by client components (e.g., prefixes/suffixes if displayed)
    // prefixes?: any[]; // Use 'any' or define Affix locally if needed
    // suffixes?: any[];
}

// --- Equipment Slots (Needed by components) ---
export type EquipmentSlots = {
    [key in EquipmentSlot]?: Item; // Optional because a slot might be empty
};

// --- Character Data (Simplified for client components if full Character type isn't needed) ---
// Or copy the full Character interface if required
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
