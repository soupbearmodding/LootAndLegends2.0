import { Collection, UpdateFilter } from 'mongodb'; // Note: This might be Collection or MockCollection now
import { usersCollection } from '../db.js'; // This now exports either Mongo Collection or JSON MockCollection
import { User } from '../types.js';

// --- JSON DB Fallback Comment ---
// This repository uses the abstracted 'usersCollection' from db.ts.
// This collection could be either a MongoDB collection or a JSON mock.
// No specific changes are needed here to support the fallback, but if
// removing the fallback system, ensure db.ts only exports the real
// MongoDB collection and remove related files/logic as noted in jsonDb.ts.
// ---------------------------------

/**
 * Finds a single user by their unique ID.
 * @param id The user's UUID.
 * @returns A promise that resolves to the User object or null if not found.
 */
async function findById(id: string): Promise<User | null> {
    try {
        const user = await usersCollection.findOne({ id: id });
        return user;
    } catch (error) {
        console.error(`Error finding user by ID ${id}:`, error);
        throw new Error(`Database error while finding user ${id}`);
    }
}

/**
 * Finds a single user by their username.
 * @param username The user's username.
 * @returns A promise that resolves to the User object or null if not found.
 */
async function findByUsername(username: string): Promise<User | null> {
    try {
        // Ensure case-insensitive search if desired, otherwise use as is
        // const user = await usersCollection.findOne({ username: { $regex: `^${username}$`, $options: 'i' } });
        const user = await usersCollection.findOne({ username: username });
        return user;
    } catch (error) {
        console.error(`Error finding user by username ${username}:`, error);
        throw new Error(`Database error while finding user ${username}`);
    }
}

/**
 * Saves a user to the database. Primarily used for registration.
 * Performs an upsert: inserts if the user ID doesn't exist, updates if it does (less common for users).
 * @param user The User object to save.
 * @returns A promise that resolves when the operation is complete.
 */
async function save(user: User): Promise<void> {
     try {
        const result = await usersCollection.updateOne(
            { id: user.id },
            { $set: user },
            { upsert: true }
        );
        if (result.upsertedCount > 0) {
            console.log(`UserRepository: Inserted user ${user.username} (ID: ${user.id})`);
        } else if (result.modifiedCount > 0) {
             console.log(`UserRepository: Updated user ${user.username} (ID: ${user.id})`);
        }
    } catch (error) {
        console.error(`Error saving user ${user.id}:`, error);
        throw new Error(`Database error while saving user ${user.id}`);
    }
}

/**
 * Adds or removes a character ID from a user's characterIds array.
 * @param userId The ID of the user to update.
 * @param characterId The ID of the character to add or remove.
 * @param action 'add' to push the ID, 'remove' to pull the ID.
 * @returns A promise that resolves to true if the update was successful, false otherwise.
 */
async function updateCharacterList(userId: string, characterId: string, action: 'add' | 'remove'): Promise<boolean> {
    try {
        let updateOperation: UpdateFilter<User>;
        if (action === 'add') {
            updateOperation = { $addToSet: { characterIds: characterId } }; // Use $addToSet to prevent duplicates
        } else if (action === 'remove') {
            updateOperation = { $pull: { characterIds: characterId } };
        } else {
            console.error(`Invalid action specified for updateCharacterList: ${action}`);
            return false;
        }

        const result = await usersCollection.updateOne(
            { id: userId },
            updateOperation
        );

        if (result.modifiedCount === 1) {
            console.log(`UserRepository: ${action === 'add' ? 'Added' : 'Removed'} character ${characterId} ${action === 'add' ? 'to' : 'from'} user ${userId}`);
            return true;
        } else if (result.matchedCount === 1) {
             console.log(`UserRepository: User ${userId} found, but character list update for ${characterId} (${action}) resulted in no change.`);
             // This can happen if adding an existing ID with $addToSet, or removing a non-existent ID with $pull
             return true; // Still considered successful as the state is correct
        } else {
            console.warn(`UserRepository: User ${userId} not found for character list update.`);
            return false;
        }
    } catch (error) {
        console.error(`Error updating character list for user ${userId}:`, error);
        throw new Error(`Database error while updating character list for user ${userId}`);
    }
}


// Export the repository functions
export const UserRepository = {
    findById,
    findByUsername,
    save,
    updateCharacterList
};
