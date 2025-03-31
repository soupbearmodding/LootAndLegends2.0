# Loot & Legends - Design Document

## 1. Overview

Loot & Legends is a UI-heavy RPG built with TypeScript and Electron. It features a client-server architecture where the server acts as the single source of truth for all game state and logic, ensuring security and consistency. The client is responsible for rendering the UI, displaying game information, handling user input, and communicating with the server via WebSockets.

## 2. Technology Stack

*   **Client:** Electron, TypeScript, React, Tailwind CSS (for styling)
*   **Server:** Node.js, TypeScript
*   **Communication:** WebSockets (`ws` library)
*   **Data Persistence:** MongoDB (`mongodb` driver)

## 3. Core Architecture

*   **Server-Authoritative:** All game actions (combat, movement, item usage, etc.) are validated and processed by the server. The client sends requests to the server, and the server responds with the updated game state.
*   **Real-time Communication:** WebSockets are used for continuous communication between the client and server.
*   **Modular Server:** The server logic is broken down into smaller, manageable modules (auth, character, combat, zone, data loading, types, utils).
*   **Data-Driven Design:** Core game data (items, affixes, loot tables, monsters, zones, character classes, quality weights) is defined in JSON files within `server/data/` and loaded dynamically at runtime. This allows for significant content expansion (like the current ~100 monsters, expanded zones, and loot tables) primarily through data modification.

## 4. Key Features (Implemented)

*   **User Authentication:** Secure login and registration using bcrypt for password hashing.
*   **Character Creation & Selection:** Players can create characters with a chosen class and name, and select from their existing characters. Character class base stats defined in `server/data/characterClasses.json`.
*   **Zone System:** Zone data (connections, monsters, level requirements) defined in `server/data/zones.json`. Players can navigate between connected zones, respecting level requirements. *(Content significantly expanded to include ~40 zones covering levels 1-60).*
*   **Basic Auto-Combat:** Automatic combat encounters start when entering non-town zones. Monster data (stats, level, loot) defined in `server/data/monsters.json`. *(Content significantly expanded to include ~100 monsters covering levels 1-60).* Player and monster exchange attacks at fixed intervals. Basic HP/XP updates are handled. Player death and monster defeat end the encounter. Includes basic loot generation (items, gold, resources) and defense calculation.
*   **Offline Progress (Basic):** Calculates and awards placeholder XP/Gold based on time offline when selecting a character. Records logout time.
*   **Loot & Inventory System (Foundation):** Base items, affixes (prefixes/suffixes), affix tiers, and loot tables defined in JSON files (`server/data/items.json`, `server/data/prefixes.json`, `server/data/suffixes.json`, `server/data/affixTiers.json`, `server/data/lootTables.json`). Item quality weights defined in `server/data/qualityWeights.json`. Loot tables assigned to monsters. *(Loot tables significantly expanded to cover all monster level ranges up to 60).* Basic inventory management (add, stack) and equipping/unequipping implemented. Item stats affect combat calculations.
*   **Passive Resource Gathering:** Monsters drop basic resources (Monster Essence, Scrap Metal) upon defeat. Resources tracked per character.
*   **Simple Crafting:** Basic recipes defined for creating potions. Crafting service/handler implemented. Client UI allows viewing recipes and crafting items using gathered resources.
*   **Item Upgrading (Foundation):** Items track upgrade count/max based on rarity. Service logic allows upgrading affixes on Magic/Rare items or adding a T1 affix to Gray/White items using resources. Basic UI integrated into Crafting Panel.
*   **Database Integration:** MongoDB stores user and character data (including inventory, equipment, resources, item upgrade counts).
*   **Client-Server Communication:** WebSocket connection established via Electron's main process. Renderer process sends/receives messages for game actions.
*   **Basic UI:** Functional UI for login, character selection/creation, main game view (character/zone info, combat, travel), inventory panel, crafting panel (with Upgrade tab). Displays offline gains, loot drops, resources, item upgrade status.

## 5. Planned Features / Next Steps

