import WebSocket from 'ws';
import { charactersCollection } from './db.js';
import { safeSend } from './utils.js';
import { ActiveConnectionsMap, ActiveEncountersMap, PlayerAttackIntervalsMap, MonsterAttackIntervalsMap } from './types.js';
import { zones, calculateMaxHp } from './gameData.js';
import { handleFindMonster } from './combat.js';
import { Character, Zone } from './types.js';

// --- Zone Status Calculation ---

// Simplified status: only locked or unlocked based on level
export type ZoneStatus = 'unlocked' | 'locked';

// Simplified interface, removing kill-related fields
export interface ZoneWithStatus extends Zone {
    status: ZoneStatus;
}

/**
 * Calculates the unlock status for all zones based *only* on character level.
 * @param character The character object.
 * @returns An array of ZoneWithStatus objects.
 */
export function getZoneStatuses(character: Character): ZoneWithStatus[] {
    const allZonesArray = Array.from(zones.values());

    return allZonesArray.map(zone => {
        const isUnlocked = character.level >= zone.requiredLevel;
        return {
            ...zone,
            status: isUnlocked ? 'unlocked' : 'locked',
        };
    });
}


// --- Zone Handlers ---

export async function handleTravel(
    ws: WebSocket,
    payload: any,
    activeConnections: ActiveConnectionsMap,
    activeEncounters: ActiveEncountersMap,
    playerAttackIntervals: PlayerAttackIntervalsMap,
    monsterAttackIntervals: MonsterAttackIntervalsMap
) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.userId || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'travel_fail', payload: 'User or character not selected' });
        return;
    }
    // Assign to a new const *after* the check
    const characterId: string = connectionInfo.selectedCharacterId;
    // Fetch character from DB for current state
    let character = await charactersCollection.findOne({ id: characterId }); // Use let to allow reassignment
    if (!character) {
        // This case should ideally not happen if selectedCharacterId is valid, but good to keep
        safeSend(ws, { type: 'travel_fail', payload: 'Character data inconsistency' });
        return;
    }

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        typeof payload.targetZoneId !== 'string' || payload.targetZoneId.trim() === '')
    {
        safeSend(ws, { type: 'travel_fail', payload: 'Invalid payload format: Requires non-empty targetZoneId string.' });
        console.warn(`Invalid travel payload format received: ${JSON.stringify(payload)}`);
        return;
    }
    const targetZoneId = payload.targetZoneId;
    // --- End Validation ---

    const currentZone = zones.get(character.currentZoneId); // Use static zone data for checks
    const targetZone = zones.get(targetZoneId); // Use validated targetZoneId

    if (!currentZone || !targetZone) {
        safeSend(ws, { type: 'travel_fail', payload: 'Invalid current or target zone' });
        return;
    }

    // Check connectivity
    if (!currentZone.connectedZoneIds.includes(targetZoneId)) {
        safeSend(ws, { type: 'travel_fail', payload: `Cannot travel directly from ${currentZone.name} to ${targetZone.name}` });
        return;
    }

    // Check level requirement
    if (character.level < targetZone.requiredLevel) {
        safeSend(ws, { type: 'travel_fail', payload: `Level ${targetZone.requiredLevel} required to enter ${targetZone.name}` });
        return;
    }

    try {
        // Update character's current zone in DB
        const updateResult = await charactersCollection.updateOne(
            { id: character.id },
            { $set: { currentZoneId: targetZoneId } }
        );

        if (updateResult.modifiedCount !== 1) {
             throw new Error("Failed to update character zone in DB");
        }

        // --- Heal if entering Town ---
        let finalHp = character.currentHp; // Start with current HP
        if (targetZoneId === 'town') {
            const maxHp = calculateMaxHp(character.stats); // Calculate max HP
            if (character.currentHp < maxHp) {
                console.log(`Character ${character.name} entering town, healing to full HP (${maxHp}).`);
                await charactersCollection.updateOne({ id: character.id }, { $set: { currentHp: maxHp } });
                finalHp = maxHp; // Update HP for the payload
            }
        }

        // Update local character object after successful DB update(s)
        character.currentZoneId = targetZoneId;
        character.currentHp = finalHp; // Reflect potential healing

        console.log(`Character ${character.name} traveled to ${targetZone.name}`);

        // Send success message with potentially updated character data (HP) and new zone data
        safeSend(ws, {
            type: 'travel_success',
            payload: {
                message: `Traveled to ${targetZone.name}.`,
                characterData: character, // Send updated character data (with new zoneId)
                zoneData: targetZone,
                availableZones: targetZone.connectedZoneIds.map(id => zones.get(id)).filter(z => z) ?? []
            }
        });

        // Clear any previous encounter and combat intervals when moving zones
        const playerInterval = playerAttackIntervals.get(ws);
        if (playerInterval) {
            clearInterval(playerInterval);
            playerAttackIntervals.delete(ws);
            console.log(`Cleared player attack interval for ${character.name} due to zone travel.`);
        }
        const monsterInterval = monsterAttackIntervals.get(ws);
        if (monsterInterval) {
            clearInterval(monsterInterval);
            monsterAttackIntervals.delete(ws);
            console.log(`Cleared monster attack interval for ${character.name} due to zone travel.`);
        }
        if (activeEncounters.has(ws)) {
            activeEncounters.delete(ws);
            console.log(`Cleared encounter for ${character.name} due to zone travel.`);
            safeSend(ws, { type: 'encounter_end', payload: { reason: 'Zone changed' } });
        }

        // If the target zone is not the town, automatically start an encounter
        if (targetZone.id !== 'town') {
            console.log(`Entering combat zone ${targetZone.name}, finding monster...`);
            // Use a small delay to ensure travel_success message is processed first by client
            setTimeout(() => {
                // Pass the necessary maps to handleFindMonster (update interval maps)
                handleFindMonster(ws, {}, activeConnections, activeEncounters, playerAttackIntervals, monsterAttackIntervals);
            }, 100);
        }

    } catch (error) {
        console.error("Travel error:", error);
        safeSend(ws, { type: 'travel_fail', payload: 'Server error during travel' });
    }
}
