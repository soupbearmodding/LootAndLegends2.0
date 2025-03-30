import React, { useState, useEffect, useCallback, useRef } from 'react';

import LoginScreen from './components/LoginScreen';
import MainMenuScreen from './components/MainMenuScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import CharacterCreateScreen from './components/CharacterCreateScreen';
import InGameScreen from './components/InGameScreen';

import { EquipmentSlot, ItemStats } from './types.js';




interface CharacterClass {
    name: string;
    description: string;
    baseStats: {
        strength: number;
        dexterity: number;
        vitality: number;
        energy: number;
    };
}

interface CharacterSummary {
    id: string;
    name: string;
    class: string;
    level: number;
}


// Define UI states
type ViewState = 'login' | 'mainMenu' | 'createCharacter' | 'selectCharacter' | 'in_game';

// --- Local Game Data (Simulating import from gameData.ts) ---
const characterClasses: Map<string, CharacterClass> = new Map([
    ['warrior', { name: 'Warrior', description: 'Master of weapons and close combat', baseStats: { strength: 30, dexterity: 20, vitality: 25, energy: 10 } }],
    ['rogue', { name: 'Rogue', description: 'Master of ranged combat and traps', baseStats: { strength: 20, dexterity: 30, vitality: 20, energy: 15 } }],
    ['sorcerer', { name: 'Sorcerer', description: 'Master of elemental magic', baseStats: { strength: 15, dexterity: 15, vitality: 20, energy: 35 } }],
    ['monk', { name: 'Monk', description: 'Master of martial arts and holy magic', baseStats: { strength: 25, dexterity: 25, vitality: 20, energy: 15 } }],
    ['barbarian', { name: 'Barbarian', description: 'Master of melee combat and battle cries', baseStats: { strength: 40, dexterity: 20, vitality: 25, energy: 0 } }],
]);


// --- WebSocket Connection Logic ---
const serverUrl = 'ws://localhost:3001';
let cleanupElectronWsListener: (() => void) | null = null;
let cleanupElectronStatusListener: (() => void) | null = null;

// Store the browser WebSocket instance outside the function but within the module scope
// Or better, manage it with useRef inside the App component.
// Let's use useRef inside App.

async function sendToServer(type: string, payload: any, browserWsRef: React.MutableRefObject<WebSocket | null>) {
    if (window.electronAPI) {
        // Electron environment
        try {
            const result = await window.electronAPI.invoke('send-ws-message', { type, payload });
            if (!result.success) {
                console.error('Failed to send message to server via Electron:', result.message);
                // TODO: Display error message in the UI
            }
            return result;
        } catch (error) {
            console.error('Error invoking send-ws-message via Electron:', error);
            // TODO: Display error message in the UI
            return { success: false, message: `IPC Error: ${error}` };
        }
    } else if (browserWsRef.current && browserWsRef.current.readyState === WebSocket.OPEN) {
        // Browser environment
        try {
            browserWsRef.current.send(JSON.stringify({ type, payload }));
            return { success: true }; // Assume success on send for browser
        } catch (error) {
            console.error('Error sending message via browser WebSocket:', error);
            return { success: false, message: `WebSocket Error: ${error}` };
        }
    } else {
        console.error('Cannot send message: No active WebSocket connection.');
        return { success: false, message: 'No active WebSocket connection.' };
    }
}


