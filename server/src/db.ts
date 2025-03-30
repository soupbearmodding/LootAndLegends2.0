import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { User, Character } from './types.js';
// --- JSON DB Fallback Import ---
// To remove fallback: Delete these lines and the try/catch logic below.
import {
    initializeJsonDb,
    usersJsonCollection,
    charactersJsonCollection,
    MockCollection // Use this interface for abstraction
} from './jsonDb.js';
// ------------------------------

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'loot_and_legends';

let db: Db | null = null; // Allow db to be null if connection fails

// --- Abstracted Collection Types ---
// Use MockCollection as the common interface.
// Note: MongoDB's Collection<T> is structurally compatible enough for the methods we use.
// We might need slight adjustments in repositories if using methods not in MockCollection.
let usersCollection: Collection<User> | MockCollection<User>;
let charactersCollection: Collection<Character> | MockCollection<Character>;

// --- Type Guard for MongoDB Collections ---
// Helper to check if we are using the real MongoDB collection
function isMongoCollection<T extends { id: string }>(
    collection: Collection<T> | MockCollection<T>
): collection is Collection<T> {
    // Check for a property unique to MongoDB's Collection, like namespace or collectionName
    return collection && typeof (collection as Collection<T>).collectionName === 'string';
}


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
        // --- JSON DB Fallback Activation ---
        // To remove fallback: Delete this catch block and the imports above.
        console.warn('MongoDB connection failed or timed out. Attempting to use JSON file fallback.', error);
        await initializeJsonDb();
        usersCollection = usersJsonCollection; // Assign mock collection
        charactersCollection = charactersJsonCollection; // Assign mock collection
        // No process.exit(1) here, we continue with the fallback
        // ------------------------------------
    }

    // Ensure collections are assigned (either Mongo or JSON mock)
    if (!usersCollection || !charactersCollection) {
         console.error('FATAL: Database collections could not be initialized (Mongo or JSON). Exiting.');
         process.exit(1);
    }
}

// Export collections for use in other modules
export { usersCollection, charactersCollection, isMongoCollection, ObjectId }; // Export ObjectId for potential use in repositories
