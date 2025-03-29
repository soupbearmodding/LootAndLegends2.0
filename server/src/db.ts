import { MongoClient, Db, Collection } from 'mongodb';
import { User, Character } from './types.js'; // Import interfaces from types.ts

// Replace with your MongoDB connection string
// Ensure your MongoDB server is running!
// Example: mongodb://localhost:27017
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'loot_and_legends'; // Choose a database name

let db: Db;
let usersCollection: Collection<User>;
let charactersCollection: Collection<Character>;

export async function connectToDatabase() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);

        usersCollection = db.collection<User>('users');
        charactersCollection = db.collection<Character>('characters');

        // Optional: Create indexes for faster lookups
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        await charactersCollection.createIndex({ userId: 1 });

        console.log(`Successfully connected to database: ${db.databaseName}`);
    } catch (error) {
        console.error('Database connection failed!', error);
        process.exit(1); // Exit if DB connection fails
    }
}

// Export collections for use in other modules
export { usersCollection, charactersCollection };
