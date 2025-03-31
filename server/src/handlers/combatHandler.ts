import WebSocket from 'ws';
import { CombatService, FindMonsterResult, AttackResult } from '../services/combatService.js';
import { send } from '../websocketUtils.js';
import { activeConnections, playerAttackIntervals, monsterAttackIntervals, activeEncounters } from '../server.js'; // Import state maps
import { validatePayload, FindMonsterPayloadSchema } from '../validation.js';
import { Character } from '../types.js'; // Import necessary types
import { randomInt } from '../utils.js'; // Import randomInt

// Helper function to get character ID and handle errors
function getCharacterId(ws: WebSocket): string | null {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        send(ws, { type: 'error', payload: 'No character selected' });
        return null;
    }
    return connectionInfo.selectedCharacterId;
}

export class CombatHandler {
    private combatService: CombatService;

    constructor(combatService: CombatService) {
        this.combatService = combatService;
    }

    /**
     * Handles the 'find_monster' request from a client.
     * Initiates an encounter if possible and starts combat loops.
     */
    async handleFindMonster(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        // Validate payload (currently empty schema)
        if (!validatePayload(payload, FindMonsterPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid find_monster payload' });
            return;
        }

        console.log(`Handler: Find monster request for char ${characterId}`);

        // --- Check for existing combat state ---
        // Prevent starting a new encounter if already in one or loops are somehow active
        if (activeEncounters.has(ws) || playerAttackIntervals.has(ws) || monsterAttackIntervals.has(ws)) {
             console.warn(`Handler: Character ${characterId} tried to find monster while already in combat or loops active.`);
             // Clear any potentially orphaned state just in case
             this.combatService.clearCombatState(ws);
             send(ws, { type: 'find_monster_fail', payload: 'Previous combat state detected, clearing.' });
             // Try finding again after a short delay? Or force client action? For now, just fail.
             return;
        }


        // --- Call Service to Find Monster ---
        const findResult = await this.combatService.findMonster(characterId, ws);

        if (!findResult.success || !findResult.monster || findResult.playerAttackSpeed === undefined) {
            send(ws, { type: 'find_monster_fail', payload: findResult.message });
            return;
        }

        const monsterInstance = findResult.monster;
        const playerAttackSpeed = findResult.playerAttackSpeed;
        const monsterAttackSpeed = monsterInstance.attackSpeed; // Already validated in service

        console.log(`Handler: Encounter started for char ${characterId} vs ${monsterInstance.name}. Player Speed: ${playerAttackSpeed}ms, Monster Speed: ${monsterAttackSpeed}ms`);

        // --- Send Encounter Start Message ---
        send(ws, { type: 'encounter_start', payload: { monster: monsterInstance } });

        // --- Start Combat Intervals ---
        this.startCombatIntervals(ws, characterId, playerAttackSpeed, monsterAttackSpeed);
    }

    /**
     * Starts the player and monster attack intervals for a combat encounter.
     */
    private startCombatIntervals(ws: WebSocket, characterId: string, playerAttackSpeed: number, monsterAttackSpeed: number): void {
        // Clear any potentially existing intervals first (safety measure)
        this.clearAndStopIntervals(ws);

        console.log(`Handler: Starting combat intervals for char ${characterId}. Player: ${playerAttackSpeed}ms, Monster: ${monsterAttackSpeed}ms`);

        // Player Attack Interval
        const playerIntervalId = setInterval(async () => {
            // Check if encounter still exists before attacking
            if (!activeEncounters.has(ws)) {
                console.log(`Handler: Player interval detected encounter ended for char ${characterId}. Stopping.`);
                this.clearAndStopIntervals(ws); // Stop loops if encounter ended unexpectedly
                return;
            }
            const result = await this.combatService.performPlayerAttack(ws, characterId);
            this.handleAttackResult(ws, result);
            // If encounter ended, the service call would have cleared state, loops will stop on next check
        }, playerAttackSpeed);
        playerAttackIntervals.set(ws, playerIntervalId); // Store interval ID

        // Monster Attack Interval (with slight delay)
        // Use setTimeout to delay the start of the monster interval slightly
        const monsterDelay = randomInt(100, 300);
        setTimeout(() => {
            // Check if the encounter is still active before starting the monster interval
            if (activeEncounters.has(ws)) {
                const monsterIntervalId = setInterval(async () => {
                     // Check if encounter still exists before attacking
                    if (!activeEncounters.has(ws)) {
                        console.log(`Handler: Monster interval detected encounter ended for char ${characterId}. Stopping.`);
                        this.clearAndStopIntervals(ws); // Stop loops if encounter ended unexpectedly
                        return;
                    }
                    const result = await this.combatService.performMonsterAttack(ws, characterId);
                    this.handleAttackResult(ws, result);
                     // If encounter ended, the service call would have cleared state, loops will stop on next check
                }, monsterAttackSpeed);
                monsterAttackIntervals.set(ws, monsterIntervalId); // Store interval ID
                console.log(`Handler: Started monster attack interval (${monsterAttackSpeed}ms) after ${monsterDelay}ms delay for char ${characterId}.`);
            } else {
                 console.log(`Handler: Encounter for char ${characterId} ended before monster interval could start.`);
                 // Ensure player interval is also cleared if it somehow wasn't already
                 this.clearAndStopIntervals(ws);
            }
        }, monsterDelay);
    }

     /**
      * Clears combat intervals associated with a WebSocket connection.
      */
     private clearAndStopIntervals(ws: WebSocket): void {
         const playerInterval = playerAttackIntervals.get(ws);
         if (playerInterval) {
             clearInterval(playerInterval);
             playerAttackIntervals.delete(ws);
             console.log("Handler: Cleared player attack interval.");
         }
         const monsterInterval = monsterAttackIntervals.get(ws);
         if (monsterInterval) {
             clearInterval(monsterInterval);
             monsterAttackIntervals.delete(ws);
             console.log("Handler: Cleared monster attack interval.");
         }
         // Note: Encounter state (activeEncounters) is cleared by the CombatService methods upon death/defeat.
     }


    /**
     * Processes the result of an attack (player or monster) and sends updates to the client.
     */
    private handleAttackResult(ws: WebSocket, result: AttackResult): void {
        if (!result.success && !result.encounterEnded) {
            // Send specific error only if the attack failed but encounter didn't end for other reasons
            send(ws, { type: 'error', payload: result.message || 'Attack failed.' });
            return;
        }

        // Send Player Attack Update (damage dealt, monster HP)
        if (result.playerUpdate) {
            send(ws, { type: 'player_attack_update', payload: result.playerUpdate });
        }

        // Send Monster Attack Update (damage taken, player HP)
        if (result.monsterUpdate) {
            send(ws, { type: 'monster_attack_update', payload: result.monsterUpdate });
        }

        // Handle Encounter End (Monster Defeat or Player Death)
        if (result.encounterEnded) {
            console.log(`Handler: Encounter ended. Reason: ${result.endReason}`);
            // Stop intervals (should already be stopped by service, but belt-and-suspenders)
            this.clearAndStopIntervals(ws);

            if (result.respawn) {
                // Player Death
                send(ws, {
                    type: 'player_death',
                    payload: {
                        message: result.message, // e.g., "You were defeated by..."
                        characterUpdate: result.characterUpdate // Contains respawn state
                    }
                });
            } else {
                // Monster Defeat
                send(ws, {
                    type: 'encounter_end',
                    payload: {
                        reason: result.endReason,
                        characterUpdate: result.characterUpdate, // Contains XP, level, inventory updates
                        loot: result.loot || []
                    }
                });
                // Optionally trigger finding next monster automatically after a delay
                this.scheduleNextMonster(ws);
            }
        }
    }

    /**
     * Schedules finding the next monster after a short delay.
     */
    private scheduleNextMonster(ws: WebSocket): void {
         setTimeout(() => {
            const characterId = getCharacterId(ws);
            if (characterId && activeConnections.has(ws)) { // Check connection still active
                console.log(`Handler: Automatically finding next monster for char ${characterId}...`);
                // Ensure no combat state exists before finding next
                if (!activeEncounters.has(ws) && !playerAttackIntervals.has(ws) && !monsterAttackIntervals.has(ws)) {
                    this.handleFindMonster(ws, {}); // Re-trigger find monster
                } else {
                     console.warn(`Handler: Cannot auto-find next monster for char ${characterId}, combat state still exists.`);
                     // Attempt to clear state again just in case
                     this.combatService.clearCombatState(ws);
                }
            } else {
                console.log(`Handler: Connection closed or character deselected before finding next monster.`);
            }
        }, 1500); // Delay before finding next monster
    }

}
