import WebSocket from 'ws';
import { CraftingService, CraftingServiceResult, UpgradeServiceResult } from '../services/craftingService.js'; // Import UpgradeServiceResult
import { send } from '../websocketUtils.js';
import { activeConnections } from '../server.js';
import { validatePayload, CraftItemPayloadSchema, UpgradeItemPayloadSchema } from '../validation.js'; // Add UpgradeItemPayloadSchema
import { CraftingRecipe } from '../craftingData.js';

// Helper to get character ID from connection
function getSelectedCharacterId(ws: WebSocket): string | null {
    const connectionData = activeConnections.get(ws);
    if (!connectionData?.selectedCharacterId) {
        send(ws, { type: 'error', payload: 'No character selected.' });
        return null;
    }
    return connectionData.selectedCharacterId;
}

export class CraftingHandler {
    private craftingService: CraftingService;

    constructor(craftingService: CraftingService) {
        this.craftingService = craftingService;
    }

    /**
     * Handles request to get available crafting recipes.
     */
    async handleGetRecipes(ws: WebSocket): Promise<void> {
        const characterId = getSelectedCharacterId(ws);
        if (!characterId) return;

        try {
            const recipes: CraftingRecipe[] = await this.craftingService.getAvailableRecipes(characterId);
            send(ws, { type: 'available_recipes', payload: recipes });
        } catch (error: any) {
            console.error(`CraftingHandler: Error getting recipes for character ${characterId}:`, error);
            send(ws, { type: 'error', payload: 'Failed to retrieve crafting recipes.' });
        }
    }

    /**
     * Handles request to craft an item using a recipe.
     */
    async handleCraftItem(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getSelectedCharacterId(ws);
        if (!characterId) return;

        // TODO: Define CraftItemPayloadSchema in validation.ts
        // For now, assume it validates an object like { recipeId: string }
        if (!validatePayload(payload, CraftItemPayloadSchema)) {
             send(ws, { type: 'craft_item_fail', payload: 'Invalid payload format.' });
             return;
        }
        const { recipeId } = payload as { recipeId: string };

        try {
            const result: CraftingServiceResult = await this.craftingService.craftItem(characterId, recipeId);

            if (result.success && result.character) {
                // Send success message and updated character data
                send(ws, {
                    type: 'craft_item_success',
                    payload: { message: result.message, characterData: result.character }
                });
                // Note: InventoryService might also send an update if addItemToInventory is modified to do so.
                // Consider if sending the full character data here is redundant or necessary.
            } else {
                send(ws, { type: 'craft_item_fail', payload: result.message });
            }
        } catch (error: any) {
            console.error(`CraftingHandler: Error crafting item ${recipeId} for character ${characterId}:`, error);
            send(ws, { type: 'craft_item_fail', payload: 'An internal server error occurred during crafting.' });
        }
    }

    /**
     * Handles request to upgrade an item's affix.
     */
    async handleUpgradeItem(ws: WebSocket, payload: unknown): Promise<void> {
        const characterId = getSelectedCharacterId(ws);
        if (!characterId) return;

        // TODO: Define UpgradeItemPayloadSchema in validation.ts
        if (!validatePayload(payload, UpgradeItemPayloadSchema)) {
             send(ws, { type: 'upgrade_item_fail', payload: 'Invalid payload format.' });
             return;
        }
        // Payload includes itemId, recipeId, and optional affixId
        const { itemId, recipeId, affixId } = payload as { itemId: string; recipeId: string; affixId?: string | null };

        try {
            const result: UpgradeServiceResult = await this.craftingService.upgradeItemAffix(characterId, itemId, affixId, recipeId);

            if (result.success && result.character) {
                // Send success message and updated character data
                send(ws, {
                    type: 'upgrade_item_success',
                    payload: {
                        message: result.message,
                        characterData: result.character,
                        updatedItem: result.updatedItem // Send back the modified item
                    }
                });
            } else {
                send(ws, { type: 'upgrade_item_fail', payload: result.message });
            }
        } catch (error: any) {
            console.error(`CraftingHandler: Error upgrading item ${itemId} for character ${characterId}:`, error);
            send(ws, { type: 'upgrade_item_fail', payload: 'An internal server error occurred during upgrade.' });
        }
    }
}