*   **UI Overhaul:** Improve the visual design significantly, moving away from the current basic look. Explore UI frameworks (React, Vue, Svelte) or advanced CSS techniques.
*   **UI Feedback:** Replace `console.log` messages with proper UI elements for status updates, errors, combat logs, etc.
*   **Loot & Inventory System:** *(Next Major Focus)*
    *   Define item data structures (stats, rarity, slots).
    *   Implement loot generation based on zones/monsters.
    *   Create inventory management logic (add, stack, equip, unequip).
    *   Build client-side UI for inventory display and interaction.
    *   Integrate item stats into combat calculations.
*   **Combat Enhancements:**
    *   Skills and abilities.
    *   More complex damage calculation (using stats, gear - *partially addressed by loot system*).
    *   Status effects.
*   **Offline Progress (Advanced):** Refine calculation based on last zone, character stats, and potentially estimated loot.
*   **NPCs & Quests:** Add non-player characters and a questing system.
*   **Chat System:** Implement basic in-game chat.
*   **Persistence:** Save/load more game state details (quests, etc. - *inventory/equipment covered by Loot system*).

## 6. Development Roadmap (High-Level)

1.  **Project Setup:** Initialize client and server projects, set up TypeScript, Electron basics. **[COMPLETED]**
2.  **Server Foundation:** Basic server setup, WebSocket connection handling. **[COMPLETED]**
3.  **Authentication:** Implement login/registration logic. **[COMPLETED]**
4.  **Character Creation/Selection:** Implement character logic. **[COMPLETED]**
5.  **Persistence:** Integrate MongoDB for users and characters. **[COMPLETED]**
6.  **Client UI - Basic Screens:** Build login, character select/create, main game skeleton. **[COMPLETED]**
7.  **Zone Logic:** Implement zone data and travel logic. **[COMPLETED]**
8.  **Basic Combat Logic:** Implement automatic combat loop, HP/XP updates, death/defeat. **[COMPLETED]**
9.  **Client-Server Integration:** Connect UI elements to server logic for core features. **[COMPLETED]**
10. **Server Refactoring:** Split server logic into modules. **[COMPLETED]**
11. **Remove Client Alerts:** Replace `alert()` calls with console logs. **[COMPLETED]**
12. **Offline Progress (Basic):** Implement server-side calculation/timestamping and client-side display. **[COMPLETED]**
13. **Loot & Inventory System (Foundation):** Implement item data, loot tables, loot generation, basic inventory management (add/stack), equipping/unequipping, stat integration, and basic UI display. **[COMPLETED]**
14. **Passive Resource Gathering:** Implement resource drops from monsters and character tracking. **[COMPLETED]**
15. **Simple Crafting:** Implement basic recipes, crafting service/handler, and client UI for item creation. **[COMPLETED]**
16. **Item Upgrading (Foundation):** Add upgrade tracking to items, implement backend service logic for adding/upgrading affixes, integrate basic UI into crafting panel. **[COMPLETED]**
17. **Tailwind CSS Setup:** Install and configure Tailwind CSS for the client project. **[COMPLETED]** *(Note: Initial attempt with Tailwind v4 failed due to build process issues in the Vite/Electron environment. Downgraded to Tailwind v3.4.17, which resolved the style generation problem.)*
18. **Content Expansion (Monsters, Zones, Loot):** Added ~100 monsters, ~40 zones, and corresponding loot tables covering levels 1-60. **[COMPLETED]**
19. **UI Overhaul & Polish:** Redesign the UI using Tailwind CSS for a better look and feel. Implement proper UI feedback mechanisms (including crafting/upgrade interactions). *(In Progress - Initial styling applied to main game screen: Zones, Stats, Encounter Area)*
20. **Combat Enhancements:** Add skills, status effects, more complex damage formulas.
21. **Build & Deployment:** Configure Electron builds for distribution.

## 7. Design Document Maintenance

This document will be updated after each major feature implementation or architectural decision to reflect the current state of the project.
Never run the "npm start" commands for client or server, just end the prompt as complete if you think it's complete.
