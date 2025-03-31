import { Item, Affix } from './types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper function to load JSON data
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Adjust the path to point to the 'data' directory relative to the compiled JS file location (in 'dist')
// Corrected path: Go up one level from dist/ to server/, then into data/
const dataDir = path.join(__dirname, '..', 'data');

function loadJsonData<T>(filename: string): T {
    const filePath = path.join(dataDir, filename);
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData) as T;
    } catch (error) {
        console.error(`Error loading data from ${filePath}:`, error);
        // Provide a more specific error based on the type of error
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw new Error(`Failed to load ${filename}: File not found at ${filePath}. Check the path calculation.`);
        } else if (error instanceof SyntaxError) {
            throw new Error(`Failed to load ${filename}: Invalid JSON format in file at ${filePath}.`);
        } else {
            throw new Error(`Failed to load ${filename} from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Define types based on JSON structure (adjust if necessary)
type PotionEffect = { health?: number; mana?: number; healthPercent?: number; manaPercent?: number };
export type BaseItemDefinition = Omit<Item, 'id' | 'quality' | 'prefixes' | 'suffixes' | 'rarity'> & {
    sellValue?: number;
    effect?: PotionEffect;
    damage?: { min: number; max: number };
    defense?: number;
    blockChance?: number;
    twoHanded?: boolean;
};

// --- Load Item Data ---
const itemsData = loadJsonData<Record<string, BaseItemDefinition>>('items.json');
export const items: Map<string, BaseItemDefinition> = new Map(Object.entries(itemsData));
export const baseItemsTyped: Map<string, BaseItemDefinition> = items; // Keep alias for compatibility

// --- Load Affix Data ---
const prefixesData = loadJsonData<Record<string, Affix>>('prefixes.json');
export const prefixes: Map<string, Affix> = new Map(Object.entries(prefixesData));

const suffixesData = loadJsonData<Record<string, Affix>>('suffixes.json');
export const suffixes: Map<string, Affix> = new Map(Object.entries(suffixesData));

// --- Load Affix Tier Progression ---
const affixTiersData = loadJsonData<Record<string, string[]>>('affixTiers.json');
export const affixTiers: Map<string, string[]> = new Map(Object.entries(affixTiersData));

// Helper function to get the base name of an affix ID (e.g., 'str_p1b' -> 'str_p')
// This function remains as it's logic, not data definition
export function getAffixBaseName(affixId: string): string | null {
    const match = affixId.match(/^([a-z]+(?:_[a-z]+)*)_[ps]\d+[a-z]?$/);
    if (!match) return null; // No regex match

    const parts = affixId.split('_');
    // Ensure there's at least two parts after split and the second part is not empty
    if (parts.length < 2 || !parts[1]) return null;

    return match[1] + '_' + parts[1].charAt(0); // e.g., str_p or res_fire_s
}


// --- Load Loot Tables ---
// Define interfaces based on JSON structure
export interface LootDrop {
    baseId: string;
    chance: number;
    quantity?: { min: number; max: number };
    magicFindSensitive?: boolean;
}

export interface LootTable {
    id: string;
    noDropChance: number;
    maxDrops: number;
    possibleDrops: LootDrop[];
    qualityChances?: {
        magic: number;
        rare: number;
        // unique: number; // Add later
    };
}

const lootTablesData = loadJsonData<Record<string, LootTable>>('lootTables.json');
export const lootTables: Map<string, LootTable> = new Map(Object.entries(lootTablesData));
