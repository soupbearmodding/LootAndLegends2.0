import WebSocket from 'ws';
import { charactersCollection } from './db.js';
import { safeSend, calculateCharacterStats } from './utils.js';

import { ActiveConnectionsMap, Character, EquipmentSlot, Item } from './types.js';
import { items } from './lootData.js';

// --- Inventory & Equipment Handlers ---

export async function handleEquipItem(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'error', payload: 'No character selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null || typeof payload.itemId !== 'string' || payload.itemId.trim() === '') {
        safeSend(ws, { type: 'error', payload: 'Invalid payload for equip_item: Requires non-empty itemId string.' });
        console.warn(`Invalid equip_item payload received: ${JSON.stringify(payload)}`);
        return;
    }
    const itemId = payload.itemId;
    // --- End Validation ---

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'error', payload: 'Character not found' });
            return;
        }

        const itemIndex = character.inventory.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            safeSend(ws, { type: 'error', payload: 'Item not found in inventory' });
            return;
        }
        const itemToEquip = character.inventory[itemIndex];

        if (!itemToEquip) {
            console.error(`Equip Error: Item not found at index ${itemIndex} despite findIndex success.`);
            safeSend(ws, { type: 'error', payload: 'Internal server error finding item' });
            return;
        }

        if (!itemToEquip.equipmentSlot) {
            safeSend(ws, { type: 'error', payload: 'Item is not equippable' });
            return;
        }
        const targetSlot = itemToEquip.equipmentSlot;

        const updates: Partial<Character> = {};
        const newInventory = [...character.inventory];
        const newEquipment = { ...character.equipment };

        newInventory.splice(itemIndex, 1);

        const currentItemInSlot = newEquipment[targetSlot];
        if (currentItemInSlot) {
            newInventory.push(currentItemInSlot);
        }

        newEquipment[targetSlot] = itemToEquip;
        updates.inventory = newInventory;
        updates.equipment = newEquipment;

        const updateResult = await charactersCollection.updateOne({ id: characterId }, { $set: updates });

        if (updateResult.modifiedCount === 1) {
            const updatedCharacter = await charactersCollection.findOne({ id: characterId });
            if (updatedCharacter) {
                const finalCharacterData = calculateCharacterStats(updatedCharacter);
                safeSend(ws, { type: 'character_update', payload: finalCharacterData });
                // Enhanced Logging
                console.log(`Character ${character.name} (ID: ${characterId}) equipped ${itemToEquip.name} (ID: ${itemToEquip.id}) to slot ${targetSlot}.`);
            } else {
                 throw new Error("Failed to fetch updated character after equip");
            }
        } else {
             console.warn(`Equip item DB update modified count was not 1 for character ${characterId}, item ${itemId}`);
             const currentCharacter = await charactersCollection.findOne({ id: characterId });
             if (currentCharacter) {
                 const finalCharacterData = calculateCharacterStats(currentCharacter);
                 safeSend(ws, { type: 'character_update', payload: finalCharacterData });
             }
        }
    } catch (error) {
        console.error("Equip item error:", error);
        safeSend(ws, { type: 'error', payload: 'Server error equipping item' });
    }
}

