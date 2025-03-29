import React, { useState, useEffect, useCallback } from 'react';
// Removed import { connectWebSocket, sendToServer } from './renderer';

import LoginScreen from './components/LoginScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import InGameScreen from './components/InGameScreen';

// TODO: Import types properly
type EquipmentSlot = 'head' | 'chest' | 'legs' | 'feet' | 'mainHand' | 'offHand' | 'ring1' | 'ring2' | 'amulet';

// Define UI states (similar to before)
type UIState = 'login' | 'register' | 'character_select' | 'in_game';

// --- WebSocket Connection Logic (Now defined within App or could be in a hook/context) ---
const serverUrl = 'ws://localhost:3001';
let cleanupWsListener: (() => void) | null = null;
let cleanupStatusListener: (() => void) | null = null;

// Function to send messages
async function sendToServer(type: string, payload: any) {
     try {
         // Use window.electronAPI directly
         const result = await window.electronAPI.invoke('send-ws-message', { type, payload });
         if (!result.success) {
             console.error('Failed to send message to server:', result.message);
             // TODO: Display error message in the UI
         }
         return result;
     } catch (error) {
         console.error('Error invoking send-ws-message:', error);
         // TODO: Display error message in the UI
         return { success: false, message: `IPC Error: ${error}` };
     }
}

// Function to connect
function connectWebSocket(
    setStatus: (status: { text: string; isConnected: boolean }) => void,
    handleMessage: (message: any) => void
) {
    console.log(`Attempting to connect to WebSocket server at ${serverUrl}...`);
    setStatus({ text: 'Connecting...', isConnected: false });

    // Clean up old listeners before creating new ones
    if (cleanupWsListener) cleanupWsListener();
    if (cleanupStatusListener) cleanupStatusListener();

    // Use window.electronAPI directly
    window.electronAPI.invoke('connect-ws', { url: serverUrl })
        .then(result => {
            console.log('WebSocket connection initiated via main process:', result);
            setStatus({ text: 'Connection attempt sent.', isConnected: false });

            cleanupWsListener = window.electronAPI.on('ws-message', handleMessage);
            cleanupStatusListener = window.electronAPI.on('ws-connect-status', (status: { connected: boolean; error?: string }) => {
                console.log('WebSocket Connection Status Update:', status);
                if (status.connected) {
                    setStatus({ text: 'Connected', isConnected: true });
                } else {
                    setStatus({ text: `Disconnected${status.error ? ': ' + status.error : ''}`, isConnected: false });
                }
            });
        })
        .catch(error => {
            console.error('Failed to initiate WebSocket connection via main process:', error);
            setStatus({ text: `Connection Error: ${error.message || error}`, isConnected: false });
        });
}


