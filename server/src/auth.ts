import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { usersCollection, charactersCollection } from './db.js';
import { safeSend } from './utils.js';
import { UserCredentials, User, ActiveConnectionsMap, ActiveEncountersMap, CombatIntervalsMap } from './types.js';

const SALT_ROUNDS = 10; // For bcrypt hashing

// --- Authentication Handlers ---

export async function handleRegister(ws: WebSocket, payload: any) {
    if (!payload || typeof payload.username !== 'string' || typeof payload.password !== 'string') {
        safeSend(ws, { type: 'register_fail', payload: 'Invalid registration data' });
        return;
    }

    const { username, password }: UserCredentials = payload;

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
    if (!payload || typeof payload.username !== 'string' || typeof payload.password !== 'string') {
        safeSend(ws, { type: 'login_fail', payload: 'Invalid login data' });
        return;
    }

    const { username, password }: UserCredentials = payload;

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
        console.log(`User logged in: ${username} (ID: ${user.id})`);

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
    combatIntervals: CombatIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    if (connectionInfo) {
        const userId = connectionInfo.userId;
        // Clear combat interval if player was in combat
        const existingInterval = combatIntervals.get(ws);
        if (existingInterval) {
            clearInterval(existingInterval);
            combatIntervals.delete(ws);
            console.log(`Cleared combat interval for user ${userId} due to logout.`);
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
