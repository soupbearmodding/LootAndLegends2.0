// --- JSON DB Fallback ---
// This file provides a simple JSON file-based data store as a fallback
// when MongoDB is not available. It also includes functions for explicit
// saving/loading directly to/from the JSON files for testing/backup.
// To remove this fallback:
// 1. Delete this file (server/src/jsonDb.ts).
// 2. Remove the fallback logic and related imports/comments in server/src/db.ts.
// 3. Remove related comments in server/src/repositories/*.ts.
// 4. Remove the data directory entry from .gitignore.
// 5. Remove related handlers (loadCharacterFromJsonFile, saveCharacterToJsonFile) from server.ts.
// --------------------------

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url'; // Import necessary function for ES Modules
import crypto from 'crypto'; // Import crypto for UUIDs
import { User, Character } from './types.js'; // Assuming types are defined here
// Removed ObjectId import as we'll use string IDs

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data'); // Store data in server/data/
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');

interface JsonDb {
    users: User[];
    characters: Character[];
}

// In-memory cache of the JSON data
let dbData: JsonDb = { users: [], characters: [] };
let isDataLoaded = false; // Flag to track if initial load happened

// --- Core Load/Save Functions ---

// Loads data from JSON files into the in-memory dbData cache
async function loadData(): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true }); // Ensure data directory exists

        try {
            const usersData = await fs.readFile(USERS_FILE, 'utf-8');
            dbData.users = JSON.parse(usersData);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log('Users JSON file not found, starting fresh.');
                dbData.users = [];
                await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2)); // Create empty file
            } else {
                throw error; // Rethrow other errors
            }
        }

        try {
            const charactersData = await fs.readFile(CHARACTERS_FILE, 'utf-8');
            dbData.characters = JSON.parse(charactersData);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.log('Characters JSON file not found, starting fresh.');
                dbData.characters = [];
                await fs.writeFile(CHARACTERS_FILE, JSON.stringify([], null, 2)); // Create empty file
            } else {
                throw error; // Rethrow other errors
            }
        }
        isDataLoaded = true; // Mark data as loaded
        console.log('JSON DB data loaded into memory.');

    } catch (error) {
        console.error('Error loading JSON DB data:', error);
        // Decide if we should exit or continue with empty data
        dbData = { users: [], characters: [] };
        isDataLoaded = false; // Mark as not loaded on error
    }
}

// Saves the current in-memory dbData cache to JSON files
async function saveData(): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(USERS_FILE, JSON.stringify(dbData.users, null, 2));
        await fs.writeFile(CHARACTERS_FILE, JSON.stringify(dbData.characters, null, 2));
        console.log('In-memory JSON DB data saved to files.');
    } catch (error) {
        console.error('Error saving JSON DB data:', error);
    }
}

// --- Mock Collection Interface (for Fallback DB) ---
// Mimics MongoDB Collection methods used by repositories
// Uses 'id' (string) instead of '_id' (ObjectId)

// Mimics MongoDB's UpdateResult structure for compatibility
interface MockUpdateResult {
    matchedCount: number;
    modifiedCount: number;
    upsertedCount: number;
    upsertedId: string | null; // Use string for ID consistency
    acknowledged: boolean;
}

interface MockCollection<T extends { id: string }> { // Removed 'export' here
    find(query: any): { toArray(): Promise<T[]> }; // Corrected return type (no Promise wrapper here)
    findOne(query: any): Promise<T | null>;
    insertOne(doc: Omit<T, 'id'>): Promise<{ insertedId: string }>; // Changed Omit key and insertedId type
    updateOne(filter: any, update: any): Promise<MockUpdateResult>; // Updated return type
    deleteOne(filter: any): Promise<{ deletedCount: number }>;
}

// --- Users Collection Mock ---
const usersJsonCollection: MockCollection<User> = {
     find(query: any) { // Removed async here
        // Basic query handling - extend as needed
        const results = dbData.users.filter(user => {
            if (query.username !== undefined && user.username !== query.username) return false;
            if (query.id !== undefined && user.id !== query.id) return false;
            // Add other query fields as needed
            return true; // Match if no specific query field mismatch
        });
        // Return the object with the async toArray method
        return {
            toArray: async () => results
        };
    },
    async findOne(query: any) {
        const result = dbData.users.find(user => {
            if (query.username !== undefined && user.username !== query.username) return false;
            if (query.id !== undefined && user.id !== query.id) return false;
            return true;
        });
        return result || null;
    },
    async insertOne(doc: Omit<User, 'id'>) { // Changed Omit key
        const newUser: User = {
            ...doc,
            id: crypto.randomUUID(), // Generate a string UUID
            // Assuming User type doesn't have createdAt, add if needed
            // createdAt: new Date(),
        };
        dbData.users.push(newUser);
        await saveData(); // Save immediately after modifying in-memory data
        return { insertedId: newUser.id }; // Return string ID
    },
    async updateOne(filter: any, update: any) {
        const index = dbData.users.findIndex(user => {
            if (filter.username !== undefined && user.username !== filter.username) return false;
            if (filter.id !== undefined && user.id !== filter.id) return false;
            return true;
        });
        if (index !== -1) {
            // Basic $set support - extend as needed
            if (update.$set) {
                // Ensure ID is not overwritten if present in $set
                const { id, ...setData } = update.$set;
                dbData.users[index] = { ...dbData.users[index], ...setData };
            }
            // Add other operators like $inc, $pull if needed for users
            await saveData(); // Save immediately after modifying in-memory data
            // Return MockUpdateResult
            return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null, acknowledged: true };
        }
        // Return MockUpdateResult for no match
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null, acknowledged: true };
    },
    async deleteOne(filter: any) {
         const initialLength = dbData.users.length;
         dbData.users = dbData.users.filter(user => {
             if (filter.username !== undefined && user.username === filter.username) return false; // Delete if matches
             if (filter.id !== undefined && user.id === filter.id) return false; // Delete if matches
             return true; // Keep if no filter matches
         });
         const deletedCount = initialLength - dbData.users.length;
         if (deletedCount > 0) {
             await saveData(); // Save immediately after modifying in-memory data
         }
         return { deletedCount };
    }
};

