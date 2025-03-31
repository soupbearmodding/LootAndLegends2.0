import WebSocket from 'ws';
import { validatePayload, RegisterPayloadSchema, LoginPayloadSchema } from '../validation.js'; // Import schemas
import { broadcast, send } from '../websocketUtils.js'; // Assuming websocketUtils exists or will be created
import { activeConnections } from '../server.js'; // Assuming activeConnections is exported from server
import { AuthService } from '../services/authService.js'; // To be created
import { UserRepository } from '../repositories/userRepository.js'; // Assuming UserRepository exists
import { LoginPayload, RegisterPayload } from '../types.js'; // Keep type imports for casting

// TODO: Instantiate AuthService, likely requires UserRepository
// const userRepository = new UserRepository(/* db connection or path */);
// const authService = new AuthService(userRepository);

export class AuthHandler {
    private authService: AuthService;

    constructor(authService: AuthService) {
        this.authService = authService;
    }

    async handleRegister(ws: WebSocket, payload: unknown): Promise<void> {
        console.log('Handling register request');
        // Use the schema for validation
        if (!validatePayload(payload, RegisterPayloadSchema)) {
            send(ws, { type: 'error', message: 'Invalid registration payload' });
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
                send(ws, { type: 'register_success', message: 'Registration successful. Please log in.' });
                console.log(`User registered successfully: ${username}`);
            } else {
                send(ws, { type: 'error', message: result.message });
                console.warn(`Registration failed for ${username}: ${result.message}`);
            }
        } catch (error) {
            console.error('Error during registration:', error);
            send(ws, { type: 'error', message: 'An internal error occurred during registration.' });
        }
    }

    async handleLogin(ws: WebSocket, payload: unknown): Promise<void> {
        console.log('Handling login request');
        // Use the schema for validation
        if (!validatePayload(payload, LoginPayloadSchema)) {
            send(ws, { type: 'error', message: 'Invalid login payload' });
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
                send(ws, { type: 'error', message: 'User already logged in on another connection.' });
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

                // Send success message with user details (excluding password hash)
                const { passwordHash, ...userWithoutPassword } = result.user;
                send(ws, {
                    type: 'login_success',
                    user: userWithoutPassword,
                    message: 'Login successful.'
                });

                // Optionally broadcast login event to others if needed (e.g., for presence)
                // broadcast({ type: 'user_logged_in', username: username }, ws); // Example broadcast

            } else {
                send(ws, { type: 'error', message: result.message });
                console.warn(`Login failed for ${username}: ${result.message}`);
            }
        } catch (error) {
            console.error('Error during login:', error);
            send(ws, { type: 'error', message: 'An internal error occurred during login.' });
        }
    }

    handleLogout(ws: WebSocket): void {
        const connectionData = activeConnections.get(ws);
        if (connectionData) {
            const { username, userId } = connectionData;
            console.log(`Handling logout request for user: ${username} (ID: ${userId})`);
            activeConnections.delete(ws);
            console.log(`User logged out: ${username}`);
            // Optionally broadcast logout event
            // broadcast({ type: 'user_logged_out', username: username }, ws); // Example broadcast
            send(ws, { type: 'logout_success', message: 'You have been logged out.' });
        } else {
            console.warn('Received logout request from connection without active session.');
            // Optionally send an error or just ignore
            send(ws, { type: 'error', message: 'You are not logged in.' });
        }
    }
}
