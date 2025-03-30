import { Collection, UpdateFilter, FindOptions } from 'mongodb'; // Note: This might be Collection or MockCollection now
import { charactersCollection } from '../db.js'; // This now exports either Mongo Collection or JSON MockCollection
import { Character } from '../types.js';

// --- JSON DB Fallback Comment ---
// This repository uses the abstracted 'charactersCollection' from db.ts.
// This collection could be either a MongoDB collection or a JSON mock.
// No specific changes are needed here to support the fallback, but if
// removing the fallback system, ensure db.ts only exports the real
// MongoDB collection and remove related files/logic as noted in jsonDb.ts.
// ---------------------------------

/**
 * Finds a single character by its unique ID.
 * @param id The character's UUID.
 * @returns A promise that resolves to the Character object or null if not found.
 */
async function findById(id: string): Promise<Character | null> {
    try {
        const character = await charactersCollection.findOne({ id: id });
        return character;
    } catch (error) {
        console.error(`Error finding character by ID ${id}:`, error);
        throw new Error(`Database error while finding character ${id}`);
    }
}

/**
 * Finds all characters associated with a specific user ID.
 * @param userId The user's UUID.
 * @returns A promise that resolves to an array of Character objects.
 */
async function findByUserId(userId: string): Promise<Character[]> {
    try {
        const characters = await charactersCollection.find({ userId: userId }).toArray();
        return characters;
    } catch (error) {
        console.error(`Error finding characters for user ID ${userId}:`, error);
        throw new Error(`Database error while finding characters for user ${userId}`);
    }
}

/**
 * Saves a character to the database.
 * Performs an upsert: inserts if the character ID doesn't exist, updates if it does.
 * @param character The Character object to save.
 * @returns A promise that resolves when the operation is complete.
 */
async function save(character: Character): Promise<void> {
     try {
        // Separate the ID from the rest of the data for the $set operation
        const { id, ...characterDataToSet } = character;

        // Use updateOne with upsert:true to either insert or update
        const result = await charactersCollection.updateOne(
            { id: id }, // Filter by character ID
            { $set: characterDataToSet }, // Set the character data *without* the id
            { upsert: true } // Create if it doesn't exist (will include id on insert)
        );

        if (result.upsertedCount > 0) {
            console.log(`CharacterRepository: Inserted character ${character.name} (ID: ${character.id})`);
        } else if (result.modifiedCount > 0) {
            // console.log(`CharacterRepository: Updated character ${character.name} (ID: ${character.id})`); // Too noisy for frequent saves
        } else if (result.matchedCount > 0) {
             // console.log(`CharacterRepository: Character ${character.name} (ID: ${character.id}) save resulted in no changes.`); // Also noisy
        } else {
             console.warn(`CharacterRepository: Save operation for character ${character.name} (ID: ${character.id}) did not match, insert, or modify.`);
        }
    } catch (error) {
        console.error(`Error saving character ${character.id}:`, error);
        throw new Error(`Database error while saving character ${character.id}`);
    }
}

/**
 * Updates specific fields of a character document.
 * @param id The ID of the character to update.
 * @param updates An object containing the fields to update (e.g., { currentHp: 50, currentZoneId: 'forest' }).
 * @returns A promise that resolves when the operation is complete.
 */
async function update(id: string, updates: Partial<Character>): Promise<void> {
    try {
        const result = await charactersCollection.updateOne(
            { id: id },
            { $set: updates }
        );
        if (result.modifiedCount === 0 && result.matchedCount > 0) {
            // console.log(`CharacterRepository: Update for character ${id} resulted in no changes.`); // Noisy
        } else if (result.matchedCount === 0) {
             console.warn(`CharacterRepository: Update failed, character ${id} not found.`);
             // Optionally throw an error here if not finding the character is critical
             // throw new Error(`Character ${id} not found for update.`);
        }
    } catch (error) {
        console.error(`Error updating character ${id}:`, error);
        throw new Error(`Database error while updating character ${id}`);
    }
}


/**
 * Deletes a character by its unique ID.
 * @param id The character's UUID.
 * @returns A promise that resolves to true if a document was deleted, false otherwise.
 */
async function deleteById(id: string): Promise<boolean> {
    try {
        const result = await charactersCollection.deleteOne({ id: id });
        if (result.deletedCount === 1) {
            console.log(`CharacterRepository: Deleted character ${id}`);
            return true;
        } else {
            console.warn(`CharacterRepository: Character ${id} not found for deletion.`);
            return false;
        }
    } catch (error) {
        console.error(`Error deleting character ${id}:`, error);
        throw new Error(`Database error while deleting character ${id}`);
    }
}

// Export the repository functions
export const CharacterRepository = {
    findById,
    findByUserId,
    save,
    update, // Export the new update function
    deleteById
};
