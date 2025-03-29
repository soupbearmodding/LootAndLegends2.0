import WebSocket from 'ws';
import { charactersCollection } from './db.js';
import { safeSend } from './utils.js';
import { ActiveConnectionsMap, Character, Item, EquipmentSlot } from './types.js';
import { baseItems, calculateMaxHp, xpForLevel } from './gameData.js'; // Import necessary game data/helpers

// Helper function to find an item in inventory by its unique ID
function findItemInInventory(inventory: Item[], itemId: string): Item | undefined {
    return inventory.find(item => item.id === itemId);
}

// Helper function to remove an item from inventory by its unique ID
function removeItemFromInventory(inventory: Item[], itemId: string): Item[] {
    return inventory.filter(item => item.id !== itemId);
}

// Helper function to recalculate character stats based on equipment
// TODO: This needs to be more comprehensive, considering base stats, level stats, etc.
// For now, just applies equipment stats on top of base stats.
function recalculateStats(character: Character): Character['stats'] {
    const baseStats = character.stats; // Assuming character.stats holds base+level stats before equipment
    const equipmentStats: Partial<Character['stats']> = {};

    for (const slot in character.equipment) {
        const item = character.equipment[slot as EquipmentSlot];
        if (item?.stats) {
            for (const stat in item.stats) {
                const key = stat as keyof Character['stats'];
                equipmentStats[key] = (equipmentStats[key] || 0) + (item.stats[key] || 0);
            }
        }
    }

    const finalStats: Character['stats'] = { ...baseStats };
    for (const stat in equipmentStats) {
        const key = stat as keyof Character['stats'];
        finalStats[key] = (baseStats[key] || 0) + (equipmentStats[key] || 0);
    }
    return finalStats;
}


// --- Equip Item Handler ---
export async function handleEquipItem(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo?.userId || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'equip_item_fail', payload: 'User or character not selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    if (!payload || typeof payload.itemId !== 'string') {
        safeSend(ws, { type: 'equip_item_fail', payload: 'Invalid request payload' });
        return;
    }
    const itemIdToEquip = payload.itemId;

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'equip_item_fail', payload: 'Character not found' });
            return;
        }

        const itemToEquip = findItemInInventory(character.inventory, itemIdToEquip);
        if (!itemToEquip) {
            safeSend(ws, { type: 'equip_item_fail', payload: 'Item not found in inventory' });
            return;
        }

        if (!itemToEquip.equipmentSlot) {
            safeSend(ws, { type: 'equip_item_fail', payload: 'Item is not equippable' });
            return;
        }

        const targetSlot = itemToEquip.equipmentSlot;
        const currentlyEquippedItem = character.equipment[targetSlot];

        // Prepare updates
        const updatedInventory = removeItemFromInventory(character.inventory, itemIdToEquip);
        const updatedEquipment = { ...character.equipment };
        updatedEquipment[targetSlot] = itemToEquip; // Equip the new item

        // If an item was previously equipped in that slot, move it to inventory
        if (currentlyEquippedItem) {
            updatedInventory.push(currentlyEquippedItem);
        }

        // --- Recalculate Stats and HP (Example) ---
        // Create a temporary character object with updated equipment to pass to recalculateStats
        const tempCharacterForStatCalc = { ...character, equipment: updatedEquipment };
        const finalStats = recalculateStats(tempCharacterForStatCalc);
        const newMaxHp = calculateMaxHp(finalStats);
        // Adjust current HP proportionally if max HP changed (or cap at new max)
        const hpRatio = character.maxHp > 0 ? character.currentHp / character.maxHp : 1;
        const newCurrentHp = Math.min(newMaxHp, Math.round(newMaxHp * hpRatio));
        // --- End Recalculation ---


        // Update character in DB
        const updateResult = await charactersCollection.updateOne(
            { id: characterId },
            {
                $set: {
                    inventory: updatedInventory,
                    equipment: updatedEquipment,
                    stats: finalStats, // Update stats based on new equipment
                    maxHp: newMaxHp,
                    currentHp: newCurrentHp,
                }
            }
        );

        if (updateResult.modifiedCount !== 1) {
            throw new Error('Failed to update character document in DB');
        }

        // Fetch the fully updated character to send back
        const updatedCharacter = await charactersCollection.findOne({ id: characterId });
        if (!updatedCharacter) {
             throw new Error('Failed to fetch updated character after equip');
        }

        // Add xpToNextLevel before sending
        const xpToNext = xpForLevel(updatedCharacter.level + 1);
        const characterDataWithXp = {
            ...updatedCharacter,
            xpToNextLevel: xpToNext
        };


        console.log(`Character ${character.name} equipped ${itemToEquip.name}`);
        safeSend(ws, { type: 'character_update', payload: characterDataWithXp }); // Send full updated character data

    } catch (error) {
        console.error("Equip item error:", error);
        safeSend(ws, { type: 'equip_item_fail', payload: 'Server error during equip' });
    }
}

