import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { User, Character } from './types.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'loot_and_legends';

let db: Db | null = null; // Allow db to be null if connection fails

// --- Abstracted Collection Types ---
let usersCollection: Collection<User>;
let charactersCollection: Collection<Character>;


export async function connectToDatabase() {
    try {
        // Attempt MongoDB connection with a timeout
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 3000 // Wait 3 seconds max for server selection
        });
        await client.connect();
        db = client.db(DB_NAME);

        // Assign actual MongoDB collections
        const mongoUsersCollection = db.collection<User>('users');
        const mongoCharactersCollection = db.collection<Character>('characters');

        // Optional: Create indexes for faster lookups (only if MongoDB connects)
        // Need to handle potential errors if collections don't exist yet or indexes fail
        try {
            await mongoUsersCollection.createIndex({ username: 1 }, { unique: true });
        } catch (indexError) {
            console.warn("Could not create 'username' index on users (might already exist or collection doesn't exist):", indexError);
        }
        try {
            await mongoCharactersCollection.createIndex({ userId: 1 });
        } catch (indexError) {
            console.warn("Could not create 'userId' index on characters (might already exist or collection doesn't exist):", indexError);
        }

        // Assign to exported variables AFTER successful index creation (or handling)
        usersCollection = mongoUsersCollection;
        charactersCollection = mongoCharactersCollection;

        console.log(`Successfully connected to MongoDB database: ${db.databaseName}`);

    } catch (error) {
        console.error('FATAL: MongoDB connection failed. Check connection string and server status.', error);
        // Exit the process if the database connection fails, as it's critical
        process.exit(1);
    }

    // This check might be redundant now if process exits on error, but kept for safety
    if (!usersCollection || !charactersCollection) {
         console.error('FATAL: Database collections were not initialized correctly. Exiting.');
         process.exit(1);
    }
}

// Export collections for use in other modules
export { usersCollection, charactersCollection, ObjectId }; // Export ObjectId for potential use in repositories
