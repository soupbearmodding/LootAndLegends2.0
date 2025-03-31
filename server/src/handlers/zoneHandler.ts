import WebSocket from 'ws';
import { ZoneService, TravelResult } from '../services/zoneService.js';
import { CombatService } from '../services/combatService.js'; // Needed to clear combat state
import { CombatHandler } from './combatHandler.js'; // Needed to trigger find monster
import { send } from '../websocketUtils.js';
import { activeConnections } from '../server.js';
import { validatePayload, TravelPayloadSchema } from '../validation.js';
import { Character, Zone } from '../types.js'; // Import necessary types

// Helper function to get character ID and handle errors
function getCharacterId(ws: WebSocket): string | null {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        send(ws, { type: 'error', payload: 'No character selected' });
        return null;
    }
    return connectionInfo.selectedCharacterId;
}

export class ZoneHandler {
    private zoneService: ZoneService;
    private combatService: CombatService;
    private combatHandler: CombatHandler; // Need CombatHandler to trigger find monster

    constructor(zoneService: ZoneService, combatService: CombatService, combatHandler: CombatHandler) {
        this.zoneService = zoneService;
        this.combatService = combatService;
        this.combatHandler = combatHandler;
    }

    /**
     * Handles the 'travel' request from a client.
     */
    async handleTravel(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, TravelPayloadSchema)) {
            send(ws, { type: 'travel_fail', payload: 'Invalid travel payload' });
            return;
        }
        const { targetZoneId } = payload as { targetZoneId: string };

        console.log(`Handler: Travel request for char ${characterId} to zone ${targetZoneId}`);

        // --- Call Service to Perform Travel ---
        const travelResult = await this.zoneService.travel(characterId, targetZoneId);

        if (!travelResult.success || !travelResult.character || !travelResult.newZone || !travelResult.availableZones) {
            send(ws, { type: 'travel_fail', payload: travelResult.message });
            return;
        }

        // --- Clear Combat State if Necessary ---
        if (travelResult.needsCombatClear) {
            console.log(`Handler: Clearing combat state for char ${characterId} due to zone travel.`);
            this.combatService.clearCombatState(ws); // Use service method
             // Send encounter end message if combat was cleared
             send(ws, { type: 'encounter_end', payload: { reason: 'Zone changed' } });
        }

        // --- Send Travel Success Response ---
        send(ws, {
            type: 'travel_success',
            payload: {
                message: travelResult.message,
                characterData: travelResult.character, // Send updated character data
                zoneData: travelResult.newZone,
                availableZones: travelResult.availableZones
            }
        });

        // --- Start Combat if Necessary ---
        if (travelResult.startCombat) {
            console.log(`Handler: Entering combat zone ${travelResult.newZone.name}, finding monster...`);
            // Use a small delay to ensure travel_success message is processed first by client
            setTimeout(() => {
                // Ensure connection is still active before triggering combat
                if (activeConnections.has(ws)) {
                    // Call the CombatHandler's method to initiate the find monster flow
                    this.combatHandler.handleFindMonster(ws, {}); // Pass empty payload as none is needed
                } else {
                    console.log(`Handler: Connection closed before combat could start in new zone for char ${characterId}.`);
                }
            }, 100); // Short delay
        }
    }

    // TODO: Add handler for get_zone_statuses if needed (e.g., for map display)
    // async handleGetZoneStatuses(ws: WebSocket): Promise<void> { ... }
}