// --- Unequip Item Handler ---
export async function handleUnequipItem(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo?.userId || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'unequip_item_fail', payload: 'User or character not selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    if (!payload || typeof payload.slot !== 'string') {
        safeSend(ws, { type: 'unequip_item_fail', payload: 'Invalid request payload (missing slot)' });
        return;
    }
    const slotToUnequip = payload.slot as EquipmentSlot;

    // Validate slot
    const validSlots: EquipmentSlot[] = ['head', 'chest', 'legs', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
    if (!validSlots.includes(slotToUnequip)) {
         safeSend(ws, { type: 'unequip_item_fail', payload: 'Invalid equipment slot' });
        return;
    }

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'unequip_item_fail', payload: 'Character not found' });
            return;
        }

        const itemToUnequip = character.equipment[slotToUnequip];
        if (!itemToUnequip) {
            safeSend(ws, { type: 'unequip_item_fail', payload: 'No item equipped in that slot' });
            return;
        }

        // TODO: Check if inventory has space? For now, assume infinite space.

        // Prepare updates
        const updatedInventory = [...character.inventory, itemToUnequip]; // Add item back to inventory
        const updatedEquipment = { ...character.equipment };
        delete updatedEquipment[slotToUnequip]; // Remove item from equipment slot

        // --- Recalculate Stats and HP (Similar to equip) ---
        const tempCharacterForStatCalc = { ...character, equipment: updatedEquipment };
        const finalStats = recalculateStats(tempCharacterForStatCalc);
        const newMaxHp = calculateMaxHp(finalStats);
        const hpRatio = character.maxHp > 0 ? character.currentHp / character.maxHp : 1;
        const newCurrentHp = Math.min(newMaxHp, Math.round(newMaxHp * hpRatio));
        // --- End Recalculation ---

        // Update character in DB
        const updateResult = await charactersCollection.updateOne(
            { id: characterId },
            {
                $set: {
                    inventory: updatedInventory,
                    equipment: updatedEquipment,
                    stats: finalStats,
                    maxHp: newMaxHp,
                    currentHp: newCurrentHp,
                }
            }
        );

        if (updateResult.modifiedCount !== 1) {
            throw new Error('Failed to update character document in DB');
        }

        // Fetch the fully updated character to send back
        const updatedCharacter = await charactersCollection.findOne({ id: characterId });
         if (!updatedCharacter) {
             throw new Error('Failed to fetch updated character after unequip');
        }

        // Add xpToNextLevel before sending
        const xpToNext = xpForLevel(updatedCharacter.level + 1);
        const characterDataWithXp = {
            ...updatedCharacter,
            xpToNextLevel: xpToNext
        };

        console.log(`Character ${character.name} unequipped ${itemToUnequip.name} from ${slotToUnequip}`);
        safeSend(ws, { type: 'character_update', payload: characterDataWithXp }); // Send full updated character data

    } catch (error) {
        console.error("Unequip item error:", error);
        safeSend(ws, { type: 'unequip_item_fail', payload: 'Server error during unequip' });
    }
}
