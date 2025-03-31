import WebSocket from 'ws';
import { validatePayload, RegisterPayloadSchema, LoginPayloadSchema } from '../validation.js';
import { broadcast, send } from '../websocketUtils.js';
import { activeConnections } from '../server.js';
import { AuthService } from '../services/authService.js';
import { CharacterService } from '../services/characterService.js';
import { ICharacterRepository, LoginPayload, RegisterPayload, CharacterSummary, Character } from '../types.js'; // Import ICharacterRepository
import { UserRepository } from '../repositories/userRepository.js'; // Keep this if needed elsewhere, or remove if not

// TODO: Instantiate AuthService, likely requires UserRepository
// const userRepository = new UserRepository(/* db connection or path */);
// Assuming CharacterService is also injected or accessible
export class AuthHandler {
    private authService: AuthService;
    private characterService: CharacterService;
    private characterRepository: ICharacterRepository; // Add repository

    // Modify constructor to accept CharacterService and ICharacterRepository
    constructor(
        authService: AuthService,
        characterService: CharacterService,
        characterRepository: ICharacterRepository // Inject repository
    ) {
        this.authService = authService;
        this.characterService = characterService;
        this.characterRepository = characterRepository; // Store repository
    }

    async handleRegister(ws: WebSocket, payload: unknown): Promise<void> {
        console.log('Handling register request');
        // Use the schema for validation
        if (!validatePayload(payload, RegisterPayloadSchema)) {
            send(ws, { type: 'error', payload: { message: 'Invalid registration payload' } });
            console.warn('Invalid registration payload received:', payload);
            return;
        }
        // Payload is now confirmed to be RegisterPayload
        const registerData = payload as RegisterPayload;

        // Mask password before logging
        const { username } = registerData;
        console.log(`Registration attempt for username: ${username}`);


        try {
            const result = await this.authService.registerUser(username, registerData.password);
            if (result.success) {
                send(ws, { type: 'register_success', payload: { message: 'Registration successful. Please log in.' } });
                console.log(`User registered successfully: ${username}`);
            } else {
                send(ws, { type: 'error', payload: { message: result.message } });
                console.warn(`Registration failed for ${username}: ${result.message}`);
            }
        } catch (error) {
            console.error('Error during registration:', error);
            send(ws, { type: 'error', payload: { message: 'An internal error occurred during registration.' } });
        }
    }

    async handleLogin(ws: WebSocket, payload: unknown): Promise<void> {
        console.log('Handling login request');
        // Use the schema for validation
        if (!validatePayload(payload, LoginPayloadSchema)) {
            send(ws, { type: 'error', payload: { message: 'Invalid login payload' } });
            console.warn('Invalid login payload received:', payload);
            return;
        }
        // Payload is now confirmed to be LoginPayload
        const loginData = payload as LoginPayload;

        // Mask password before logging
        const { username } = loginData;
        console.log(`Login attempt for username: ${username}`);

        // Check if user is already logged in elsewhere
        for (const [existingWs, connectionData] of activeConnections.entries()) {
            if (connectionData.username === username && existingWs !== ws) {
                send(ws, { type: 'error', payload: { message: 'User already logged in on another connection.' } });
                console.warn(`Login failed for ${username}: Already logged in.`);
                return;
            }
        }

        try {
            const result = await this.authService.loginUser(username, loginData.password);
            if (result.success && result.user) {
                const userId = result.user.id;
                // Associate userId with the connection
                activeConnections.set(ws, { userId: userId, username: username, selectedCharacterId: null });
                console.log(`User logged in successfully: ${username} (ID: ${userId})`);

                // Fetch characters for the user
                const charactersResult = await this.characterService.getCharactersByUserId(userId);
                let characters: CharacterSummary[] = [];
                if (charactersResult.success && charactersResult.characters) {
                    // Format characters into CharacterSummary for the frontend
                    // Add explicit type 'Character' to 'char' parameter
                    characters = charactersResult.characters.map((char: Character) => ({
                        id: char.id,
                        name: char.name,
                        class: char.class, // Assuming class is stored as a string ID/name
                        level: char.level
                    }));
                    console.log(`Found ${characters.length} characters for user ${username}`);
                } else {
                    console.warn(`Could not fetch characters for user ${username}: ${charactersResult.message}`);
                    // Proceed with login, but character list will be empty
                }

                // Send success message with user details and character list
                const userWithoutPassword = result.user;
                send(ws, {
                    type: 'login_success',
                    payload: {
                        user: userWithoutPassword,
                        characters: characters, // Add the character list
                        message: 'Login successful.'
                    }
                });

                // Optionally broadcast login event to others if needed (e.g., for presence)
                // broadcast({ type: 'user_logged_in', username: username }, ws); // Example broadcast

            } else {
                send(ws, { type: 'error', payload: { message: result.message } });
                console.warn(`Login failed for ${username}: ${result.message}`);
            }
        } catch (error) {
            console.error('Error during login:', error);
            send(ws, { type: 'error', payload: { message: 'An internal error occurred during login.' } });
        }
    }

    async handleLogout(ws: WebSocket): Promise<void> { // Make async
        const connectionData = activeConnections.get(ws);
        if (connectionData) {
            const { username, userId, selectedCharacterId } = connectionData;
            console.log(`Handling logout request for user: ${username} (ID: ${userId})`);

            // --- Record Logout Timestamp ---
            if (selectedCharacterId) {
                try {
                    const timestamp = Date.now();
                    await this.characterRepository.update(selectedCharacterId, { lastLogoutTimestamp: timestamp });
                    console.log(`AuthHandler: Recorded logout timestamp ${timestamp} for character ${selectedCharacterId}`);
                } catch (error) {
                    console.error(`AuthHandler: Failed to record logout timestamp for character ${selectedCharacterId}:`, error);
                    // Log error but continue logout process
                }
            } else {
                console.log(`AuthHandler: No character selected for user ${username}, skipping timestamp recording.`);
            }
            // --- End Timestamp Recording ---

            activeConnections.delete(ws);
            console.log(`User logged out: ${username}`);
            // Optionally broadcast logout event
            // broadcast({ type: 'user_logged_out', username: username }, ws); // Example broadcast
            send(ws, { type: 'logout_success', payload: { message: 'You have been logged out.' } });
        } else {
            console.warn('Received logout request from connection without active session.');
            // Optionally send an error or just ignore
            send(ws, { type: 'error', payload: { message: 'You are not logged in.' } });
        }
    }
}