// --- Characters Collection Mock ---
const charactersJsonCollection: MockCollection<Character> = {
     find(query: any) { // Removed async
        const results = dbData.characters.filter(char => {
            // Ensure query properties exist before comparing
            if (query.userId !== undefined && char.userId !== query.userId) return false;
            if (query.id !== undefined && char.id !== query.id) return false;
            // Add other query fields as needed
            return true; // Match if no specific query field mismatch
        });
        // Return the object with the async toArray method
        return {
            toArray: async () => results
        };
    },
    async findOne(query: any) {
        const result = dbData.characters.find(char => {
            if (query.userId !== undefined && char.userId !== query.userId) return false;
            if (query.id !== undefined && char.id !== query.id) return false;
            // Add other query fields as needed
            return true;
        });
        return result || null;
    },
    async insertOne(doc: Omit<Character, 'id'>) { // Changed Omit key
        const newChar: Character = {
            ...doc,
            id: crypto.randomUUID(), // Generate a string UUID
            // Assuming Character type doesn't have createdAt, add if needed
            // createdAt: new Date(),
            // Ensure default fields are set if not provided - check Character type definition
            level: doc.level ?? 1, // Keep defaults based on type
            experience: doc.experience ?? 0, // Keep defaults based on type
            gold: doc.gold ?? 0, // Keep defaults based on type
            inventory: doc.inventory ?? [], // Keep defaults based on type
            equipment: doc.equipment ?? {}, // Keep defaults based on type
            stats: doc.stats ?? { strength: 10, dexterity: 10, vitality: 10, energy: 10 }, // Provide actual defaults
            currentHp: doc.currentHp ?? 50, // Provide actual defaults
            maxHp: doc.maxHp ?? 50, // Provide actual defaults
            currentMana: doc.currentMana ?? 50, // Provide actual defaults
            maxMana: doc.maxMana ?? 50, // Provide actual defaults
            currentZoneId: doc.currentZoneId ?? 'start_zone', // Provide actual defaults
            groundLoot: doc.groundLoot ?? [], // Provide actual defaults
            // potionSlot1/2 are optional in type, no default needed unless required logic changes
        };
        dbData.characters.push(newChar);
        await saveData(); // Save immediately after modifying in-memory data
        return { insertedId: newChar.id }; // Return string ID
    },
     async updateOne(filter: any, update: any) {
        const index = dbData.characters.findIndex(char => {
            if (filter.id !== undefined && char.id !== filter.id) return false;
            if (filter.userId !== undefined && char.userId !== filter.userId) return false;
            return true;
        });
        if (index !== -1) {
            const charToUpdate = dbData.characters[index];
            // Basic $set support - extend as needed
            if (update.$set) {
                // Create a new object ensuring the id is preserved and type matches Character
                let updatedCharData: Partial<Character> = {};
                // Ensure ID is not overwritten if present in $set
                const { id, ...setData } = update.$set;
                for (const key in setData) {
                    // Use non-null assertion '!' on charToUpdate when accessing nested properties
                    if (key === 'stats' && typeof setData.stats === 'object' && setData.stats !== null && charToUpdate!.stats) {
                        updatedCharData.stats = { ...charToUpdate!.stats, ...setData.stats };
                    } else if (key === 'equipment' && typeof setData.equipment === 'object' && setData.equipment !== null && charToUpdate!.equipment) {
                        updatedCharData.equipment = { ...charToUpdate!.equipment, ...setData.equipment };
                    } else {
                        (updatedCharData as any)[key] = (setData as any)[key];
                    }
                }
                // Merge existing data with updates, ensuring id is kept and type is correct
                // Explicitly cast to Character after merging
                dbData.characters[index] = { ...charToUpdate, ...updatedCharData } as Character;
            }
             // Basic $inc support - extend as needed
            if (update.$inc) {
                 // Re-fetch the potentially updated character data from the array
                 const charToInc = dbData.characters[index];
                 // Return full MockUpdateResult if character not found (shouldn't happen here)
                 if (!charToInc) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null, acknowledged: true };

                for (const key in update.$inc) {
                    const incValue = update.$inc[key];
                    if (typeof incValue !== 'number') continue; // Skip non-numeric increments

                    // Check if the property exists and is a number before incrementing
                    // Use non-null assertion '!' since we checked charToInc
                    if (typeof (charToInc! as any)[key] === 'number') {
                         (charToInc! as any)[key] += incValue;
                    } else if (key.startsWith('stats.') && charToInc!.stats) {
                        const statKey = key.substring(6) as keyof Character['stats'];
                        // Use non-null assertion '!' on stats as well
                        if (typeof charToInc!.stats[statKey] === 'number') {
                             (charToInc!.stats[statKey] as number) += incValue;
                        }
                    }
                    // Add more nested increments if needed (e.g., for resistances if they were nested)
                } // End of for...in loop for $inc
            } // End of if (update.$inc)
            // Add support for other operators like $push if needed
            await saveData(); // Save immediately after modifying in-memory data
             // Return MockUpdateResult
            return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null, acknowledged: true };
        } // End of if (index !== -1)
         // Return MockUpdateResult for no match
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null, acknowledged: true };
    }, // End of updateOne method

    async deleteOne(filter: any) { // Start of deleteOne method
        const initialLength = dbData.characters.length;
        dbData.characters = dbData.characters.filter(char => {
            if (filter.id !== undefined && char.id === filter.id) return false; // Delete if matches
            if (filter.userId !== undefined && char.userId === filter.userId) return false; // Delete if matches
            return true; // Keep if no filter matches
        });
        const deletedCount = initialLength - dbData.characters.length;
        if (deletedCount > 0) {
            await saveData(); // Save immediately after modifying in-memory data
        }
        return { deletedCount };
    }
};


