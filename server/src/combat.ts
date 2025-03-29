import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { charactersCollection } from './db.js';
import { safeSend, randomInt } from './utils.js'; // Import randomInt
import { ActiveConnectionsMap, ActiveEncountersMap, CombatIntervalsMap, Monster, Character, Item } from './types.js'; // Import Character and Item
import { zones, monsters, calculateMaxHp, xpForLevel, characterClasses, lootTables, baseItems } from './gameData.js'; // Import lootTables and baseItems

const COMBAT_INTERVAL_MS = 2000; // Attack every 2 seconds (adjust as needed)

// --- Combat Handlers ---

export async function handleFindMonster(
    ws: WebSocket,
    payload: any, // Keep payload for potential future use (e.g., specific monster targeting)
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    combatIntervals: CombatIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    // Check connectionInfo and that selectedCharacterId is a string
    if (!connectionInfo || typeof connectionInfo.selectedCharacterId !== 'string') {
        safeSend(ws, { type: 'find_monster_fail', payload: 'Character not selected' });
        return;
    }
    // Assign the confirmed string ID to a new variable
    const characterId: string = connectionInfo.selectedCharacterId;
    // Fetch character from DB
    const character = await charactersCollection.findOne({ id: characterId });

    // Check if character was found in the map
    if (!character) {
        console.error(`Character not found in map for ID: ${characterId}`);
        safeSend(ws, { type: 'find_monster_fail', payload: 'Character data inconsistency' });
        return;
    }
    const currentZone = zones.get(character.currentZoneId);
    if (!currentZone || currentZone.monsterIds.length === 0) {
        safeSend(ws, { type: 'find_monster_fail', payload: 'No monsters available in this zone' });
        return;
    }

    // If already in an encounter or combat loop, fail
    if (activeEncounters.has(ws) || combatIntervals.has(ws)) {
         safeSend(ws, { type: 'find_monster_fail', payload: 'Already in an encounter' });
         return;
    }

    // Find a random monster template from the zone
    const randomMonsterId = currentZone.monsterIds[Math.floor(Math.random() * currentZone.monsterIds.length)];
    // Add a type assertion or check to ensure randomMonsterId is a string
    const monsterTemplate = monsters.get(randomMonsterId as string);

    if (!monsterTemplate) {
        console.error(`Monster template not found for ID: ${randomMonsterId}`);
        safeSend(ws, { type: 'find_monster_fail', payload: 'Internal server error: Monster definition missing' });
        return;
    }

    // Create a unique instance of the monster for this encounter
    const monsterInstance: Monster = {
        ...monsterTemplate, // Copy template data
        id: uuidv4(), // Give it a unique instance ID for this fight
        currentHp: monsterTemplate.maxHp, // Ensure full HP at start
        stats: { ...monsterTemplate.stats } // Ensure stats are copied, not referenced
    };

    activeEncounters.set(ws, monsterInstance);
    console.log(`Character ${character.name} encountered ${monsterInstance.name} (Instance ID: ${monsterInstance.id})`);

    safeSend(ws, { type: 'encounter_start', payload: { monster: monsterInstance } });

    // Start the combat loop
    const intervalId = setInterval(() => {
        // Pass ws and maps to know which connection/encounter to process
        performCombatRound(ws, activeConnections, activeEncounters, combatIntervals);
    }, COMBAT_INTERVAL_MS);
    combatIntervals.set(ws, intervalId);
    console.log(`Started combat interval for ${character.name}`);
}