function connectWebSocket(
    setStatus: (status: { text: string; isConnected: boolean }) => void,
    handleMessage: (message: any) => void,
    browserWsRef: React.MutableRefObject<WebSocket | null>
) {
    console.log(`Attempting to connect to WebSocket server at ${serverUrl}...`);

    // --- Electron Environment ---
    if (window.electronAPI) {
        // Electron logic remains the same
        console.log('Using Electron WebSocket bridge.');
        if (cleanupElectronWsListener) cleanupElectronWsListener();
        if (cleanupElectronStatusListener) cleanupElectronStatusListener();

        window.electronAPI.invoke('connect-ws', { url: serverUrl })
            .then(result => {
                console.log('WebSocket connection initiated via main process:', result);
                setStatus({ text: 'Connection attempt sent.', isConnected: false }); // Initial status

                cleanupElectronWsListener = window.electronAPI.on('ws-message', handleMessage);
                cleanupElectronStatusListener = window.electronAPI.on('ws-connect-status', (status: { connected: boolean; error?: string }) => {
                    console.log('WebSocket Connection Status Update (Electron):', status);
                    if (status.connected) {
                        setStatus({ text: 'Connected (Electron)', isConnected: true });
                    } else {
                        setStatus({ text: `Disconnected (Electron)${status.error ? ': ' + status.error : ''}`, isConnected: false });
                    }
                });
            })
            .catch(error => {
                console.error('Failed to initiate WebSocket connection via main process:', error);
                setStatus({ text: `Connection Error (Electron): ${error.message || error}`, isConnected: false });
            });
    }
    // --- Browser Environment ---
    else {
        // If already connected or connecting, don't start a new connection
        if (browserWsRef.current && (browserWsRef.current.readyState === WebSocket.CONNECTING || browserWsRef.current.readyState === WebSocket.OPEN)) {
             console.log('Browser WebSocket connection attempt skipped: Already connecting or connected.');
             // Ensure status reflects reality
             if (browserWsRef.current.readyState === WebSocket.OPEN) {
                 setStatus({ text: 'Connected (Browser)', isConnected: true });
             } else {
                 setStatus({ text: 'Connecting...', isConnected: false }); // Reflect connecting state
             }
             return; // Exit early
        }

        // Clean up previous instance ONLY if it exists and is NOT connecting/open
        if (browserWsRef.current) {
             console.log(`Cleaning up previous browser WebSocket instance (readyState: ${browserWsRef.current.readyState}).`);
             // Detach handlers to prevent them firing after close/on new instance
             browserWsRef.current.onopen = null;
             browserWsRef.current.onmessage = null;
             browserWsRef.current.onerror = null;
             browserWsRef.current.onclose = null;
             browserWsRef.current.close();
             // Don't set to null here; let the new assignment below overwrite it,
             // or let the onclose handler manage nullifying if needed.
        }

        console.log('Using standard browser WebSocket. Creating new instance.');
        setStatus({ text: 'Connecting...', isConnected: false }); // Set status before creating new WS
        const ws = new WebSocket(serverUrl);
        browserWsRef.current = ws; // Store the new instance immediately

        ws.onopen = () => {
            // Check if this is still the current WebSocket instance before updating status
            if (browserWsRef.current === ws) {
                console.log('Browser WebSocket connected.');
                setStatus({ text: 'Connected (Browser)', isConnected: true });
            } else {
                 console.log('Browser WebSocket connected (but instance is outdated, closing).');
                 ws.close(); // Close the outdated instance
            }
        };

        ws.onmessage = (event) => {
             // Check if this is still the current WebSocket instance before handling message
             if (browserWsRef.current === ws) {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error, 'Data:', event.data);
                }
             } else {
                 console.log('Browser WebSocket received message (but instance is outdated).');
             }
        };

        ws.onerror = (event) => {
             // Check if this is still the current WebSocket instance
             if (browserWsRef.current === ws) {
                console.error('Browser WebSocket error:', event);
                setStatus({ text: 'Connection Error (Browser)', isConnected: false });
             } else {
                 console.log('Browser WebSocket error occurred (but instance is outdated).');
             }
        };

        ws.onclose = (event) => {
             // Check if this is still the current WebSocket instance before updating status and clearing ref
             if (browserWsRef.current === ws) {
                console.log('Browser WebSocket disconnected:', event.code, event.reason);
                setStatus({ text: `Disconnected (Browser)${event.reason ? ': ' + event.reason : ''} (Code: ${event.code})`, isConnected: false });
                browserWsRef.current = null; // Clear the ref only if this instance closed
             } else {
                 console.log('Browser WebSocket closed (but instance was already outdated).');
                 // Do not nullify the ref if it points to a newer instance
             }
        };
    }
}
// --- End WebSocket Logic ---


