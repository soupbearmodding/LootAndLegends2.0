import WebSocket from 'ws';
import { InventoryService } from '../services/inventoryService.js';
import { send } from '../websocketUtils.js';
import { activeConnections } from '../server.js';
import {
    validatePayload,
    EquipItemPayloadSchema,
    UnequipItemPayloadSchema,
    SellItemPayloadSchema,
    AssignPotionSlotPayloadSchema,
    UsePotionSlotPayloadSchema,
    AutoEquipPayloadSchema
} from '../validation.js';
import { EquipmentSlot, Character, InventoryServiceResult } from '../types.js';

// Helper function to get character ID and handle errors
function getCharacterId(ws: WebSocket): string | null {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        send(ws, { type: 'error', payload: 'No character selected' });
        return null;
    }
    return connectionInfo.selectedCharacterId;
}

// Helper function to handle service result and send response
function handleServiceResult(ws: WebSocket, result: InventoryServiceResult, successType: string = 'character_update'): void {
    if (result.success && result.character) {
        send(ws, { type: successType, payload: result.character });
        // Optionally send an info message as well
        // send(ws, { type: 'info', payload: result.message });
    } else if (result.success) { // Success but no character data (e.g., maybe for a simple confirmation)
         send(ws, { type: 'info', payload: result.message });
    }
     else {
        send(ws, { type: 'error', payload: result.message });
    }
}


export class InventoryHandler {
    private inventoryService: InventoryService;

    constructor(inventoryService: InventoryService) {
        this.inventoryService = inventoryService;
    }

    async handleEquipItem(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, EquipItemPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid equip_item payload' });
            return;
        }
        const { itemId } = payload as { itemId: string };

        console.log(`Handler: Equip item request for char ${characterId}, item ${itemId}`);
        const result = await this.inventoryService.equipItem(characterId, itemId);
        handleServiceResult(ws, result);
    }

    async handleUnequipItem(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, UnequipItemPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid unequip_item payload' });
            return;
        }
        // Further validation for slot value needed here or in service
        const { slot } = payload as { slot: string };
        const validSlots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
        if (!validSlots.includes(slot as EquipmentSlot)) {
             send(ws, { type: 'error', payload: 'Invalid equipment slot provided' });
             return;
        }
        const slotToUnequip = slot as EquipmentSlot;


        console.log(`Handler: Unequip item request for char ${characterId}, slot ${slotToUnequip}`);
        const result = await this.inventoryService.unequipItem(characterId, slotToUnequip);
        handleServiceResult(ws, result);
    }

    async handleSellItem(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, SellItemPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid sell_item payload' });
            return;
        }
        const { itemId } = payload as { itemId: string };

        console.log(`Handler: Sell item request for char ${characterId}, item ${itemId}`);
        const result = await this.inventoryService.sellItem(characterId, itemId);
        handleServiceResult(ws, result);
    }

     async handleAssignPotionSlot(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, AssignPotionSlotPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid assign_potion_slot payload' });
            return;
        }
        // Additional validation for slotNumber and itemBaseId type/value
        const data = payload as { slotNumber: unknown, itemBaseId: unknown };
        if (data.slotNumber !== 1 && data.slotNumber !== 2) {
             send(ws, { type: 'error', payload: 'Invalid slot number (must be 1 or 2).' });
             return;
        }
         if (data.itemBaseId !== null && typeof data.itemBaseId !== 'string') {
             send(ws, { type: 'error', payload: 'Invalid itemBaseId (must be string or null).' });
             return;
         }
        const slotNumber = data.slotNumber as 1 | 2;
        const itemBaseId = data.itemBaseId as string | null;


        console.log(`Handler: Assign potion slot request for char ${characterId}, slot ${slotNumber}, baseId ${itemBaseId}`);
        const result = await this.inventoryService.assignPotionSlot(characterId, slotNumber, itemBaseId);
        handleServiceResult(ws, result);
    }

     async handleUsePotionSlot(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, UsePotionSlotPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid use_potion_slot payload' });
            return;
        }
         // Additional validation for slotNumber
         const data = payload as { slotNumber: unknown };
         if (data.slotNumber !== 1 && data.slotNumber !== 2) {
             send(ws, { type: 'error', payload: 'Invalid slot number (must be 1 or 2).' });
             return;
         }
         const slotNumber = data.slotNumber as 1 | 2;

        console.log(`Handler: Use potion slot request for char ${characterId}, slot ${slotNumber}`);
        const result = await this.inventoryService.usePotionSlot(characterId, slotNumber);
        handleServiceResult(ws, result);
    }

    async handleAutoEquipBestStat(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getCharacterId(ws);
        if (!characterId) return;

        if (!validatePayload(payload, AutoEquipPayloadSchema)) {
            send(ws, { type: 'error', payload: 'Invalid auto_equip_best_stat payload' });
            return;
        }
        // Additional validation for stat name
        const { stat } = payload as { stat: string };
        const validStats: (keyof Character['stats'])[] = ['strength', 'dexterity', 'vitality', 'energy'];
         if (!validStats.includes(stat as keyof Character['stats'])) {
             send(ws, { type: 'error', payload: `Invalid stat for auto-equip: ${stat}` });
             return;
         }
         const statKey = stat as keyof Character['stats'];

        console.log(`Handler: Auto-equip request for char ${characterId}, stat ${statKey}`);
        const result = await this.inventoryService.autoEquipBestStat(characterId, statKey);
        handleServiceResult(ws, result);
    }
}
