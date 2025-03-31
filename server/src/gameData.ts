import { Character, Monster, Zone, CharacterClass, ItemQuality } from './types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper function to load JSON data (similar to lootData.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Corrected path: Go up one level from dist/ to server/, then into data/
const dataDir = path.join(__dirname, '..', 'data');

function loadJsonData<T>(filename: string): T {
    const filePath = path.join(dataDir, filename);
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData) as T;
    } catch (error) {
        console.error(`Error loading data from ${filePath}:`, error);
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw new Error(`Failed to load ${filename}: File not found at ${filePath}. Check the path calculation.`);
        } else if (error instanceof SyntaxError) {
            throw new Error(`Failed to load ${filename}: Invalid JSON format in file at ${filePath}.`);
        } else {
            throw new Error(`Failed to load ${filename} from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

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


// --- Load Game Data ---
const monstersData = loadJsonData<Record<string, Monster>>('monsters.json');
export const monsters: Map<string, Monster> = new Map(Object.entries(monstersData));

const zonesData = loadJsonData<Record<string, Zone>>('zones.json');
export const zones: Map<string, Zone> = new Map(Object.entries(zonesData));

const characterClassesData = loadJsonData<Record<string, CharacterClass>>('characterClasses.json');
export const characterClasses: Map<string, CharacterClass> = new Map(Object.entries(characterClassesData));

// --- Load Item Quality Weights ---
export const qualityWeights: { quality: ItemQuality; weight: number }[] = loadJsonData<{ quality: ItemQuality; weight: number }[]>('qualityWeights.json');

// Note: The redundant lootTables definition previously here has been removed.
// Loot tables are now loaded and managed solely within server/src/lootData.ts