export async function handleUnequipItem(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'error', payload: 'No character selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null || typeof payload.slot !== 'string' || payload.slot.trim() === '') {
        safeSend(ws, { type: 'error', payload: 'Invalid payload for unequip_item: Requires non-empty slot string.' });
        console.warn(`Invalid unequip_item payload received: ${JSON.stringify(payload)}`);
        return;
    }
    const slotToUnequip = payload.slot as EquipmentSlot;
    // --- End Validation ---

    const validSlots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
    if (!validSlots.includes(slotToUnequip)) { // Now check if the validated string is a valid slot
        safeSend(ws, { type: 'error', payload: 'Invalid equipment slot provided' });
        return;
    }

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'error', payload: 'Character not found' });
            return;
        }

        const itemToUnequip = character.equipment[slotToUnequip];
        if (!itemToUnequip) {
            safeSend(ws, { type: 'error', payload: 'Slot is already empty' });
            return;
        }

        const updates: Partial<Character> = {};
        const newInventory = [...character.inventory];
        const newEquipment = { ...character.equipment };

        newInventory.push(itemToUnequip);
        delete newEquipment[slotToUnequip];
        updates.inventory = newInventory;
        updates.equipment = newEquipment;

        const updateResult = await charactersCollection.updateOne({ id: characterId }, { $set: updates });

        if (updateResult.modifiedCount === 1) {
             const updatedCharacter = await charactersCollection.findOne({ id: characterId });
             if (updatedCharacter) {
                 const finalCharacterData = calculateCharacterStats(updatedCharacter);
                 safeSend(ws, { type: 'character_update', payload: finalCharacterData });
                 // Enhanced Logging
                 console.log(`Character ${character.name} (ID: ${characterId}) unequipped ${itemToUnequip.name} (ID: ${itemToUnequip.id}) from slot ${slotToUnequip}.`);
             } else {
                  throw new Error("Failed to fetch updated character after unequip");
             }
        } else {
            console.warn(`Unequip item DB update modified count was not 1 for character ${characterId}, slot ${slotToUnequip}`);
            const currentCharacter = await charactersCollection.findOne({ id: characterId });
            if (currentCharacter) {
                const finalCharacterData = calculateCharacterStats(currentCharacter);
                safeSend(ws, { type: 'character_update', payload: finalCharacterData });
            }
        }
    } catch (error) {
        console.error("Unequip item error:", error);
        safeSend(ws, { type: 'error', payload: 'Server error unequipping item' });
    }
}

export async function handleSellItem(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'error', payload: 'No character selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null || typeof payload.itemId !== 'string' || payload.itemId.trim() === '') {
        safeSend(ws, { type: 'error', payload: 'Invalid payload for sell_item: Requires non-empty itemId string.' });
        console.warn(`Invalid sell_item payload received: ${JSON.stringify(payload)}`);
        return;
    }
    const itemId = payload.itemId;
    // --- End Validation ---

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'error', payload: 'Character not found' });
            return;
        }

        const itemIndex = character.inventory.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            safeSend(ws, { type: 'error', payload: 'Item not found in inventory' });
            return;
        }
        const itemToSell = character.inventory[itemIndex];

        if (!itemToSell) {
            console.error(`Sell Error: Item not found at index ${itemIndex} despite findIndex success.`);
            safeSend(ws, { type: 'error', payload: 'Internal server error finding item' });
            return;
        }

        if (itemToSell.baseId === 'gold_coins') {
            safeSend(ws, { type: 'error', payload: 'Cannot sell gold' });
            return;
        }

        const baseItemData = items.get(itemToSell.baseId);
        const sellValue = baseItemData?.sellValue ?? 1;

        const updates: Partial<Character> = {};
        const newInventory = [...character.inventory];

        newInventory.splice(itemIndex, 1);
        updates.inventory = newInventory;
        updates.gold = (character.gold || 0) + sellValue;

        const updateResult = await charactersCollection.updateOne({ id: characterId }, { $set: updates });

        if (updateResult.modifiedCount === 1) {
            const updatedCharacter = await charactersCollection.findOne({ id: characterId });
            if (updatedCharacter) {
                const finalCharacterData = calculateCharacterStats(updatedCharacter);
                safeSend(ws, { type: 'character_update', payload: finalCharacterData });
                 // Enhanced Logging
                console.log(`Character ${character.name} (ID: ${characterId}) sold ${itemToSell.name} (ID: ${itemToSell.id}) for ${sellValue} gold. New gold: ${finalCharacterData.gold}.`);
            } else {
                 throw new Error("Failed to fetch updated character after selling");
            }
        } else {
             console.warn(`Sell item DB update modified count was not 1 for character ${characterId}, item ${itemId}`);
             const currentCharacter = await charactersCollection.findOne({ id: characterId });
             if (currentCharacter) {
                 const finalCharacterData = calculateCharacterStats(currentCharacter);
                 safeSend(ws, { type: 'character_update', payload: finalCharacterData });
             }
        }
    } catch (error) {
        console.error("Sell item error:", error);
        safeSend(ws, { type: 'error', payload: 'Server error selling item' });
    }
}

