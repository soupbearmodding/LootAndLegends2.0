# Loot & Legends

Loot & Legends is a UI-heavy RPG built with TypeScript and Electron. It features a client-server architecture where the server acts as the single source of truth for all game state and logic, ensuring security and consistency. The client renders the UI, handles user input, and communicates with the server via WebSockets.

## Technology Stack

*   **Client:** Electron, TypeScript, React, Vite, HTML, CSS
*   **Server:** Node.js (ES Module), TypeScript
*   **Communication:** WebSockets (`ws` library)
*   **Data Persistence:** MongoDB (`mongodb` driver)
*   **Password Hashing:** `bcrypt`

## Core Architecture

*   **Server-Authoritative:** All game actions (combat, movement, item usage, etc.) are validated and processed exclusively by the server. Clients send requests, and the server responds with the updated game state. This prevents cheating by manipulating client-side data.
*   **Real-time Communication:** WebSockets provide a persistent, low-latency connection for continuous updates between the client and server.
*   **Modular Server:** Server-side logic is organized into distinct modules (e.g., `auth`, `character`, `combat`, `inventory`, `zone`) for better maintainability.
*   **Client Structure:** The Electron client uses a main process for window management and WebSocket connection setup, and a renderer process (built with React and Vite) for the user interface. A preload script securely exposes necessary Node.js/Electron APIs to the renderer.

## Key Features (Implemented)

*   **User Authentication:** Secure login and registration with hashed passwords.
*   **Character Management:** Create characters with a chosen class and name, select from existing characters, and delete characters.
*   **Zone System:** Navigate between static, interconnected zones with level requirements.
*   **Basic Auto-Combat:** Automatic combat encounters in non-town zones with basic HP/XP updates, player death, and monster defeat.
*   **Database Integration:** MongoDB stores user accounts and character data.
*   **Client-Server Communication:** Robust WebSocket messaging system with payload validation.
*   **Basic UI:** Functional screens for login, character selection/creation, and the main game view (character info, zone details, combat status, travel options).
*   **Rate Limiting:** Basic protection against message flooding from clients.
*   **Game Data Validation:** Server validates core game data (items, monsters, zones) on startup to ensure integrity.

## Prerequisites

*   [Node.js](https://nodejs.org/) (includes npm)
*   [MongoDB](https://www.mongodb.com/try/download/community) (running instance accessible to the server)

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd LootAndLegends # Or your project root directory
    ```

2.  **Install Server Dependencies:**
    ```bash
    cd server
    npm install
    cd ..
    ```

3.  **Install Client Dependencies:**
    ```bash
    cd client
    npm install
    cd ..
    ```

4.  **Configure MongoDB:**
    *   Ensure your MongoDB instance is running.
    *   The server connects to MongoDB using the connection string specified in the `MONGODB_URI` environment variable.
    *   **If `MONGODB_URI` is not set, it defaults to `mongodb://localhost:27017`.** The database name used is `loot_and_legends`.
    *   If your MongoDB server is running elsewhere or requires authentication, you'll need to set the `MONGODB_URI` environment variable accordingly (e.g., by creating a `.env` file in the `server/` directory and using a library like `dotenv`, or by setting it directly in your shell).
        ```bash
        # Example for setting the variable in your shell (Linux/macOS)
        export MONGODB_URI="mongodb://user:password@host:port/loot_and_legends"

        # Example for setting the variable in your shell (Windows CMD)
        set MONGODB_URI="mongodb://user:password@host:port/loot_and_legends"

        # Example for a .env file in server/ (requires code changes to load it)
        MONGODB_URI="mongodb://user:password@host:port/loot_and_legends"
        ```

## Running the Application

You need to run both the server and the client.

**1. Run the Server:**

*   **Development (with auto-rebuild on changes):**
    ```bash
    cd server
    npm run dev
    ```
*   **Production:**
    ```bash
    cd server
    npm run build
    npm start
    ```
    The server will typically run on port 3001 (check `server/src/server.ts`).

**2. Run the Client:**

*   **Development (using Vite's hot-reloading):**
    ```bash
    cd client
    npm run dev
    ```
    This will likely open the Electron app automatically.
*   **Production (requires building first):**
    ```bash
    cd client
    npm run build
    npm start
    ```

## Project Structure

```
.
├── client/         # Electron client application (React UI)
│   ├── src/        # Client source code (TypeScript, React components)
│   ├── index.html  # HTML entry point for Vite
│   ├── main.js     # Electron main process entry point (after build)
│   ├── preload.js  # Electron preload script (after build)
│   ├── package.json
│   └── vite.config.ts
│
├── server/         # Node.js server application
│   ├── src/        # Server source code (TypeScript modules)
│   ├── dist/       # Compiled JavaScript output
│   └── package.json
│
├── DESIGN_DOC.md   # Project design overview
├── SECURITY_DESIGN.md # Security considerations
└── README.md       # This file
```

## Security Overview

*   **Server-Authoritative:** The server is the source of truth, preventing client-side manipulation.
*   **Input Validation:** All incoming WebSocket messages are strictly validated on the server.
*   **Password Hashing:** User passwords are securely hashed using `bcrypt`.
*   **Rate Limiting:** Basic protection against denial-of-service attacks.
*   See `SECURITY_DESIGN.md` for more details.

## Future Work

The project has several planned features and improvements, including:

*   Significant UI Overhaul and improved feedback mechanisms.
*   Enhanced Combat System (skills, stats, loot drops).
*   Inventory and Equipment System.
*   NPCs and Quests.
*   In-game Chat.
*   See `DESIGN_DOC.md` for the high-level roadmap.
