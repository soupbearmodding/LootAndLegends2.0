import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { charactersCollection } from './db.js';
import { safeSend, randomInt } from './utils.js';
import {
    ActiveConnectionsMap,
    ActiveEncountersMap,
    PlayerAttackIntervalsMap, // Changed
    MonsterAttackIntervalsMap, // Added
    Monster,
    Character,
    Item,
    EquipmentSlot,
    PlayerAttackUpdatePayload, // Added
    MonsterAttackUpdatePayload // Added
} from './types.js';
// Import 'items' instead of 'baseItems'
import { zones, monsters, calculateMaxHp, xpForLevel, xpRequiredForLevel, characterClasses } from './gameData.js'; // Removed items
import { items } from './lootData.js'; // Import items from lootData
import { generateLoot as generateLootFromTable } from './lootGenerator.js';

const DEFAULT_PLAYER_ATTACK_SPEED = 2000; // Default ms between player attacks if no weapon
const MIN_ATTACK_SPEED = 500; // Minimum attack speed in ms

// --- Helper Functions ---

// Calculate player's attack speed based on weapon and gear
function calculatePlayerAttackSpeed(character: Character): number {
    let baseSpeed = DEFAULT_PLAYER_ATTACK_SPEED;
    let totalIncreasedAttackSpeed = 0; // Percentage increase

    const mainHand = character.equipment?.mainHand;
    // Access attackSpeed via the stats object
    if (mainHand && mainHand.stats?.attackSpeed) {
        baseSpeed = mainHand.stats.attackSpeed;
    }

    // Sum IAS from all equipment slots
    for (const slot in character.equipment) {
        const item = character.equipment[slot as EquipmentSlot];
        if (item) {
            // Also check item base stats for IAS
            totalIncreasedAttackSpeed += item.stats?.increasedAttackSpeed ?? 0;
            // Check affix statModifiers for IAS
            item.prefixes?.forEach(affix => {
                totalIncreasedAttackSpeed += affix.statModifiers?.increasedAttackSpeed ?? 0;
            });
            item.suffixes?.forEach(affix => {
                totalIncreasedAttackSpeed += affix.statModifiers?.increasedAttackSpeed ?? 0;
            });
        }
    }

    // Apply percentage increase
    let finalSpeed = baseSpeed / (1 + totalIncreasedAttackSpeed);

    // Clamp to minimum speed
    finalSpeed = Math.max(MIN_ATTACK_SPEED, finalSpeed);

    console.log(`Attack Speed Calc: Base=${baseSpeed}, IAS=${(totalIncreasedAttackSpeed * 100).toFixed(0)}%, Final=${finalSpeed.toFixed(0)}ms`);
    return finalSpeed;
}

// XP reward calculation (remains the same)
function calculateXpReward(monster: Monster, characterLevel: number): number {
    const mLvl = monster.level ?? 1;
    const pLvl = characterLevel;
    const baseMonsterXp = 10 + (mLvl * 5);
    const levelDiff = pLvl - mLvl;
    let xpMultiplier = 1.0;

    if (levelDiff > 10) {
        xpMultiplier = Math.max(0.05, 1.0 - (levelDiff - 10) * 0.05);
    } else if (levelDiff < -10) {
        xpMultiplier = Math.max(0.05, 1.0 - (Math.abs(levelDiff) - 10) * 0.05);
    }
    xpMultiplier = Math.max(0, xpMultiplier);
    const finalXp = Math.floor(baseMonsterXp * xpMultiplier);
    console.log(`XP Calc: pLvl=${pLvl}, mLvl=${mLvl}, baseXP=${baseMonsterXp}, diff=${levelDiff}, mult=${xpMultiplier.toFixed(2)}, finalXP=${finalXp}`);
    return finalXp;
}

// Function to clear combat state for a connection
function clearCombatState(
    ws: WebSocket,
    activeEncounters: ActiveEncountersMap,
    playerAttackIntervals: PlayerAttackIntervalsMap,
    monsterAttackIntervals: MonsterAttackIntervalsMap
) {
    const playerInterval = playerAttackIntervals.get(ws);
    if (playerInterval) {
        clearInterval(playerInterval);
        playerAttackIntervals.delete(ws);
    }
    const monsterInterval = monsterAttackIntervals.get(ws);
    if (monsterInterval) {
        clearInterval(monsterInterval);
        monsterAttackIntervals.delete(ws);
    }
    activeEncounters.delete(ws);
    console.log("Cleared combat state (intervals and encounter).");
}