export async function handleAssignPotionSlot(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'error', payload: 'No character selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        (payload.slotNumber !== 1 && payload.slotNumber !== 2) ||
        (payload.itemBaseId !== null && (typeof payload.itemBaseId !== 'string' || payload.itemBaseId.trim() === '')))
    {
        safeSend(ws, { type: 'error', payload: 'Invalid payload for assign_potion_slot: Requires slotNumber (1 or 2) and itemBaseId (string or null).' });
        console.warn(`Invalid assign_potion_slot payload received: ${JSON.stringify(payload)}`);
        return;
    }
    // We can be more confident about the types now after validation
    const { slotNumber, itemBaseId } = payload as { slotNumber: 1 | 2, itemBaseId: string | null };
    // --- End Validation ---

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'error', payload: 'Character not found' });
            return;
        }

        if (itemBaseId) {
            const hasPotion = character.inventory.some(item => item.baseId === itemBaseId && item.type === 'potion');
            if (!hasPotion) {
                safeSend(ws, { type: 'error', payload: `Potion with baseId ${itemBaseId} not found in inventory` });
                return;
            }
        }

        const updates: Partial<Character> = {};
        if (slotNumber === 1) updates.potionSlot1 = itemBaseId ?? undefined;
        else updates.potionSlot2 = itemBaseId ?? undefined;

        const updateResult = await charactersCollection.updateOne({ id: characterId }, { $set: updates });

        if (updateResult.modifiedCount === 1) {
            const updatedCharacter = await charactersCollection.findOne({ id: characterId });
            if (updatedCharacter) {
                const finalCharacterData = calculateCharacterStats(updatedCharacter);
                safeSend(ws, { type: 'character_update', payload: finalCharacterData });
                // Enhanced Logging
                console.log(`Character ${character.name} (ID: ${characterId}) assigned item baseId ${itemBaseId ?? 'null'} to potion slot ${slotNumber}.`);
            } else {
                 throw new Error("Failed to fetch updated character after assigning potion slot");
            }
        } else {
            console.log(`Potion slot ${slotNumber} assignment for ${character.name} resulted in no change.`);
            const currentCharacter = await charactersCollection.findOne({ id: characterId });
             if (currentCharacter) {
                 const finalCharacterData = calculateCharacterStats(currentCharacter);
                 safeSend(ws, { type: 'character_update', payload: finalCharacterData });
             } else {
                 throw new Error("Failed to fetch character after no-change potion assignment");
             }
        }
    } catch (error) {
        console.error("Assign potion slot error:", error);
        safeSend(ws, { type: 'error', payload: 'Server error assigning potion slot' });
    }
}

