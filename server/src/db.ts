import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
// Removed dotenv imports
import { User, Character } from './types.js';

// Environment variables are now loaded in server.ts

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'loot_and_legends'; // Allow overriding DB name via env

if (!MONGODB_URI) {
    console.error('FATAL: MONGODB_URI environment variable is not set. Please check your .env file.');
    process.exit(1);
}

let db: Db | null = null; // Allow db to be null initially

// --- Abstracted Collection Types ---
let usersCollection: Collection<User>;
let charactersCollection: Collection<Character>;


export async function connectToDatabase() {
    // Ensure MONGODB_URI is defined before proceeding
    if (!MONGODB_URI) {
        // This case is already handled by the check above, but adding for clarity
        // and potentially satisfying stricter type checking in some scenarios.
        console.error('FATAL: MONGODB_URI is not defined. Cannot connect to database.');
        process.exit(1);
    }

    try {
        // Attempt MongoDB connection with a timeout
        const client = new MongoClient(MONGODB_URI, { // Now MONGODB_URI is guaranteed to be a string here
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
