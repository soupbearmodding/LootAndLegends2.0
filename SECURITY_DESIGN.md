# Loot & Legends - Security Design Document

## 1. Overview & Philosophy

The core security philosophy of Loot & Legends relies on a **server-authoritative model**. The server is the single source of truth for all game state, calculations, and actions. Clients send requests to perform actions, but the server validates these requests and executes the logic independently, preventing clients from directly manipulating critical game data like stats, inventory, or combat outcomes.

We are implementing a **layered architecture** (Handlers, Services, Repositories) to further enhance security and maintainability by clearly separating concerns:
*   **Handlers (Application Layer):** Validate incoming requests, orchestrate actions, and format responses.
*   **Services (Domain Layer):** Contain and enforce core game/business logic and rules.
*   **Repositories (Persistence Layer):** Abstract and isolate all direct database interactions.

## 2. Authentication & Authorization

*   **User Registration:**
    *   Requires a unique username and a password meeting length requirements.
    *   Passwords are securely hashed using `bcrypt` (SALT_ROUNDS = 10) before storing in the database. Plaintext passwords are never stored.
    *   Payload validation ensures username and password are provided and meet basic criteria.
*   **User Login:**
    *   Requires username and password.
    *   Payload validation ensures username and password are provided.
    *   Server compares the provided password against the stored hash using `bcrypt.compare`.
    *   A `userId` is associated with the active WebSocket connection upon successful login (`activeConnections` map).
    *   Prevents multiple simultaneous logins for the same user account.
*   **Action Authorization:**
    *   Most game actions (character selection/creation/deletion, inventory management, travel, combat initiation) require a valid `userId` and often a `selectedCharacterId` associated with the WebSocket connection in the `activeConnections` map.
    *   Handlers consistently check for this association before proceeding.
    *   Character-specific actions (e.g., delete, select) verify that the requested `characterId` belongs to the authenticated `userId` by cross-referencing database records.

## 3. Network Layer Security

*   **WebSocket Communication:** All client-server communication occurs over WebSockets.
*   **Payload Validation:**
    *   All message handlers (e.g., `handlers/characterHandler.ts`, `auth.ts`, `inventory.ts`, etc.) perform strict validation on incoming message payloads *before* passing data to services.
    *   Checks include verifying the payload is an object (not null), required properties exist, data types are correct (e.g., string, number), and values are within expected ranges or formats (e.g., non-empty strings, specific enum values like slot names or stat keys).
    *   Invalid payloads are rejected early by the handler with an error message sent to the client, and a warning is logged on the server.
*   **Rate Limiting:**
    *   Implemented in `server.ts` to limit the number of messages a single client can send within a defined time window (currently 10 messages per 1 second).
    *   Uses an in-memory map (`rateLimitTracker`) to track message counts per connection.
    *   Messages exceeding the limit are ignored, and a warning is logged server-side. This helps mitigate basic DoS flooding attempts.

## 4. Game Logic & State Management

*   **Server-Side Calculations (Services):** All critical game calculations are performed exclusively within server-side **Services** (e.g., `CharacterService`, `CombatService`):
    *   Combat damage (player and monster)
    *   Attack speed
    *   Experience point rewards and level-up logic (`CharacterService.addExperience`)
    *   Character stats and derived stats (Max HP/Mana)
    *   Loot generation (`LootService` / `lootGenerator.ts`)
    *   Item effects, equipping logic (`InventoryService`)
    *   Potion effects
*   **State Authority & Persistence (Repositories):** The server maintains the authoritative game state:
    *   Character and User data is loaded from the database via **Repositories** (e.g., `CharacterRepository.findById`) before actions are processed by Services.
    *   Changes to persistent state are saved back to the database exclusively through **Repositories** (e.g., `CharacterRepository.save`, `UserRepository.updateCharacterList`) after Service logic completes successfully.
    *   Transient state like active combat encounters (`activeEncounters` map) remains managed server-side (e.g., in `server.ts` or dedicated state managers).
    *   Combat timing is controlled by server-side `setInterval` loops.
*   **Sanity Checks:**
    *   Core calculation functions include checks to clamp results within reasonable bounds (e.g., stats and XP cannot be negative, Max HP must be >= 1, damage dealt is >= 1).
    *   These checks prevent extreme values resulting from unexpected data combinations or potential formula bugs.

## 5. Data Integrity

*   **Startup Validation (`validation.ts`):**
    *   A comprehensive validation process runs when the server starts (`validateGameData` called in `server.ts`).
    *   It checks the integrity and consistency of core static game data loaded from `gameData.ts` and `lootData.ts`, including:
        *   Zones (IDs, names, levels, connections, monster refs)
        *   Monsters (IDs, names, levels, stats, HP, damage, speed, loot table refs)
        *   Character Classes (names, stats)
        *   Items (baseIds, names, types, slots, stats)
        *   Loot Tables (entry format, item refs, chances, quantities)
    *   Checks include data types, value ranges (non-negative numbers, probabilities 0-1), and references between data sets (e.g., zone monsters exist, loot table items exist).
    *   If any validation errors are found, details are logged, and the server startup is aborted to prevent running with invalid data.

## 6. Logging

*   **Secure Logging:** Passwords in incoming 'login' or 'register' messages are masked ('********') before being logged.
*   **Enhanced Action Logging:** Added detailed log messages for critical events:
    *   User login/logout/registration
    *   Character creation/selection/deletion (including IDs, names, classes)
    *   Inventory actions (equip, unequip, sell, potion use/assignment - including item/character IDs)
    *   Combat events (encounter start, player/monster attacks with damage, monster defeat, XP gain, level ups, loot drops, player death/respawn - including relevant IDs).
*   **Warnings:** Specific warnings are logged for events like rate limit exceeded, invalid payloads, failed DB updates, or data inconsistencies.

## 7. Database Security (Infrastructure)

*   While outside the application code itself, it is crucial to follow database security best practices:
    *   Use strong, unique credentials for the MongoDB user accessed by the server.
    *   Configure network access rules (firewalls) so that only the game server application can connect to the database instance.
    *   Implement regular database backups.

## 8. Future Considerations

*   **Input Sanitization:** While strict validation is in place, explicitly sanitizing string inputs (e.g., character names) against potential injection patterns could be added as an extra layer.
*   **More Sophisticated Rate Limiting:** Implement more advanced rate limiting, potentially with different limits for different message types or temporary bans for abusive clients.
*   **Session Management:** Consider more robust session management if JWTs or similar tokens are introduced later, including secure handling and expiration.
*   **Dependency Security:** Regularly audit third-party dependencies (npm packages) for known vulnerabilities.
*   **Complete Refactoring:** Finish refactoring all modules (Auth, Inventory, Combat, Zone, etc.) to fully adhere to the layered architecture (Handlers, Services, Repositories) to maximize separation of concerns and associated security benefits.