export async function handleUsePotionSlot(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'error', payload: 'No character selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null ||
        (payload.slotNumber !== 1 && payload.slotNumber !== 2))
    {
        safeSend(ws, { type: 'error', payload: 'Invalid payload for use_potion_slot: Requires slotNumber (1 or 2).' });
        console.warn(`Invalid use_potion_slot payload received: ${JSON.stringify(payload)}`);
        return;
    }
    // We can be more confident about the type now after validation
    const { slotNumber } = payload as { slotNumber: 1 | 2 };
    // --- End Validation ---

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'error', payload: 'Character not found' });
            return;
        }

        const potionBaseId = slotNumber === 1 ? character.potionSlot1 : character.potionSlot2;
        if (!potionBaseId) {
            safeSend(ws, { type: 'info', payload: `Potion slot ${slotNumber} is empty.` });
            return;
        }

        const potionDefinition = items.get(potionBaseId);
        if (!potionDefinition || potionDefinition.type !== 'potion' || typeof potionDefinition.effect !== 'object' || potionDefinition.effect === null) {
            console.error(`Potion definition or effect object not found for baseId: ${potionBaseId}`);
            safeSend(ws, { type: 'error', payload: 'Invalid potion data.' });
            return;
        }
        const { effect } = potionDefinition;

        const inventoryIndex = character.inventory.findIndex(item => item.baseId === potionBaseId);
        if (inventoryIndex === -1) {
            safeSend(ws, { type: 'info', payload: `No ${potionDefinition.name} found in inventory.` });
            return;
        }

        const potionToUse = character.inventory[inventoryIndex];
        if (!potionToUse) {
             console.error(`Use Potion Error: Item not found at index ${inventoryIndex} despite findIndex success.`);
             safeSend(ws, { type: 'error', payload: 'Internal server error finding potion' });
             return;
        }

        let hpRestored = 0;
        let manaRestored = 0;

        if (effect.health) {
            hpRestored = Math.min(effect.health, (character.maxHp ?? 0) - (character.currentHp ?? 0));
        } else if (effect.healthPercent) {
            hpRestored = Math.min(Math.floor((character.maxHp ?? 0) * effect.healthPercent), (character.maxHp ?? 0) - (character.currentHp ?? 0));
        }

        if (effect.mana) {
            manaRestored = Math.min(effect.mana, (character.maxMana ?? 0) - (character.currentMana ?? 0));
        } else if (effect.manaPercent) {
            manaRestored = Math.min(Math.floor((character.maxMana ?? 0) * effect.manaPercent), (character.maxMana ?? 0) - (character.currentMana ?? 0));
        }

        const updates: Partial<Character> = {};
        const newInventory = [...character.inventory];

        if (hpRestored > 0) updates.currentHp = (character.currentHp ?? 0) + hpRestored;
        if (manaRestored > 0) updates.currentMana = (character.currentMana ?? 0) + manaRestored;

        if (potionToUse.quantity && potionToUse.quantity > 1) {
            potionToUse.quantity -= 1;
            newInventory[inventoryIndex] = potionToUse;
        } else {
            newInventory.splice(inventoryIndex, 1);
        }
        updates.inventory = newInventory;

        if (hpRestored > 0 || manaRestored > 0 || updates.inventory.length !== character.inventory.length || (potionToUse.quantity && potionToUse.quantity + 1 === character.inventory[inventoryIndex]?.quantity)) {
            const updateResult = await charactersCollection.updateOne({ id: characterId }, { $set: updates });

            if (updateResult.modifiedCount >= 0) {
                const updatedCharacter = await charactersCollection.findOne({ id: characterId });
                if (updatedCharacter) {
                    const finalCharacterData = calculateCharacterStats(updatedCharacter);
                    safeSend(ws, { type: 'character_update', payload: finalCharacterData });
                    safeSend(ws, { type: 'info', payload: `Used ${potionDefinition.name}.` });
                    // Enhanced Logging
                    console.log(`Character ${character.name} (ID: ${characterId}) used ${potionDefinition.name} (BaseID: ${potionBaseId}) from slot ${slotNumber}. HP restored: ${hpRestored}, Mana restored: ${manaRestored}.`);
                } else {
                     throw new Error("Failed to fetch updated character after using potion");
                }
            } else {
                 throw new Error("Use potion database update failed");
            }
        } else {
            safeSend(ws, { type: 'info', payload: `Could not use ${potionDefinition.name} (already full?).` });
        }
    } catch (error) {
        console.error("Use potion slot error:", error);
        safeSend(ws, { type: 'error', payload: 'Server error using potion' });
    }
}

