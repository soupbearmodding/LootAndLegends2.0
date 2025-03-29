# Loot & Legends - Design Document

## 1. Overview

Loot & Legends is a UI-heavy RPG built with TypeScript and Electron. It features a client-server architecture where the server acts as the single source of truth for all game state and logic, ensuring security and consistency. The client is responsible for rendering the UI, displaying game information, handling user input, and communicating with the server via WebSockets.

## 2. Technology Stack

*   **Client:** Electron, TypeScript, HTML, CSS
*   **Server:** Node.js, TypeScript
*   **Communication:** WebSockets (`ws` library)
*   **Data Persistence:** MongoDB (`mongodb` driver)

## 3. Core Architecture

*   **Server-Authoritative:** All game actions (combat, movement, item usage, etc.) are validated and processed by the server. The client sends requests to the server, and the server responds with the updated game state.
*   **Real-time Communication:** WebSockets are used for continuous communication between the client and server.
*   **Modular Server:** The server logic is broken down into smaller, manageable modules (auth, character, combat, zone, gameData, types, utils).

## 4. Key Features (Implemented)

*   **User Authentication:** Secure login and registration using bcrypt for password hashing.
*   **Character Creation & Selection:** Players can create characters with a chosen class and name, and select from their existing characters.
*   **Zone System:** Static zone data defined on the server. Players can navigate between connected zones, respecting level requirements.
*   **Basic Auto-Combat:** Automatic combat encounters start when entering non-town zones. Player and monster exchange attacks at fixed intervals. Basic HP/XP updates are handled. Player death and monster defeat end the encounter.
*   **Database Integration:** MongoDB stores user and character data.
*   **Client-Server Communication:** WebSocket connection established via Electron's main process. Renderer process sends/receives messages for game actions.
*   **Basic UI:** Functional UI for login, character selection/creation, and the main game view (showing character/zone info, combat status, travel options).

## 5. Planned Features / Next Steps

*   **UI Overhaul:** Improve the visual design significantly, moving away from the current basic look. Explore UI frameworks (React, Vue, Svelte) or advanced CSS techniques.
*   **UI Feedback:** Replace `console.log` messages with proper UI elements for status updates, errors, combat logs, etc.
*   **Combat Enhancements:**
    *   Skills and abilities.
    *   More complex damage calculation (using stats, gear).
    *   Loot drops.
    *   Status effects.
*   **Inventory System:** Manage items, equip gear.
*   **NPCs & Quests:** Add non-player characters and a questing system.
*   **Chat System:** Implement basic in-game chat.
*   **Persistence:** Save/load more game state details (inventory, quests, etc.).

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
12. **UI Overhaul & Polish:** Redesign the UI for a better look and feel. Implement proper UI feedback mechanisms. *(Next Major Focus)*
13. **Combat Enhancements:** Add skills, loot, etc.
14. **Inventory System:** Implement inventory management.
15. **Build & Deployment:** Configure Electron builds for distribution.

## 7. Design Document Maintenance

This document will be updated after each major feature implementation or architectural decision to reflect the current state of the project.
Never run the "npm start" commands for client or server, just end the prompt as complete if you think it's complete.