// Performs one auto-attack round
async function performCombatRound(
    ws: WebSocket,
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    combatIntervals: CombatIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    const encounter = activeEncounters.get(ws);

    // Validate connection, character selection, and active encounter
    // Check if interval still exists (might have been cleared by travel/logout/death)
    if (!connectionInfo || typeof connectionInfo.selectedCharacterId !== 'string' || !encounter || !combatIntervals.has(ws)) {
        console.log("Combat round skipped or stopped due to invalid state.");
        // Ensure interval is cleared if it exists but state is invalid
        const existingInterval = combatIntervals.get(ws);
        if (existingInterval) {
            clearInterval(existingInterval);
            combatIntervals.delete(ws);
        }
        activeEncounters.delete(ws); // Also clear encounter
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;
    // Fetch character from DB for current stats/HP
    let character = await charactersCollection.findOne({ id: characterId }); // Use let

    if (!character) {
        console.error(`Combat round: Character ${characterId} not found in DB.`);
        safeSend(ws, { type: 'attack_fail', payload: 'Character data inconsistency' });
        const existingInterval = combatIntervals.get(ws);
        if (existingInterval) clearInterval(existingInterval); // Stop loop on error
        combatIntervals.delete(ws);
        activeEncounters.delete(ws);
        return;
    }

    // --- Ensure zoneKills exists ---
    if (!character.zoneKills) {
        character.zoneKills = {};
        console.log(`Initialized missing zoneKills for character ${character.name}`);
        // Optionally update the DB here too, though it will be updated on the next kill anyway
        // await charactersCollection.updateOne({ id: character.id }, { $set: { zoneKills: {} } });
    }

    // --- Player Attack Phase ---
    // Basic damage calculation (e.g., based on Strength) - VERY simplified
    const playerDamage = Math.max(1, Math.floor(character.stats.strength / 5)); // Ensure at least 1 damage
    encounter.currentHp -= playerDamage;
    console.log(`${character.name} attacks ${encounter.name} for ${playerDamage} damage. ${encounter.name} HP: ${encounter.currentHp}/${encounter.maxHp}`);

    // Check if monster is defeated
    if (encounter.currentHp <= 0) {
        console.log(`${encounter.name} defeated by ${character.name}`);
        const defeatedMonsterName = encounter.name; // Store name before deleting
        activeEncounters.delete(ws); // End encounter
        const existingInterval = combatIntervals.get(ws);
        if (existingInterval) clearInterval(existingInterval); // Stop combat loop
        combatIntervals.delete(ws);

        // --- Grant Experience & Check Level Up ---
        const xpGained = calculateXpReward(encounter); // Calculate XP based on monster
        character.experience += xpGained;
        console.log(`${character.name} gained ${xpGained} XP. Total XP: ${character.experience}`);

        let leveledUp = false;
        let statIncreases = {}; // To store which stats increased
        while (character.experience >= xpForLevel(character.level + 1)) {
            leveledUp = true;
            character.level++;
            console.log(`${character.name} leveled up to level ${character.level}!`);

            // --- Apply Stat Increases (Example: +2 main stat, +1 others based on class) ---
            // This is a very basic example; a real game would have more complex progression
            const charClassData = characterClasses.get(character.class); // Get class data
            if (charClassData) { // Check if class data exists
                // Example: Warrior gets +2 str, +1 vit; Rogue +2 dex, +1 vit etc.
                // For simplicity, let's give +1 to all stats for now
                character.stats.strength += 1;
                character.stats.dexterity += 1;
                character.stats.vitality += 1;
                character.stats.energy += 1;
                statIncreases = { strength: 1, dexterity: 1, vitality: 1, energy: 1 }; // Record increases
                console.log(`Stats increased: +1 to all.`);
            } else {
                console.warn(`Could not find class data for ${character.class} during level up.`);
            }


            // Recalculate Max HP based on new stats (especially vitality)
            character.maxHp = calculateMaxHp(character.stats);
            // Restore HP to full on level up
            character.currentHp = character.maxHp;
            console.log(`Max HP increased to ${character.maxHp}. HP restored.`);
        }

        // --- Update Zone Kills ---
        const currentZoneId = character.currentZoneId;
        const currentKills = character.zoneKills[currentZoneId] || 0;
        const newKills = currentKills + 1;
        const updateField = `zoneKills.${currentZoneId}`; // Field path for MongoDB update

        // Prepare update object for DB
        const updateData: Partial<Character> & { [key: string]: any } = {
            experience: character.experience,
            [updateField]: newKills,
        };
        if (leveledUp) {
            updateData.level = character.level;
            updateData.stats = character.stats; // Update all stats
            updateData.maxHp = character.maxHp;
            updateData.currentHp = character.currentHp; // Restore HP
        }

        // Update character in DB
        await charactersCollection.updateOne({ id: character.id }, { $set: updateData });

        // Update local character object (already partially done during level up check)
        character.zoneKills[currentZoneId] = newKills;
        console.log(`${character.name} now has ${newKills} kills in ${currentZoneId}.`);

        // Prepare payload for client
        const xpToNext = xpForLevel(character.level + 1); // Calculate XP needed for next level
        const characterUpdatePayload: any = {
            experience: character.experience,
            zoneKills: character.zoneKills,
            xpToNextLevel: xpToNext, // Add XP needed for next level
        };
        if (leveledUp) {
            characterUpdatePayload.level = character.level;
            characterUpdatePayload.stats = character.stats;
            characterUpdatePayload.maxHp = character.maxHp;
            characterUpdatePayload.currentHp = character.currentHp;
            characterUpdatePayload.leveledUp = true; // Add a flag for the client
            characterUpdatePayload.statIncreases = statIncreases; // Send increases info
        }

        // --- Generate Loot ---
        const droppedLoot = generateLoot(encounter);
        console.log(`${character.name} received loot:`, droppedLoot.map((item: Item) => `${item.name}${item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}`).join(', ') || 'Nothing');

        safeSend(ws, {
            type: 'encounter_end',
            payload: {
                reason: `Defeated ${defeatedMonsterName}! Gained ${xpGained} XP.`,
                characterUpdate: characterUpdatePayload,
                loot: droppedLoot // Add loot payload
            }
        });

        // Automatically find next monster after a short delay
        setTimeout(() => {
            console.log(`Finding next monster for ${character?.name}...`);
            // Check if connection is still valid before finding next monster
            if (activeConnections.has(ws)) {
                handleFindMonster(ws, {}, activeConnections, activeEncounters, combatIntervals);
            } else {
                console.log(`Connection closed before finding next monster for ${character?.name}.`);
            }
        }, 1500); // Delay before next fight (adjust as needed)

        return; // Combat round ends here
    }

    // --- Monster Attack Phase (if monster survived) ---
    // Basic monster damage calculation
    const monsterDamage = Math.max(1, encounter.baseDamage); // Use base damage for now
    const newHp = character.currentHp - monsterDamage;
    console.log(`${encounter.name} attacks ${character.name} for ${monsterDamage} damage. ${character.name} HP: ${newHp}/${character.maxHp}`);

    // Check if player is defeated
    if (newHp <= 0) {
        console.log(`${character.name} defeated by ${encounter.name}`);
        character.currentHp = 0; // Don't go below 0
        activeEncounters.delete(ws); // End encounter
        const existingInterval = combatIntervals.get(ws);
        if (existingInterval) clearInterval(existingInterval); // Stop combat loop
        combatIntervals.delete(ws);

        // --- Player Death Consequences ---
        const maxHp = calculateMaxHp(character.stats); // Calculate max HP for respawn
        const respawnZoneId = 'town'; // Respawn in town

        // Update character HP and Zone in DB
        await charactersCollection.updateOne(
            { id: character.id },
            { $set: { currentHp: maxHp, currentZoneId: respawnZoneId } }
        );

        // Update local character object for payload
        character.currentHp = maxHp;
        character.currentZoneId = respawnZoneId;

        console.log(`${character.name} died and respawned in ${respawnZoneId} with full HP.`);

        // TODO: Add XP loss? Other penalties?
        safeSend(ws, {
            type: 'player_death',
            payload: {
                message: `You were defeated by ${encounter.name}! Respawning in Town...`,
                characterUpdate: {
                    currentHp: character.currentHp,
                    currentZoneId: character.currentZoneId,
                    // Also send potentially updated level/xp/stats if penalties were applied (not implemented yet)
                    level: character.level,
                    experience: character.experience,
                    xpToNextLevel: xpForLevel(character.level + 1) // Send XP needed after respawn
                }
                // Send new zone data for town as well? Client might need it.
                // zoneData: zones.get(respawnZoneId) // Consider adding this
            }
        });
        // Encounter already ended, client needs to handle UI state change based on death message
        return; // Combat round ends here
    }

    // If both survived, update HP in DB and send updates
    character.currentHp = newHp;
    await charactersCollection.updateOne({ id: character.id }, { $set: { currentHp: newHp } });

    safeSend(ws, {
        type: 'combat_update',
        payload: {
            playerDamageDealt: playerDamage,
            monsterDamageTaken: monsterDamage,
            monsterUpdate: { currentHp: encounter.currentHp },
            characterUpdate: {
                currentHp: character.currentHp
                // No need to send xpToNextLevel on every hit, only on changes (encounter end, level up, login)
            }
        }
    });

    // Update encounter map with new monster HP (character data is fetched fresh next round)
    activeEncounters.set(ws, encounter);
}

// --- Helper Functions ---

// Basic XP reward calculation (adjust formula as needed)
function calculateXpReward(monster: Monster): number {
    // Example: Base XP + XP per level
    const baseXp = 5;
    const xpPerLevel = 3;
    return baseXp + (monster.level * xpPerLevel);
}

// Generates loot based on monster's loot table
function generateLoot(monster: Monster): Item[] {
    const droppedItems: Item[] = [];
    if (!monster.lootTableId) {
        return droppedItems; // No loot table assigned
    }

    const table = lootTables.get(monster.lootTableId);
    if (!table) {
        console.warn(`Loot table not found: ${monster.lootTableId}`);
        return droppedItems;
    }

    table.forEach(entry => {
        if (Math.random() <= entry.chance) {
            const baseItem = baseItems.get(entry.baseId);
            if (baseItem) {
                const newItem: Item = {
                    ...baseItem,
                    id: uuidv4(), // Unique instance ID
                };

                // Handle quantity randomization
                if (entry.minQuantity !== undefined && entry.maxQuantity !== undefined) {
                    newItem.quantity = randomInt(entry.minQuantity, entry.maxQuantity);
                } else {
                    // Default quantity if not specified (or for non-stackables where it might be 1)
                    newItem.quantity = baseItem.quantity || 1;
                }

                // Ensure non-stackables don't get quantity > 1 unless intended
                if (newItem.type !== 'potion' && newItem.type !== 'misc' && (newItem.quantity ?? 1) > 1) {
                     // For now, just set non-stackable quantity to 1 if randomized > 1
                     // A better system might drop multiple individual items
                     newItem.quantity = 1;
                }


                droppedItems.push(newItem);
            } else {
                console.warn(`Base item not found for loot table entry: ${entry.baseId}`);
            }
        }
    });

    return droppedItems;
}