// --- NEW: Auto Equip Handler ---
export async function handleAutoEquipBestStat(ws: WebSocket, payload: any, activeConnections: ActiveConnectionsMap) {
    const connectionInfo = activeConnections.get(ws);
    if (!connectionInfo || !connectionInfo.selectedCharacterId) {
        safeSend(ws, { type: 'error', payload: 'No character selected' });
        return;
    }
    const characterId = connectionInfo.selectedCharacterId;

    // --- Stricter Payload Validation ---
    if (typeof payload !== 'object' || payload === null || typeof payload.stat !== 'string' || payload.stat.trim() === '') {
        safeSend(ws, { type: 'error', payload: 'Invalid payload for auto_equip_best_stat: Requires non-empty stat string.' });
        console.warn(`Invalid auto_equip_best_stat payload received: ${JSON.stringify(payload)}`);
        return;
    }
    const targetStat = payload.stat;
    // --- End Validation ---

    // Validate targetStat is a valid keyof Character['stats']
    const validStats: (keyof Character['stats'])[] = ['strength', 'dexterity', 'vitality', 'energy'];
    if (!validStats.includes(targetStat as keyof Character['stats'])) { // Check if the validated string is a valid stat
        safeSend(ws, { type: 'error', payload: `Invalid stat for auto-equip: ${targetStat}` });
        return;
    }
    const statKey = targetStat as keyof Character['stats']; // Use the correct key type

    console.log(`Character ${characterId} requested auto-equip for stat: ${statKey}`);

    try {
        const character = await charactersCollection.findOne({ id: characterId });
        if (!character) {
            safeSend(ws, { type: 'error', payload: 'Character not found' });
            return;
        }

        // --- Auto-Equip Logic ---
        const currentEquipment = { ...character.equipment };
        const currentInventory = [...character.inventory];
        const itemsToEquip: { item: Item; targetSlot: EquipmentSlot }[] = [];
        const slotsToUnequip: EquipmentSlot[] = [];
        const inventoryIndicesToRemove: number[] = [];

        const allSlots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];

        for (const slot of allSlots) {
            let bestItemForSlot: Item | null = null;
            let bestStatValue = -Infinity;
            let bestItemInventoryIndex = -1;

            const currentlyEquippedItem = currentEquipment[slot];
            const currentStatValue = currentlyEquippedItem?.stats?.[statKey] ?? 0;
            bestStatValue = currentStatValue;

            for (let i = 0; i < currentInventory.length; i++) {
                const item = currentInventory[i];
                if (!item || inventoryIndicesToRemove.includes(i) || item.equipmentSlot !== slot) {
                    continue;
                }
                const itemStatValue = item.stats?.[statKey] ?? 0;
                if (itemStatValue > bestStatValue) {
                    bestStatValue = itemStatValue;
                    bestItemForSlot = item;
                    bestItemInventoryIndex = i;
                }
            }

            if (bestItemForSlot && bestItemInventoryIndex !== -1) {
                console.log(`Found upgrade for slot ${slot}: ${bestItemForSlot.name} (${statKey}: ${bestStatValue}) replacing ${currentlyEquippedItem?.name ?? 'nothing'} (${statKey}: ${currentStatValue})`);
                itemsToEquip.push({ item: bestItemForSlot, targetSlot: slot });
                inventoryIndicesToRemove.push(bestItemInventoryIndex);
                if (currentlyEquippedItem) {
                    slotsToUnequip.push(slot);
                }
            }
        }

        // --- Perform the Swaps ---
        if (itemsToEquip.length === 0) {
            safeSend(ws, { type: 'info', payload: `No upgrades found for ${statKey}.` });
            return;
        }

        const finalInventory = [...character.inventory];
        const finalEquipment = { ...character.equipment };
        const unequippedItems: Item[] = [];

        // 1. Unequip old items
        for (const slot of slotsToUnequip) {
             if (Object.prototype.hasOwnProperty.call(finalEquipment, slot)) {
                const itemToUnequip = finalEquipment[slot];
                if (itemToUnequip) { unequippedItems.push(itemToUnequip); }
                delete finalEquipment[slot];
            }
        }

        // 2. Remove new items from inventory
        inventoryIndicesToRemove.sort((a, b) => b - a);
        const itemsBeingEquipped: Item[] = [];
        for (const index of inventoryIndicesToRemove) {
            const removedItems = finalInventory.splice(index, 1);
            if (removedItems.length > 0 && removedItems[0]) { itemsBeingEquipped.push(removedItems[0]); }
        }

        // 3. Add unequipped items back to inventory
        finalInventory.push(...unequippedItems);

        // 4. Equip the new best items
        for (const { item, targetSlot } of itemsToEquip) {
             const itemToActuallyEquip = itemsBeingEquipped.find(i => i.id === item.id);
             if (itemToActuallyEquip) {
                 finalEquipment[targetSlot] = itemToActuallyEquip;
             } else {
                 console.error(`Error during auto-equip: Could not find item ${item.id} after removing from inventory.`);
             }
        }

        // --- Update DB ---
        const updates: Partial<Character> = { inventory: finalInventory, equipment: finalEquipment };
        const updateResult = await charactersCollection.updateOne({ id: characterId }, { $set: updates });

        if (updateResult.modifiedCount > 0) {
            const updatedCharacter = await charactersCollection.findOne({ id: characterId });
            if (updatedCharacter) {
                const finalCharacterData = calculateCharacterStats(updatedCharacter);
                safeSend(ws, { type: 'character_update', payload: finalCharacterData });
                safeSend(ws, { type: 'info', payload: `Auto-equipped best items for ${statKey}.` });
                // Enhanced Logging
                console.log(`Character ${character.name} (ID: ${characterId}) auto-equipped for stat: ${statKey}. Items changed: ${itemsToEquip.length}.`);
            } else {
                 throw new Error("Failed to fetch updated character after auto-equip");
            }
        } else {
             safeSend(ws, { type: 'info', payload: `No equipment changes made for ${statKey}.` });
        }

    } catch (error) {
        // Use optional chaining and provide a default value for statKey in the error message
        const safeStatKey = statKey ?? 'unknown stat';
        console.error(`Auto-equip ${safeStatKey} error:`, error);
        safeSend(ws, { type: 'error', payload: `Server error during auto-equip for ${safeStatKey}` });
    }
}