function App() {
    // --- State Management ---
    const [uiState, setUiState] = useState<UIState>('login');
    const [userId, setUserId] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [characters, setCharacters] = useState<any[]>([]);
    const [selectedCharacterData, setSelectedCharacterData] = useState<any | null>(null);
    const [currentZoneData, setCurrentZoneData] = useState<any | null>(null);
    // const [availableZones, setAvailableZones] = useState<any[]>([]); // Replaced by allZones
    const [allZones, setAllZones] = useState<any[]>([]); // Store all zones
    const [currentEncounter, setCurrentEncounter] = useState<any | null>(null);
    const [wsStatus, setWsStatus] = useState<{ text: string; isConnected: boolean }>({ text: 'Idle', isConnected: false });
    const [serverMessages, setServerMessages] = useState<string[]>([]); // For displaying messages

    // --- WebSocket Message Handling ---
    const handleServerMessage = useCallback((message: any) => {
        console.log('Message received in App:', message);
        setServerMessages(prev => [...prev, `Server: ${JSON.stringify(message)}`]); // Add message for display

        // Update state based on message type (logic moved from old renderer)
        switch (message.type) {
            case 'message':
                setWsStatus({ text: 'Connected', isConnected: true }); // Update status on welcome
                break;
            case 'register_success':
                console.log(`Registration successful! User ID: ${message.payload.userId}. Please log in.`);
                // Optionally show a success message before switching back to login
                setUiState('login');
                break;
            case 'register_fail':
                console.error(`Registration failed: ${message.payload}`);
                // TODO: Display error message in the UI
                break;
            case 'login_success':
                console.log(`Login successful! Welcome ${message.payload.username}`);
                setUserId(message.payload.userId);
                setUsername(message.payload.username);
                setCharacters(message.payload.characters || []);
                setUiState('character_select');
                break;
            case 'login_fail':
                console.error(`Login failed: ${message.payload}`);
                 // TODO: Display error message in the UI
                break;
            case 'create_character_success':
                 console.log(`Character ${message.payload.name} created!`);
                 // Expecting character_list_update to refresh list
                 break;
            case 'create_character_fail':
                 console.error(`Character creation failed: ${message.payload}`);
                 // TODO: Display error message in the UI
                 break;
            case 'travel_success':
                 console.log('Travel successful:', message.payload);
                 setSelectedCharacterData(message.payload.characterData); // Update character data (includes zoneKills)
                 setCurrentZoneData(message.payload.zoneData);
                 // Available zones are now determined client-side based on allZones and character data
                 // setAvailableZones(message.payload.availableZones || []); // No longer needed from server on travel
                 setCurrentEncounter(null);
                 console.log(message.payload.message);
                 // UI already in 'in_game', state update triggers re-render
                 break;
            case 'travel_fail':
                 console.error(`Travel failed: ${message.payload}`);
                 // TODO: Display error message in the UI
                 break;
            case 'combat_update':
                 console.log('Combat update:', message.payload);
                 if (message.payload.monsterUpdate) {
                     setCurrentEncounter((prev: any) => prev ? { ...prev, currentHp: message.payload.monsterUpdate.currentHp } : null);
                 }
                 if (message.payload.characterUpdate) {
                     setSelectedCharacterData((prev: any) => prev ? {
                         ...prev,
                         currentHp: message.payload.characterUpdate.currentHp,
                         experience: message.payload.characterUpdate.experience ?? prev.experience
                     } : null);
                 }
                 // TODO: Display combat log messages
                 break;
            case 'player_death':
                 console.log('Player defeated:', message.payload);
                 if (message.payload.characterUpdate) {
                     setSelectedCharacterData((prev: any) => prev ? {
                         ...prev,
                         currentHp: message.payload.characterUpdate.currentHp,
                         currentZoneId: message.payload.characterUpdate.currentZoneId, // Update zone ID on death
                         // Update level/xp/nextXP in case of penalties (or just to sync)
                         level: message.payload.characterUpdate.level ?? prev.level,
                         experience: message.payload.characterUpdate.experience ?? prev.experience,
                         xpToNextLevel: message.payload.characterUpdate.xpToNextLevel ?? prev.xpToNextLevel,
                     } : null);
                     // Update the current zone data based on the new zone ID
                     const newZoneData = allZones.find(z => z.id === message.payload.characterUpdate.currentZoneId);
                     setCurrentZoneData(newZoneData || null);
                 }
                 setCurrentEncounter(null);
                 // TODO: Display death message more prominently?
                 break;
            case 'encounter_start':
                 console.log('Encounter started:', message.payload);
                 setCurrentEncounter(message.payload.monster);
                 break;
            case 'encounter_end':
                 console.log('Encounter ended:', message.payload);
                 if (message.payload.characterUpdate) {
                     const update = message.payload.characterUpdate;
                     setSelectedCharacterData((prev: any) => {
                         if (!prev) return null;
                         const newState = {
                             ...prev,
                             experience: update.experience ?? prev.experience,
                             zoneKills: update.zoneKills ?? prev.zoneKills,
                             xpToNextLevel: update.xpToNextLevel ?? prev.xpToNextLevel, // Update xpToNextLevel
                         };
                         // If leveled up, update level, stats, hp etc.
                         if (update.leveledUp) {
                             newState.level = update.level ?? prev.level;
                             newState.stats = update.stats ?? prev.stats;
                             newState.maxHp = update.maxHp ?? prev.maxHp;
                             newState.currentHp = update.currentHp ?? prev.currentHp;
                             // TODO: Display level up notification/animation?
                             console.log("LEVEL UP! New stats:", update.stats);
                         }
                         return newState;
                      });
                  }
                  setCurrentEncounter(null);
                  // Log received loot
                  if (message.payload.loot && Array.isArray(message.payload.loot) && message.payload.loot.length > 0) {
                      console.log("Received Loot:", message.payload.loot);
                      // Optionally add to serverMessages for basic UI feedback
                      const lootMessage = `Loot: ${message.payload.loot.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')}`;
                 setServerMessages(prev => [...prev, lootMessage]);
                  }
                  break;
            case 'character_update': // Handle general character updates (e.g., after equip/unequip)
                 console.log('Character update received:', message.payload);
                 setSelectedCharacterData(message.payload); // Update the whole character data
                 break;
            case 'select_character_success':
                console.log('Character selected successfully on server:', message.payload);
                setSelectedCharacterData(message.payload.characterData); // Includes zoneKills
                setCurrentZoneData(message.payload.currentZoneData); // Use currentZoneData
                setAllZones(message.payload.allZones || []); // Store all zones
                setCurrentEncounter(null);
                console.log(message.payload.message);
                setUiState('in_game'); // Change state after server confirmation
                break;
            case 'select_character_fail':
                console.error(`Character selection failed: ${message.payload}`);
                // TODO: Display error message in the UI
                break;
            case 'character_list_update':
                 console.log('Received updated character list:', message.payload);
                 setCharacters(message.payload || []);
                 break;
            case 'error':
                console.error('Server error message:', message.payload);
                // TODO: Display error message in the UI
                break;
            // Add more cases as needed
        }
    }, []); // Empty dependency array means this function is created once

    // --- WebSocket Connection Effect ---
    useEffect(() => {
        connectWebSocket(setWsStatus, handleServerMessage);
        // TODO: Add cleanup for listeners when component unmounts?
        // The current connectWebSocket handles cleanup internally on reconnect,
        // but a cleanup function returned here might be cleaner for component unmount.
    }, [handleServerMessage]); // Re-run if handleServerMessage changes (it shouldn't due to useCallback)

    // --- Action Handlers (Passed down to components) ---
    const handleLogin = (user: string, pass: string) => {
        sendToServer('login', { username: user, password: pass });
    };

    const handleRegister = (user: string, pass: string) => {
        sendToServer('register', { username: user, password: pass });
    };

    const handleLogout = () => {
        console.log("Logging out...");
        // Reset all relevant state
        setUserId(null);
        setUsername(null);
        setCharacters([]);
        setSelectedCharacterData(null);
        setCurrentZoneData(null);
        // setAvailableZones([]); // Replaced by allZones
        setAllZones([]);
        setCurrentEncounter(null);
        setUiState('login');
        // TODO: Consider sending a logout message to the server?
        // TODO: Disconnect WebSocket? Or rely on server timeout?
    };

    const handleCreateCharacter = (name: string, classId: string) => {
        sendToServer('create_character', { name, classId });
    };

    const handleSelectCharacter = (characterId: string) => {
        sendToServer('select_character', { characterId });
    };

    const handleTravel = (targetZoneId: string) => {
        sendToServer('travel', { targetZoneId });
    };

    const handleEquipItem = (itemId: string) => {
        console.log(`App: Requesting equip item ${itemId}`);
        sendToServer('equip_item', { itemId });
    };

    const handleUnequipItem = (slot: EquipmentSlot) => {
        console.log(`App: Requesting unequip item from slot ${slot}`);
        sendToServer('unequip_item', { slot });
    };

    // --- Render Logic ---
    const renderCurrentScreen = () => {
        switch (uiState) {
            case 'login':
            case 'register':
                return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
            case 'character_select':
                return <CharacterSelectScreen
                            username={username}
                            characters={characters}
                            onSelect={handleSelectCharacter}
                            onCreate={handleCreateCharacter}
                            onLogout={handleLogout}
                       />;
            case 'in_game':
                return <InGameScreen
                            character={selectedCharacterData}
                            zone={currentZoneData}
                            allZones={allZones} // Pass allZones instead
                            encounter={currentEncounter}
                            onTravel={handleTravel}
                            onLogout={handleLogout}
                            onEquipItem={handleEquipItem} // Pass down equip handler
                            onUnequipItem={handleUnequipItem} // Pass down unequip handler
                       />;
            default:
                return <div>Error: Unknown UI State</div>;
        }
    };

    return (
        <div className="App">
            {/* Optional: Display WS Status and Messages for debugging */}
            <div id="ws-status-container" style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.7)', padding: '5px', fontSize: '12px', color: wsStatus.isConnected ? 'lightgreen' : 'lightcoral' }}>
                WS: {wsStatus.text}
                {!wsStatus.isConnected && <button onClick={() => connectWebSocket(setWsStatus, handleServerMessage)} style={{ marginLeft: '5px' }}>Reconnect</button>}
            </div>
            {/* <div id="ws-messages" style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid grey', margin: '5px', padding: '5px', fontSize: '10px' }}>
                <h3>Server Messages</h3>
                {serverMessages.map((msg, index) => <p key={index}>{msg}</p>)}
            </div> */}

            {renderCurrentScreen()}
        </div>
    );
}

export default App;