// --- Combat Handlers ---

export async function handleFindMonster(
    ws: WebSocket,
    payload: any, // Keep payload for potential future use (e.g., specific monster targeting)
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    playerAttackIntervals: PlayerAttackIntervalsMap, // Changed
    monsterAttackIntervals: MonsterAttackIntervalsMap // Added
) {
    // --- Basic Payload Validation (Future-proofing) ---
    // Although payload isn't used now, validate its basic type if provided.
    if (typeof payload !== 'object' && payload !== null && payload !== undefined) {
        safeSend(ws, { type: 'find_monster_fail', payload: 'Invalid payload format for find_monster.' });
        console.warn(`Invalid find_monster payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    // --- End Validation ---

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

    // If already in an encounter or combat loops are running, fail
    if (activeEncounters.has(ws) || playerAttackIntervals.has(ws) || monsterAttackIntervals.has(ws)) {
         safeSend(ws, { type: 'find_monster_fail', payload: 'Already in an encounter or combat loops active' });
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
        stats: { ...monsterTemplate.stats }, // Ensure stats are copied, not referenced
        attackSpeed: monsterTemplate.attackSpeed // Copy attack speed
    };

    activeEncounters.set(ws, monsterInstance);
    // Enhanced Logging
    console.log(`Character ${character.name} (ID: ${characterId}) encountered ${monsterInstance.name} (Instance ID: ${monsterInstance.id}, Level: ${monsterInstance.level}) in zone ${currentZone.id}.`);

    safeSend(ws, { type: 'encounter_start', payload: { monster: monsterInstance } });

    // --- Start Separate Combat Intervals ---
    const playerAttackSpeed = calculatePlayerAttackSpeed(character);
    const monsterAttackSpeed = monsterInstance.attackSpeed; // Use the instance's speed

    // Player Attack Interval
    const playerIntervalId = setInterval(() => {
        performPlayerAttack(ws, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
    }, playerAttackSpeed);
    playerAttackIntervals.set(ws, playerIntervalId);
    console.log(`Started player attack interval (${playerAttackSpeed}ms) for ${character.name}`);

    // Monster Attack Interval (slight delay to prevent simultaneous first hit)
    setTimeout(() => {
        // Check if encounter is still active before starting monster interval
        if (activeEncounters.has(ws)) {
            const monsterIntervalId = setInterval(() => {
                performMonsterAttack(ws, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
            }, monsterAttackSpeed);
            monsterAttackIntervals.set(ws, monsterIntervalId);
            console.log(`Started monster attack interval (${monsterAttackSpeed}ms) for ${monsterInstance.name}`);
        } else {
            console.log(`Encounter ended before monster ${monsterInstance.name} could start attacking.`);
        }
    }, randomInt(100, 300)); // Add small random delay
}


// --- Player Attack Logic ---
async function performPlayerAttack(
    ws: WebSocket,
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    playerAttackIntervals: PlayerAttackIntervalsMap,
    monsterAttackIntervals: MonsterAttackIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    const encounter = activeEncounters.get(ws);

    // Validate connection, character selection, active encounter, and player interval
    if (!connectionInfo || typeof connectionInfo.selectedCharacterId !== 'string' || !encounter || !playerAttackIntervals.has(ws)) {
        console.log("Player attack skipped or stopped due to invalid state.");
        clearCombatState(ws, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;
    let character = await charactersCollection.findOne({ id: characterId });

    if (!character) {
        console.error(`Player attack: Character ${characterId} not found in DB.`);
        safeSend(ws, { type: 'attack_fail', payload: 'Character data inconsistency' });
        clearCombatState(ws, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
        return;
    }

    // --- Player Attack Calculation ---
    // TODO: Enhance damage calculation (weapon damage, stats, skills)
    let playerDamage = Math.floor((character.stats?.strength ?? 0) / 5); // Example base damage
    // Sanity check: Ensure damage is at least 1 (or 0 if you want attacks to potentially do nothing)
    playerDamage = Math.max(1, playerDamage);
    encounter.currentHp -= playerDamage;
    // Enhanced Logging
    console.log(`Player Attack: ${character.name} (ID: ${characterId}) dealt ${playerDamage} damage to ${encounter.name} (Instance ID: ${encounter.id}). ${encounter.name} HP: ${encounter.currentHp}/${encounter.maxHp}`);

    // Send update to client
    const playerAttackPayload: PlayerAttackUpdatePayload = {
        playerDamageDealt: playerDamage,
        monsterUpdate: { currentHp: encounter.currentHp }
    };
    safeSend(ws, { type: 'player_attack_update', payload: playerAttackPayload });

    // Update encounter map with new monster HP
    activeEncounters.set(ws, encounter);

    // --- Check if Monster is Defeated ---
    if (encounter.currentHp <= 0) {
        // Enhanced Logging
        console.log(`Monster Defeated: ${encounter.name} (Instance ID: ${encounter.id}) defeated by ${character.name} (ID: ${characterId}).`);
        const defeatedMonsterName = encounter.name;
        const defeatedMonster = { ...encounter }; // Copy data before clearing state

        // Stop combat loops and clear encounter state FIRST
        clearCombatState(ws, activeEncounters, playerAttackIntervals, monsterAttackIntervals);

        // --- Grant Experience & Check Level Up ---
        let xpGained = calculateXpReward(defeatedMonster, character.level); // Use defeatedMonster here
        // Sanity check: Ensure XP gained is not negative
        xpGained = Math.max(0, xpGained);
        character.experience = (character.experience ?? 0) + xpGained;
        // Enhanced Logging
        console.log(`XP Gain: ${character.name} (ID: ${characterId}) gained ${xpGained} XP. Total XP: ${character.experience}.`);

        let leveledUp = false;
        let statIncreases = {};
        while (character.experience >= xpForLevel((character.level ?? 0) + 1)) {
            leveledUp = true;
            const oldLevel = character.level; // Store old level for logging
            character.level = (character.level ?? 0) + 1;
            // Enhanced Logging
            console.log(`Level Up: ${character.name} (ID: ${characterId}) leveled up from ${oldLevel} to ${character.level}!`);

            // --- Apply Stat Increases ---
            if (!character.stats) character.stats = { strength: 0, dexterity: 0, vitality: 0, energy: 0 }; // Initialize if missing
            character.stats.strength = (character.stats.strength ?? 0) + 1;
            character.stats.dexterity = (character.stats.dexterity ?? 0) + 1;
            character.stats.vitality = (character.stats.vitality ?? 0) + 1;
            character.stats.energy = (character.stats.energy ?? 0) + 1;
            statIncreases = { strength: 1, dexterity: 1, vitality: 1, energy: 1 }; // Record increases
            console.log(`Stats increased: +1 to all.`);

            // Recalculate Max HP based on new stats (especially vitality)
            character.maxHp = calculateMaxHp(character.stats);
            // Restore HP to full on level up
            character.currentHp = character.maxHp;
            console.log(`Max HP increased to ${character.maxHp}. HP restored.`);
        }

        // --- Prepare update object for DB (Removed zone kill update) ---
        const updateData: Partial<Character> = { // Use Partial<Character> directly
            experience: character.experience,
        };
        if (leveledUp) {
            updateData.level = character.level;
            updateData.stats = character.stats; // Update all stats
            updateData.maxHp = character.maxHp;
            updateData.currentHp = character.currentHp; // Restore HP
        }

        // --- Generate Loot ---
        let droppedLoot: Item[] = [];
        if (defeatedMonster.lootTableId) {
            droppedLoot = generateLootFromTable(defeatedMonster.lootTableId);
            // Enhanced Logging
            const lootSummary = droppedLoot.map((item: Item) => `${item.name}${item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''} (ID: ${item.id})`).join(', ') || 'Nothing';
            console.log(`Loot Drop: ${character.name} (ID: ${characterId}) received loot from ${defeatedMonsterName}: ${lootSummary}`);
        } else {
            console.log(`Loot Drop: ${defeatedMonster.name} has no loot table defined.`);
        }

        // --- Add Loot to Inventory ---
        if (droppedLoot.length > 0) {
            // Ensure inventory array exists
            if (!character.inventory) {
                character.inventory = [];
            }

            droppedLoot.forEach(newItem => {
                const isStackable = (newItem.type === 'potion' || newItem.type === 'misc') && (newItem.quantity ?? 1) > 0; // Check if item type is stackable and has quantity
                let existingItemIndex = -1;

                if (isStackable) {
                    // Find item with the same baseId in the inventory
                    existingItemIndex = character.inventory.findIndex(invItem => invItem.baseId === newItem.baseId);
                }

                if (isStackable && existingItemIndex !== -1) {
                    // Get the item at the found index
                    const existingItem = character.inventory[existingItemIndex];
                    // Double-check if the item actually exists (to satisfy TS, though logically it should)
                    if (existingItem) {
                        const existingQuantity = existingItem.quantity ?? 0; // Default to 0 if undefined
                        existingItem.quantity = existingQuantity + (newItem.quantity ?? 1); // Default new item quantity to 1 if undefined
                        console.log(`Stacked ${newItem.quantity ?? 1} ${newItem.name}. New quantity: ${existingItem.quantity}`);
                    } else {
                         // This case should logically not happen if findIndex returned a valid index other than -1
                         // But handle it defensively: add as a new item instead of crashing
                         console.warn(`Item not found at index ${existingItemIndex} despite findIndex success. Adding as new item.`);
                         character.inventory.push(newItem);
                         console.log(`Added new item: ${newItem.name}${newItem.quantity && newItem.quantity > 1 ? ` (x${newItem.quantity})` : ''}`);
                    }
                } else {
                    // Add new item (or non-stackable item)
                    character.inventory.push(newItem);
                    console.log(`Added new item: ${newItem.name}${newItem.quantity && newItem.quantity > 1 ? ` (x${newItem.quantity})` : ''}`);
                }
            });

            // Include inventory in the database update
            updateData.inventory = character.inventory;
        }

        // Update character in DB (now includes potential inventory changes)
        await charactersCollection.updateOne({ id: character.id }, { $set: updateData });

        // Update local character object with potentially updated inventory
        // (other fields like level, xp, stats, hp were already updated locally)
        if (updateData.inventory) {
            character.inventory = updateData.inventory;
        }
        // Removed local zone kill update


        // --- Prepare Payload for Client ---
        const finalTotalXpForCurrentLevel = xpForLevel(character.level); // XP needed to *reach* current level
        const finalXpToNextLevelBracket = xpRequiredForLevel(character.level); // XP needed *for* current level bracket
        const finalCurrentLevelXp = character.experience - finalTotalXpForCurrentLevel; // XP earned within current level

        const finalCharacterUpdatePayload: any = {
            experience: character.experience, // Send total XP for potential debugging/other uses
            currentLevelXp: finalCurrentLevelXp, // Send XP within the current level
            xpToNextLevelBracket: finalXpToNextLevelBracket, // Send XP needed for the bracket
            inventory: character.inventory ?? [], // Send updated inventory, default to [] if undefined
        };
        if (leveledUp) {
            finalCharacterUpdatePayload.level = character.level;
            finalCharacterUpdatePayload.stats = character.stats;
            finalCharacterUpdatePayload.maxHp = character.maxHp;
            finalCharacterUpdatePayload.currentHp = character.currentHp;
            finalCharacterUpdatePayload.leveledUp = true; // Add a flag for the client
            finalCharacterUpdatePayload.statIncreases = statIncreases; // Send increases info
        }


        safeSend(ws, {
            type: 'encounter_end',
            payload: {
                reason: `Defeated ${defeatedMonsterName}! Gained ${xpGained} XP.`,
                characterUpdate: finalCharacterUpdatePayload, // Use the final payload
                loot: droppedLoot // Send the list of items actually dropped
            }
        });

        // Automatically find next monster after a short delay
        setTimeout(() => {
            console.log(`Finding next monster for ${character?.name}...`);
            // Check if connection is still valid before finding next monster
            if (activeConnections.has(ws)) {
                // Pass the updated interval maps
                handleFindMonster(ws, {}, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
            } else {
                console.log(`Connection closed before finding next monster for ${character?.name}.`);
            }
        }, 1500); // Delay before next fight

        return; // Player attack round ends here as monster is defeated
    }
    // Monster survived the player's attack
}


// --- Monster Attack Logic ---
async function performMonsterAttack(
    ws: WebSocket,
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    playerAttackIntervals: PlayerAttackIntervalsMap,
    monsterAttackIntervals: MonsterAttackIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    const encounter = activeEncounters.get(ws);

    // Validate connection, character selection, active encounter, and monster interval
    if (!connectionInfo || typeof connectionInfo.selectedCharacterId !== 'string' || !encounter || !monsterAttackIntervals.has(ws)) {
        console.log("Monster attack skipped or stopped due to invalid state.");
        // Don't clear state here if player interval might still be valid,
        // let the player attack check handle full cleanup if needed.
        // However, if the monster interval *specifically* is gone, clear it.
        const monsterInterval = monsterAttackIntervals.get(ws);
        if (monsterInterval) {
             clearInterval(monsterInterval);
             monsterAttackIntervals.delete(ws);
        }
        // If encounter is also gone, ensure full cleanup
        if (!activeEncounters.has(ws)) {
            clearCombatState(ws, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
        }
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;
    let character = await charactersCollection.findOne({ id: characterId });

    if (!character) {
        console.error(`Monster attack: Character ${characterId} not found in DB.`);
        // Don't send attack_fail here, player might be disconnected
        clearCombatState(ws, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
        return;
    }

    // --- Monster Attack Calculation ---
    // TODO: Enhance damage calculation (monster stats, abilities)
    let monsterDamage = encounter.baseDamage ?? 1; // Example base damage
    // Sanity check: Ensure damage is at least 1 (or 0)
    monsterDamage = Math.max(1, monsterDamage);
    const newHp = (character.currentHp ?? 0) - monsterDamage;
    // Enhanced Logging
    console.log(`Monster Attack: ${encounter.name} (Instance ID: ${encounter.id}) dealt ${monsterDamage} damage to ${character.name} (ID: ${characterId}). ${character.name} HP: ${newHp}/${character.maxHp ?? '??'}`);

    // --- Check if Player is Defeated ---
    if (newHp <= 0) {
        // Enhanced Logging
        console.log(`Player Death: ${character.name} (ID: ${characterId}) defeated by ${encounter.name} (Instance ID: ${encounter.id}).`);
        const defeatedByMonsterName = encounter.name; // Store name before clearing state

        // Stop combat loops and clear encounter state FIRST
        clearCombatState(ws, activeEncounters, playerAttackIntervals, monsterAttackIntervals);

        // --- Player Death Consequences ---
        character.currentHp = 0; // Set HP to 0 locally before DB update
        const respawnHp = calculateMaxHp(character.stats ?? { strength: 0, dexterity: 0, vitality: 0, energy: 0 });
        const respawnZoneId = 'town'; // Respawn in town

        // Removed duplicate respawnZoneId declaration

        // Update character HP and Zone in DB
        await charactersCollection.updateOne(
            { id: character.id },
            { $set: { currentHp: respawnHp, currentZoneId: respawnZoneId } }
        );

        // Update local character object for payload
        character.currentHp = respawnHp;
        character.currentZoneId = respawnZoneId;

        // Enhanced Logging
        console.log(`Respawn: ${character.name} (ID: ${characterId}) respawned in ${respawnZoneId} with ${respawnHp} HP.`);

        // TODO: Add XP loss? Other penalties?
        safeSend(ws, {
            type: 'player_death',
            payload: {
                message: `You were defeated by ${defeatedByMonsterName}! Respawning in Town...`,
                characterUpdate: {
                    currentHp: character.currentHp,
                    currentZoneId: character.currentZoneId,
                    level: character.level,
                    experience: character.experience,
                    // Calculate these based on the potentially updated character state after respawn
                    currentLevelXp: character.experience - xpForLevel(character.level),
                    xpToNextLevelBracket: xpRequiredForLevel(character.level),
                }
                // zoneData: zones.get(respawnZoneId) // Consider adding this
            }
        });
        return; // Monster attack round ends here as player is defeated
    }

    // --- Player Survived ---
    // Update HP in DB
    character.currentHp = newHp;
    await charactersCollection.updateOne({ id: character.id }, { $set: { currentHp: newHp } });

    // Send update to client
    const monsterAttackPayload: MonsterAttackUpdatePayload = {
        monsterDamageTaken: monsterDamage,
        characterUpdate: { currentHp: character.currentHp }
    };
    safeSend(ws, { type: 'monster_attack_update', payload: monsterAttackPayload });

    // No need to update encounter map here, monster state didn't change
    // Character state is fetched fresh next time
}

// Note: calculateXpReward is now defined earlier in the file.
// Note: generateLootFromTable is imported and used directly where needed.