// --- Initialization for Fallback ---
export async function initializeJsonDb() {
    console.warn('--- WARNING: MongoDB connection failed or skipped. Using JSON file fallback for data storage. ---');
    console.warn('--- Data will be stored in server/data/ ---');
    if (!isDataLoaded) {
        await loadData(); // Load data only if not already loaded
    }
    // Periodically save data (optional, provides some safety against crashes)
    // setInterval(saveData, 300000); // e.g., save every 5 minutes
}

// --- Explicit JSON Load/Save Functions ---

// Reads the characters.json file directly and returns the character data
async function loadCharacterFromJsonFile(characterId: string): Promise<Character | null> { // Removed export keyword
    try {
        const charactersData = await fs.readFile(CHARACTERS_FILE, 'utf-8');
        const characters: Character[] = JSON.parse(charactersData);
        const character = characters.find(char => char.id === characterId);
        return character || null;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log('Characters JSON file not found during explicit load.');
            return null; // File doesn't exist
        }
        console.error(`Error explicitly loading character ${characterId} from JSON file:`, error);
        throw new Error(`Failed to load character ${characterId} from JSON file`);
    }
}

// Reads characters.json, updates/adds the character, and writes back to the file
async function saveCharacterToJsonFile(character: Character): Promise<void> { // Removed export keyword
    let characters: Character[] = [];
    try {
        // Read existing data first
        try {
            const charactersData = await fs.readFile(CHARACTERS_FILE, 'utf-8');
            characters = JSON.parse(charactersData);
        } catch (readError: any) {
            if (readError.code === 'ENOENT') {
                console.log('Characters JSON file not found during explicit save, creating new.');
                characters = []; // Start with empty array if file doesn't exist
            } else {
                throw readError; // Rethrow other read errors
            }
        }

        // Find and update or add the character
        const index = characters.findIndex(char => char.id === character.id);
        if (index !== -1) {
            characters[index] = character; // Update existing
        } else {
            characters.push(character); // Add new
        }

        // Write the updated array back to the file
        await fs.writeFile(CHARACTERS_FILE, JSON.stringify(characters, null, 2));
        console.log(`Character ${character.id} explicitly saved to JSON file.`);

        // Optional: Update in-memory cache if it's loaded, for consistency
        if (isDataLoaded) {
            const memIndex = dbData.characters.findIndex(char => char.id === character.id);
            if (memIndex !== -1) {
                dbData.characters[memIndex] = character;
            } else {
                dbData.characters.push(character);
            }
        }

    } catch (error) {
        console.error(`Error explicitly saving character ${character.id} to JSON file:`, error);
        throw new Error(`Failed to save character ${character.id} to JSON file`);
    }
}


// --- Exports ---
// Use 'export type' for the interface when isolatedModules is enabled
export type { MockCollection };
// Export mocks for fallback, and explicit functions for direct JSON interaction
export {
    usersJsonCollection,
    charactersJsonCollection,
    saveData, // Saves the whole in-memory cache (used by mocks)
    loadCharacterFromJsonFile, // Explicitly loads a single char from file
    saveCharacterToJsonFile // Explicitly saves a single char to file
};