function App() {
    // --- State Management ---
    const [currentView, setCurrentView] = useState<ViewState>('login');
    const [userId, setUserId] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [characters, setCharacters] = useState<CharacterSummary[]>([]); // Use local type
    const [selectedCharacterData, setSelectedCharacterData] = useState<any | null>(null); // Keep 'any' for now
    const [currentZoneData, setCurrentZoneData] = useState<any | null>(null); // This might become redundant if InGameScreen uses zoneStatuses directly
    const [zoneStatuses, setZoneStatuses] = useState<any[]>([]);
    const [currentEncounter, setCurrentEncounter] = useState<any | null>(null);
    const [wsStatus, setWsStatus] = useState<{ text: string; isConnected: boolean }>({ text: 'Idle', isConnected: false });
    const [serverMessages, setServerMessages] = useState<string[]>([]);
    const browserWsRef = useRef<WebSocket | null>(null); // Ref for browser WebSocket

    // --- WebSocket Message Handling ---
    // Ref to hold the latest version of the message handler callback
    const handleServerMessageRef = useRef<(message: any) => void>(() => {});

    const handleServerMessage = useCallback((message: any) => {
        console.log('Message received in App:', message);
        setServerMessages(prev => [...prev, `Server: ${JSON.stringify(message)}`]);

        switch (message.type) {
            case 'message':
                setWsStatus({ text: 'Connected', isConnected: true });
                break;
            case 'register_success':
                console.log(`Registration successful! User ID: ${message.payload.userId}. Please log in.`);
                setCurrentView('login'); // Stay on login after register success
                // TODO: Show success message on login screen
                break;
            case 'register_fail':
                console.error(`Registration failed: ${message.payload}`);
                // TODO: Display error message on login screen
                break;
            case 'login_success':
                console.log(`Login successful! Welcome ${message.payload.username}`);
                setUserId(message.payload.userId);
                setUsername(message.payload.username);
                // Ensure characters received on login also conform to CharacterSummary
                const receivedChars = message.payload.characters || [];
                const formattedChars: CharacterSummary[] = receivedChars.map((char: any) => ({
                    id: char.id,
                    name: char.name,
                    // Ensure 'class' is a string, similar to create_character_success
                    class: typeof char.class === 'string'
                             ? char.class
                             : (typeof char.class === 'object' && char.class !== null && typeof char.class.name === 'string'
                                ? char.class.name
                                : (typeof char.classId === 'string' ? char.classId : 'Unknown')),
                    level: char.level ?? 1
                }));
                setCharacters(formattedChars);
                setCurrentView('mainMenu'); // Go to Main Menu after login
                break;
            case 'login_fail':
                console.error(`Login failed: ${message.payload}`);
                 // TODO: Display error message on login screen
                break;
            case 'create_character_success':
                 console.log(`Character ${message.payload.name} created!`);
                 // Expecting character_list_update to refresh list, then go to select screen
                 // Or maybe server should send select_character_success immediately after creation?
                 // For now, let's assume we need to manually go to select screen after list updates.
                 // We'll handle this transition in the character_list_update case if needed.
                 // Or better: Go to select screen immediately after creation success.
                 // Construct a valid CharacterSummary object from the payload
                 const newCharPayload = message.payload;
                 const newCharacterSummary: CharacterSummary = {
                     id: newCharPayload.id,
                     name: newCharPayload.name,
                     // Ensure 'class' is a string. Prioritize payload.class if it's a string,
                     // then payload.class.name if it's an object, then payload.classId, fallback to 'Unknown'.
                     class: typeof newCharPayload.class === 'string'
                              ? newCharPayload.class
                              : (typeof newCharPayload.class === 'object' && newCharPayload.class !== null && typeof newCharPayload.class.name === 'string'
                                 ? newCharPayload.class.name
                                 : (typeof newCharPayload.classId === 'string' ? newCharPayload.classId : 'Unknown')),
                     level: newCharPayload.level ?? 1 // Default level if not provided
                 };
                 setCharacters(prev => [...prev, newCharacterSummary]); // Add the correctly formatted summary
                 // --- CHANGE: Immediately select the new character to enter the game ---
                 console.log(`Character created, now selecting character ID: ${newCharacterSummary.id}`);
                 sendToServer('select_character', { characterId: newCharacterSummary.id }, browserWsRef);
                 break;
            case 'create_character_fail':
                 console.error(`Character creation failed: ${message.payload}`);
                 // TODO: Display error message on create screen
                 break;
            case 'delete_character_success':
                 console.log(`Character deleted: ${message.payload.characterId}`);
                 setCharacters(prev => prev.filter(c => c.id !== message.payload.characterId));
                 // Stay on character select screen
                 break;
            case 'delete_character_fail':
                 console.error(`Character deletion failed: ${message.payload}`);
                 // TODO: Display error message on select screen
                 break;
            case 'travel_success':
                 console.log('Travel successful:', message.payload);
                 setSelectedCharacterData(message.payload.characterData);
                 setCurrentZoneData(message.payload.zoneData);
                 setCurrentEncounter(null);
                 console.log(message.payload.message);
                 break;
            case 'travel_fail':
                 console.error(`Travel failed: ${message.payload}`);
                 break;
            // --- NEW: Handle specific attack updates ---
            case 'player_attack_update':
                 console.log('Player attack update:', message.payload);
                 // Update monster health
                 if (message.payload.monsterUpdate) {
                     setCurrentEncounter((prev: any) => prev ? { ...prev, currentHp: message.payload.monsterUpdate.currentHp } : null);
                 }
                 // Optional: Update player resource if attack cost something (e.g., energy)
                 // if (message.payload.playerUpdate) { ... }
                 break;
            case 'monster_attack_update':
                 console.log('Monster attack update:', message.payload);
                 // Update player health
                 if (message.payload.characterUpdate) {
                     setSelectedCharacterData((prev: any) => prev ? { ...prev, currentHp: message.payload.characterUpdate.currentHp } : null);
                 }
                 break;
            case 'player_death':
                 console.log('Player defeated:', message.payload);
                 if (message.payload.characterUpdate) {
                     setSelectedCharacterData((prev: any) => prev ? {
                         ...prev,
                         currentHp: message.payload.characterUpdate.currentHp,
                         currentZoneId: message.payload.characterUpdate.currentZoneId,
                         level: message.payload.characterUpdate.level ?? prev.level,
                         experience: message.payload.characterUpdate.experience ?? prev.experience,
                          xpToNextLevel: message.payload.characterUpdate.xpToNextLevel ?? prev.xpToNextLevel,
                      } : null);
                      // Find the respawn zone data from the zoneStatuses list
                      const respawnZoneData = zoneStatuses.find(z => z.id === message.payload.characterUpdate.currentZoneId);
                      setCurrentZoneData(respawnZoneData || null); // Update currentZoneData for consistency, though InGameScreen might not use it directly anymore
                  }
                  setCurrentEncounter(null);
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
                         // Update everything received in the characterUpdate payload
                         const newState = { ...prev, ...update };
                         // Ensure inventory is always an array
                         newState.inventory = update.inventory ?? prev.inventory ?? [];
                         return newState;
                      });
                  }
                  setCurrentEncounter(null);
                  if (message.payload.loot && Array.isArray(message.payload.loot) && message.payload.loot.length > 0) {
                      console.log("Received Loot:", message.payload.loot);
                      const lootMessage = `Loot: ${message.payload.loot.map((item: any) => `${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ')}`;
                      setServerMessages(prev => [...prev, lootMessage]);
                  }
                  break;
            case 'character_update': // General character updates (e.g., equip/unequip)
                 console.log('Character update received:', message.payload);
                 setSelectedCharacterData(message.payload);
                 break;
            case 'select_character_success':
                console.log('Character selected successfully on server:', message.payload);
                 setSelectedCharacterData(message.payload.characterData);
                 setCurrentZoneData(message.payload.currentZoneData); // Keep setting this for now, might be useful
                 setZoneStatuses(message.payload.zoneStatuses || []); // Store the new zoneStatuses array
                 setCurrentEncounter(null);
                 console.log(message.payload.message);
                setCurrentView('in_game'); // Change view after server confirmation
                break;
            case 'select_character_fail':
                console.error(`Character selection failed: ${message.payload}`);
                // TODO: Display error message on select screen
                break;
            case 'character_list_update': // Might not be needed if create/delete handles list update
                 console.log('Received updated character list:', message.payload);
                 // Ensure this list is also formatted correctly
                 const updatedChars = message.payload || [];
                 const formattedUpdatedChars: CharacterSummary[] = updatedChars.map((char: any) => ({
                     id: char.id,
                     name: char.name,
                     class: typeof char.class === 'string'
                              ? char.class
                              : (typeof char.class === 'object' && char.class !== null && typeof char.class.name === 'string'
                                 ? char.class.name
                                 : (typeof char.classId === 'string' ? char.classId : 'Unknown')),
                     level: char.level ?? 1
                 }));
                 setCharacters(formattedUpdatedChars);
                 break;
            case 'error':
                console.error('Server error message:', message.payload);
                 break;
         }
     }, [zoneStatuses, setWsStatus, setUserId, setUsername, setCharacters, setCurrentView, setSelectedCharacterData, setCurrentZoneData, setZoneStatuses, setCurrentEncounter, setServerMessages]); // Updated dependencies

    // Keep the ref updated with the latest callback
    useEffect(() => {
        handleServerMessageRef.current = handleServerMessage;
    }, [handleServerMessage]);

    // --- WebSocket Connection Effect (Runs only on mount/unmount) ---
    useEffect(() => {
        // Define the message handler for the browser WebSocket to use the ref
        const browserMessageHandler = (message: any) => {
            handleServerMessageRef.current(message);
        };

        // Pass the stable browserMessageHandler to connectWebSocket
        // Note: connectWebSocket needs adjustment to accept this handler specifically for browser mode
        // Let's modify connectWebSocket inline for simplicity here, or ideally refactor it.

        // --- Modified connectWebSocket Logic (Inline for Browser) ---
        if (!window.electronAPI) {
            console.log(`Attempting to connect browser WebSocket at ${serverUrl}...`);

            // Prevent duplicate connections
            if (browserWsRef.current && (browserWsRef.current.readyState === WebSocket.CONNECTING || browserWsRef.current.readyState === WebSocket.OPEN)) {
                console.log('Browser WebSocket connection attempt skipped: Already connecting or connected.');
                return; // Exit early
            }

            // Clean up previous instance if it exists and is closed/closing
            if (browserWsRef.current) {
                console.log(`Cleaning up previous browser WebSocket instance (readyState: ${browserWsRef.current.readyState}).`);
                browserWsRef.current.onopen = null;
                browserWsRef.current.onmessage = null;
                browserWsRef.current.onerror = null;
                browserWsRef.current.onclose = null;
                browserWsRef.current.close();
            }

            console.log('Creating new browser WebSocket instance.');
            setWsStatus({ text: 'Connecting...', isConnected: false });
            const ws = new WebSocket(serverUrl);
            browserWsRef.current = ws; // Store the new instance

            ws.onopen = () => {
                if (browserWsRef.current === ws) {
                    console.log('Browser WebSocket connected.');
                    setWsStatus({ text: 'Connected (Browser)', isConnected: true });
                } else { ws.close(); }
            };

            ws.onmessage = (event) => {
                if (browserWsRef.current === ws) {
                    try {
                        const message = JSON.parse(event.data);
                        browserMessageHandler(message); // Use the ref wrapper
                    } catch (error) { console.error('Failed to parse WebSocket message:', error, 'Data:', event.data); }
                }
            };

            ws.onerror = (event) => {
                if (browserWsRef.current === ws) {
                    console.error('Browser WebSocket error:', event);
                    setWsStatus({ text: 'Connection Error (Browser)', isConnected: false });
                }
            };

            ws.onclose = (event) => {
                if (browserWsRef.current === ws) {
                    console.log('Browser WebSocket disconnected:', event.code, event.reason);
                    setWsStatus({ text: `Disconnected (Browser)${event.reason ? ': ' + event.reason : ''} (Code: ${event.code})`, isConnected: false });
                    browserWsRef.current = null; // Clear the ref only if this instance closed
                }
            };
        } else {
             // --- Electron Connection Logic (Unchanged) ---
             console.log('Using Electron WebSocket bridge.');
             if (cleanupElectronWsListener) cleanupElectronWsListener();
             if (cleanupElectronStatusListener) cleanupElectronStatusListener();

             window.electronAPI.invoke('connect-ws', { url: serverUrl })
                 .then(result => {
                     console.log('WebSocket connection initiated via main process:', result);
                     setWsStatus({ text: 'Connection attempt sent.', isConnected: false });
                     // Electron uses the main handleServerMessage directly as IPC handles listener updates
                     cleanupElectronWsListener = window.electronAPI.on('ws-message', handleServerMessage);
                     cleanupElectronStatusListener = window.electronAPI.on('ws-connect-status', (status: { connected: boolean; error?: string }) => {
                         console.log('WebSocket Connection Status Update (Electron):', status);
                         if (status.connected) { setWsStatus({ text: 'Connected (Electron)', isConnected: true }); }
                         else { setWsStatus({ text: `Disconnected (Electron)${status.error ? ': ' + status.error : ''}`, isConnected: false }); }
                     });
                 })
                 .catch(error => {
                     console.error('Failed to initiate WebSocket connection via main process:', error);
                     setWsStatus({ text: `Connection Error (Electron): ${error.message || error}`, isConnected: false });
                 });
        }

        // --- Cleanup function (Runs only on unmount) ---
        return () => {
            console.log("Running cleanup for WebSocket connection effect.");
            // --- Browser Cleanup ---
            if (!window.electronAPI && browserWsRef.current) {
                console.log(`Cleaning up browser WebSocket instance on unmount (readyState: ${browserWsRef.current.readyState}).`);
                browserWsRef.current.onopen = null;
                browserWsRef.current.onmessage = null;
                browserWsRef.current.onerror = null;
                browserWsRef.current.onclose = null; // Prevent its onclose from running after manual close
                browserWsRef.current.close();
                browserWsRef.current = null;
            }

            // --- Electron Cleanup ---
            if (window.electronAPI) {
                 console.log("Cleaning up Electron listeners on unmount.");
                 if (cleanupElectronWsListener) cleanupElectronWsListener();
                 if (cleanupElectronStatusListener) cleanupElectronStatusListener();
                 cleanupElectronWsListener = null;
                 cleanupElectronStatusListener = null;
                 // Optionally tell the main process to disconnect
                 // window.electronAPI.invoke('disconnect-ws').catch(err => console.error("Error invoking disconnect-ws on cleanup:", err));
            }
        };
    }, []); // Empty dependency array: run only on mount/unmount

    // --- Action Handlers ---
    const handleLogin = (user: string, pass: string) => {
        sendToServer('login', { username: user, password: pass }, browserWsRef);
    };

    const handleRegister = (user: string, pass: string) => {
        sendToServer('register', { username: user, password: pass }, browserWsRef);
    };

    const handleLogout = () => {
        console.log("Logging out...");
        setUserId(null);
         setUsername(null);
         setCharacters([]);
         setSelectedCharacterData(null);
         setCurrentZoneData(null);
         setZoneStatuses([]); // Clear zone statuses on logout
         setCurrentEncounter(null);
         setCurrentView('login'); // Go back to login screen
        // Optionally disconnect WS or send logout message
    };

    const handleShowCreate = () => {
        setCurrentView('createCharacter');
    };

    const handleShowSelect = () => {
        // Fetch characters again? Or assume the list from login is current?
        // Let's assume the list is current for now.
        setCurrentView('selectCharacter');
    };

    const handleBackToMainMenu = () => {
        setCurrentView('mainMenu');
    };

    const handleCreateCharacter = (name: string, classId: string) => {
        sendToServer('create_character', { name, classId }, browserWsRef);
    };

    const handleDeleteCharacter = (characterId: string) => {
        // Optional: Add a confirmation dialog here
        console.log(`Requesting delete character ${characterId}`);
        sendToServer('delete_character', { characterId }, browserWsRef);
    };

    const handleSelectCharacter = (characterId: string) => {
        sendToServer('select_character', { characterId }, browserWsRef);
    };

    const handleTravel = (targetZoneId: string) => {
        sendToServer('travel', { targetZoneId }, browserWsRef);
    };

    const handleEquipItem = (itemId: string) => {
        sendToServer('equip_item', { itemId }, browserWsRef);
    };

    const handleUnequipItem = (slot: EquipmentSlot) => {
        sendToServer('unequip_item', { slot }, browserWsRef);
    };

    const handleSellItem = (itemId: string) => {
        sendToServer('sell_item', { itemId }, browserWsRef);
    };

    const handleLootGroundItem = (itemId: string) => {
        sendToServer('loot_ground_item', { itemId }, browserWsRef);
    };

    const handleAssignPotionSlot = (slotNumber: 1 | 2, itemBaseId: string | null) => {
        sendToServer('assign_potion_slot', { slotNumber, itemBaseId }, browserWsRef);
    };

    const handleUsePotionSlot = (slotNumber: 1 | 2) => {
        sendToServer('use_potion_slot', { slotNumber }, browserWsRef);
    };

    // --- Handler for Auto-Equip ---
    const handleAutoEquipBestStat = (stat: keyof ItemStats) => {
        console.log(`App: Requesting auto-equip for stat: ${stat}`);
        sendToServer('auto_equip_best_stat', { stat }, browserWsRef);
    };

    const handleOptions = () => {
        console.log("Options clicked (not implemented)");
        // TODO: Implement options screen or logic
    };

    const handleExitGame = () => {
        console.log("Exit game clicked (not implemented)");
        // TODO: Use Electron API to close the window if desired
        // window.electronAPI?.invoke('close-app');
    };


    // --- Render Logic ---
    const renderCurrentScreen = () => {
        switch (currentView) {
            case 'login':
                // Pass register handler too
                return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
            case 'mainMenu':
                return <MainMenuScreen
                            onNewGame={handleShowCreate}
                            onLoadGame={handleShowSelect}
                            onOptions={handleOptions}
                            onLogout={handleLogout}
                            onExitGame={handleExitGame}
                       />;
            case 'createCharacter':
                // Pass the restored map
                return <CharacterCreateScreen
                            characterClasses={characterClasses} // Pass restored map
                            onCreateCharacter={handleCreateCharacter}
                            onBack={handleBackToMainMenu}
                       />;
            case 'selectCharacter':
                return <CharacterSelectScreen
                            characters={characters}
                            onSelect={handleSelectCharacter}
                            onDelete={handleDeleteCharacter} // Pass delete handler
                            onBack={handleBackToMainMenu}    // Pass back handler
                       />;
            case 'in_game':
                 return <InGameScreen
                             character={selectedCharacterData}
                             zone={currentZoneData} // Pass current zone data (now ZoneWithStatus type)
                             zoneStatuses={zoneStatuses} // Pass the new zoneStatuses array
                             encounter={currentEncounter}
                             onTravel={handleTravel}
                            onLogout={handleLogout}
                             onEquipItem={handleEquipItem}
                             onUnequipItem={handleUnequipItem}
                             onSellItem={handleSellItem} // Pass the sell handler
                             onLootGroundItem={handleLootGroundItem} // Pass the ground loot handler
                             onAssignPotionSlot={handleAssignPotionSlot} // Pass the assign potion handler
                             onUsePotionSlot={handleUsePotionSlot} // Pass the use potion handler
                             onAutoEquipBestStat={handleAutoEquipBestStat} // Pass the new handler
                        />;
             default:
                return <div>Error: Unknown View State</div>;
        }
    };

    return (
        <div className="App">
            {/* Optional: Debug WS Status */}
            <div id="ws-status-container" style={{ position: 'fixed', bottom: 0, left: 0, background: 'rgba(0,0,0,0.7)', padding: '2px 5px', fontSize: '10px', color: wsStatus.isConnected ? 'lightgreen' : 'lightcoral', zIndex: 9999 }}>
                WS: {wsStatus.text}
                {/* Reconnect button needs to trigger the effect logic, maybe via a state change?
                    For now, let's remove the direct call to connectWebSocket from the button,
                    as the effect should handle reconnections based on state or other triggers.
                    A simpler approach for manual reconnect might be needed.
                    Let's leave the button but comment out the direct call for now.
                 */}
                 {/* The connectWebSocket function is no longer suitable for direct call here as it's embedded in the effect.
                     A dedicated reconnect function or state trigger would be needed.
                 */}
                 {!wsStatus.isConnected && <button onClick={() => { console.log("Reconnect clicked - currently no action"); /* Placeholder for future reconnect logic */ }} style={{ marginLeft: '5px', fontSize: '10px', padding: '1px 3px' }}>Reconnect</button>}
            </div>

            {renderCurrentScreen()}
        </div>
    );
}

export default App;
