import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { usersCollection, charactersCollection } from './db.js';
import { safeSend } from './utils.js';
import {
    UserCredentials,
    User,
    ActiveConnectionsMap,
    ActiveEncountersMap,
    PlayerAttackIntervalsMap,
    MonsterAttackIntervalsMap
} from './types.js';

const SALT_ROUNDS = 10; // For bcrypt hashing

// --- Authentication Handlers ---

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 100;

export async function handleRegister(ws: WebSocket, payload: any) {
    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        typeof payload.username !== 'string' || payload.username.trim() === '' ||
        typeof payload.password !== 'string' || payload.password === '') // Allow spaces in password, but not empty
    {
        safeSend(ws, { type: 'register_fail', payload: 'Invalid payload format: Requires non-empty username and password strings.' });
        console.warn(`Invalid register payload format received: ${JSON.stringify(payload)}`);
        return;
    }

    const username = payload.username.trim(); // Trim username
    const password = payload.password; // Keep password as is

    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        safeSend(ws, { type: 'register_fail', payload: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters.` });
        return;
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        safeSend(ws, { type: 'register_fail', payload: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.` });
        return;
    }
    // --- End Validation ---

    // Use validated variables
    const credentials: UserCredentials = { username, password };

    try {
        // Check if user already exists in DB
        const existingUser = await usersCollection.findOne({ username: username });
        if (existingUser) {
            safeSend(ws, { type: 'register_fail', payload: 'Username already exists' });
            return;
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create new user document
        const newUser: User = {
            id: uuidv4(), // Use UUID for user ID
            username: username,
            passwordHash: passwordHash,
            characterIds: []
        };

        // Insert into database
        const result = await usersCollection.insertOne(newUser);

        if (result.insertedId) {
            console.log(`User registered: ${username} (ID: ${newUser.id})`);
            safeSend(ws, { type: 'register_success', payload: { message: 'Registration successful', userId: newUser.id } });
        } else {
             throw new Error("User insertion failed");
        }

    } catch (error) {
        console.error("Registration error:", error);
        safeSend(ws, { type: 'register_fail', payload: 'Server error during registration' });
    }
}

export async function handleLogin(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        typeof payload.username !== 'string' || payload.username.trim() === '' ||
        typeof payload.password !== 'string' || payload.password === '') // Allow spaces in password, but not empty
    {
        safeSend(ws, { type: 'login_fail', payload: 'Invalid payload format: Requires non-empty username and password strings.' });
        console.warn(`Invalid login payload format received: ${JSON.stringify(payload)}`);
        return;
    }

    const username = payload.username.trim(); // Trim username
    const password = payload.password; // Keep password as is
    // --- End Validation ---

    // Use validated variables
    const credentials: UserCredentials = { username, password };

    try {
        // Find user in DB
        const user = await usersCollection.findOne({ username: username });

        if (!user) {
            safeSend(ws, { type: 'login_fail', payload: 'Invalid username or password' });
            return;
        }

        // Compare hashed password
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            safeSend(ws, { type: 'login_fail', payload: 'Invalid username or password' });
            return;
        }

        // Prevent multiple logins for the same user for now
        for (const [client, connectionInfo] of activeConnections.entries()) {
            // Compare the userId within the connectionInfo object
            if (connectionInfo.userId === user.id) {
                 safeSend(ws, { type: 'login_fail', payload: 'User already logged in' });
                 return;
            }
        }

        // Store user ID against the connection
        activeConnections.set(ws, { userId: user.id });
        // Enhanced Logging
        console.log(`User logged in: ${user.username} (ID: ${user.id}). Connection established.`);

        // Find existing characters for this user from DB
        const userCharacters = await charactersCollection.find({ userId: user.id }).toArray();

        safeSend(ws, {
            type: 'login_success',
            payload: {
                message: 'Login successful',
                userId: user.id,
                username: user.username,
                characters: userCharacters // Send character list on login
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        safeSend(ws, { type: 'login_fail', payload: 'Server error during login' });
    }
}

export function handleLogout(
    ws: WebSocket,
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    playerAttackIntervals: PlayerAttackIntervalsMap,
    monsterAttackIntervals: MonsterAttackIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    if (connectionInfo) {
        const userId = connectionInfo.userId;
        // Clear combat intervals if player was in combat
        const playerInterval = playerAttackIntervals.get(ws);
        if (playerInterval) {
            clearInterval(playerInterval);
            playerAttackIntervals.delete(ws);
            console.log(`Cleared player attack interval for user ${userId} due to logout.`);
        }
        const monsterInterval = monsterAttackIntervals.get(ws);
        if (monsterInterval) {
            clearInterval(monsterInterval);
            monsterAttackIntervals.delete(ws);
            console.log(`Cleared monster attack interval for user ${userId} due to logout.`);
        }
        activeEncounters.delete(ws); // Also clear encounter on logout
        activeConnections.delete(ws);
        // Find user in DB to log username (optional)
        usersCollection.findOne({ id: userId }).then(user => {
             console.log(`User logged out: ${user?.username ?? 'Unknown'} (ID: ${userId})`);
        }).catch(err => {
            console.error(`Error finding user ${userId} during logout:`, err);
        });
    }
}
