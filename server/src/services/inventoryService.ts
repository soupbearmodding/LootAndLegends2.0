import { Character, Item, EquipmentSlot, ICharacterRepository, InventoryServiceResult } from '../types.js';
import { calculateCharacterStats } from '../utils.js';

import { items as itemDefinitions } from '../lootData.js';




export class InventoryService {
    private characterRepository: ICharacterRepository;

    constructor(characterRepository: ICharacterRepository) {
        this.characterRepository = characterRepository;
    }

    /**
     * Equips an item from a character's inventory to the appropriate slot.
     * @param characterId The ID of the character.
     * @param itemId The ID of the item instance in the inventory to equip.
     * @returns InventoryServiceResult indicating success/failure and the updated character.
     */
    async equipItem(characterId: string, itemId: string): Promise<InventoryServiceResult> {
        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            // Ensure inventory and equipment are initialized
            const currentInventory = character.inventory || [];
            const currentEquipment = character.equipment || {};

            const itemIndex = currentInventory.findIndex(item => item.id === itemId);
            if (itemIndex === -1) {
                return { success: false, message: 'Item not found in inventory' };
            }
            const itemToEquip = currentInventory[itemIndex];

            if (!itemToEquip) {
                // This case should ideally not happen if findIndex succeeded
                console.error(`InventoryService: Item ${itemId} found at index ${itemIndex} but object is undefined.`);
                return { success: false, message: 'Internal server error finding item' };
            }

            if (!itemToEquip.equipmentSlot) {
                return { success: false, message: 'Item is not equippable' };
            }
            const targetSlot = itemToEquip.equipmentSlot;

            // Prepare updates
            const newInventory = [...currentInventory];
            const newEquipment = { ...currentEquipment };

            // Remove item from inventory
            newInventory.splice(itemIndex, 1);

            // Move currently equipped item (if any) to inventory
            const currentItemInSlot = newEquipment[targetSlot];
            if (currentItemInSlot) {
                newInventory.push(currentItemInSlot);
            }

            // Place new item in equipment slot
            newEquipment[targetSlot] = itemToEquip;

            // Prepare update payload for the repository
            const updates: Partial<Character> = {
                inventory: newInventory,
                equipment: newEquipment,
            };

            // Save updates using the repository
            await this.characterRepository.update(characterId, updates);

            // Fetch the fully updated character to recalculate stats and return
            const updatedCharacterRaw = await this.characterRepository.findById(characterId);
            if (!updatedCharacterRaw) {
                 // Should not happen if update succeeded, but handle defensively
                 console.error(`InventoryService: Failed to fetch character ${characterId} after equip update.`);
                 return { success: false, message: 'Failed to retrieve updated character data.' };
            }

            // Recalculate stats based on the new equipment
            const finalCharacterData = calculateCharacterStats(updatedCharacterRaw);

            console.log(`InventoryService: Character ${finalCharacterData.name} equipped ${itemToEquip.name} to ${targetSlot}.`);
            return { success: true, message: 'Item equipped.', character: finalCharacterData };

        } catch (error) {
            console.error(`Error in InventoryService.equipItem for character ${characterId}, item ${itemId}:`, error);
            return { success: false, message: 'An internal server error occurred while equipping the item.' };
        }
    }

    /**
     * Unequips an item from a specified equipment slot back into the inventory.
     * @param characterId The ID of the character.
     * @param slotToUnequip The equipment slot to unequip from.
     * @returns InventoryServiceResult indicating success/failure and the updated character.
     */
    async unequipItem(characterId: string, slotToUnequip: EquipmentSlot): Promise<InventoryServiceResult> {
        // Basic validation for slot name (could be enhanced with enum check if needed)
        const validSlots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
        if (!validSlots.includes(slotToUnequip)) {
            return { success: false, message: 'Invalid equipment slot provided' };
        }

        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            // Ensure inventory and equipment are initialized
            const currentInventory = character.inventory || [];
            const currentEquipment = character.equipment || {};

            const itemToUnequip = currentEquipment[slotToUnequip];
            if (!itemToUnequip) {
                return { success: false, message: 'Slot is already empty' };
            }

            // Prepare updates
            const newInventory = [...currentInventory];
            const newEquipment = { ...currentEquipment };

            // Add item to inventory
            newInventory.push(itemToUnequip);
            // Remove item from equipment
            delete newEquipment[slotToUnequip];

            // Prepare update payload
            const updates: Partial<Character> = {
                inventory: newInventory,
                equipment: newEquipment,
            };

            // Save updates
            await this.characterRepository.update(characterId, updates);

            // Fetch updated character
            const updatedCharacterRaw = await this.characterRepository.findById(characterId);
             if (!updatedCharacterRaw) {
                 console.error(`InventoryService: Failed to fetch character ${characterId} after unequip update.`);
                 return { success: false, message: 'Failed to retrieve updated character data.' };
            }

            // Recalculate stats
            const finalCharacterData = calculateCharacterStats(updatedCharacterRaw);

            console.log(`InventoryService: Character ${finalCharacterData.name} unequipped ${itemToUnequip.name} from ${slotToUnequip}.`);
            return { success: true, message: 'Item unequipped.', character: finalCharacterData };

        } catch (error) {
            console.error(`Error in InventoryService.unequipItem for character ${characterId}, slot ${slotToUnequip}:`, error);
            return { success: false, message: 'An internal server error occurred while unequipping the item.' };
        }
    }

    /**
     * Sells an item from the character's inventory.
     * @param characterId The ID of the character.
     * @param itemId The ID of the item instance in the inventory to sell.
     * @returns InventoryServiceResult indicating success/failure and the updated character.
     */
    async sellItem(characterId: string, itemId: string): Promise<InventoryServiceResult> {
        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            const currentInventory = character.inventory || [];

            const itemIndex = currentInventory.findIndex(item => item.id === itemId);
            if (itemIndex === -1) {
                return { success: false, message: 'Item not found in inventory' };
            }
            const itemToSell = currentInventory[itemIndex];

            if (!itemToSell) {
                console.error(`InventoryService: Sell Error - Item ${itemId} found at index ${itemIndex} but object is undefined.`);
                return { success: false, message: 'Internal server error finding item to sell' };
            }

            // Prevent selling gold itself (if it were ever an item)
            if (itemToSell.baseId === 'gold_coins') {
                return { success: false, message: 'Cannot sell gold' };
            }

            // Get sell value from static data, default to 1 if not found
            const baseItemData = itemDefinitions.get(itemToSell.baseId);
            // Ensure sellValue is treated as a number, default to 1 if undefined or not a number
            const sellValue = (typeof baseItemData?.sellValue === 'number') ? baseItemData.sellValue : 1;


            // Prepare updates
            const newInventory = [...currentInventory];
            newInventory.splice(itemIndex, 1); // Remove item

            const currentGold = character.gold || 0;
            const newGold = currentGold + sellValue;

            const updates: Partial<Character> = {
                inventory: newInventory,
                gold: newGold,
            };

            // Save updates
            await this.characterRepository.update(characterId, updates);

            // Fetch updated character
            const updatedCharacterRaw = await this.characterRepository.findById(characterId);
            if (!updatedCharacterRaw) {
                 console.error(`InventoryService: Failed to fetch character ${characterId} after sell update.`);
                 return { success: false, message: 'Failed to retrieve updated character data.' };
            }

            // Recalculate stats (might not be necessary for selling, but good practice)
            const finalCharacterData = calculateCharacterStats(updatedCharacterRaw);

            console.log(`InventoryService: Character ${finalCharacterData.name} sold ${itemToSell.name} for ${sellValue} gold. New gold: ${finalCharacterData.gold}.`);
            return { success: true, message: 'Item sold.', character: finalCharacterData };

        } catch (error) {
            console.error(`Error in InventoryService.sellItem for character ${characterId}, item ${itemId}:`, error);
            return { success: false, message: 'An internal server error occurred while selling the item.' };
        }
    }

    /**
     * Assigns a potion base ID to a specific quick slot (1 or 2).
     * @param characterId The ID of the character.
     * @param slotNumber The slot number (1 or 2).
     * @param itemBaseId The base ID of the potion to assign, or null to clear the slot.
     * @returns InventoryServiceResult indicating success/failure and the updated character.
     */
    async assignPotionSlot(characterId: string, slotNumber: 1 | 2, itemBaseId: string | null): Promise<InventoryServiceResult> {
        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            // If assigning an item, verify it's a potion and exists in inventory
            if (itemBaseId) {
                const potionDefinition = itemDefinitions.get(itemBaseId);
                if (!potionDefinition || potionDefinition.type !== 'potion') {
                    return { success: false, message: `Item ${itemBaseId} is not a valid potion.` };
                }
                const hasPotion = (character.inventory || []).some(item => item.baseId === itemBaseId);
                if (!hasPotion) {
                    return { success: false, message: `Potion ${potionDefinition.name} not found in inventory.` };
                }
            }

            // Prepare updates
            const updates: Partial<Character> = {};
            if (slotNumber === 1) {
                updates.potionSlot1 = itemBaseId ?? undefined; // Use undefined to clear field in DB if null
            } else {
                updates.potionSlot2 = itemBaseId ?? undefined;
            }

            // Save updates
            await this.characterRepository.update(characterId, updates);

            // Fetch updated character
            const updatedCharacterRaw = await this.characterRepository.findById(characterId);
            if (!updatedCharacterRaw) {
                 console.error(`InventoryService: Failed to fetch character ${characterId} after assign potion slot update.`);
                 return { success: false, message: 'Failed to retrieve updated character data.' };
            }

            // Recalculate stats (likely no change, but good practice)
            const finalCharacterData = calculateCharacterStats(updatedCharacterRaw);

            console.log(`InventoryService: Character ${finalCharacterData.name} assigned ${itemBaseId ?? 'nothing'} to potion slot ${slotNumber}.`);
            return { success: true, message: `Potion slot ${slotNumber} updated.`, character: finalCharacterData };

        } catch (error) {
            console.error(`Error in InventoryService.assignPotionSlot for character ${characterId}, slot ${slotNumber}:`, error);
            return { success: false, message: 'An internal server error occurred while assigning the potion slot.' };
        }
    }

     /**
     * Uses a potion from the assigned quick slot.
     * @param characterId The ID of the character.
     * @param slotNumber The slot number (1 or 2) to use.
     * @returns InventoryServiceResult indicating success/failure and the updated character.
     */
    async usePotionSlot(characterId: string, slotNumber: 1 | 2): Promise<InventoryServiceResult> {
        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            const potionBaseId = slotNumber === 1 ? character.potionSlot1 : character.potionSlot2;
            if (!potionBaseId) {
                return { success: false, message: `Potion slot ${slotNumber} is empty.` }; // Changed from info to error for consistency
            }

            const potionDefinition = itemDefinitions.get(potionBaseId);
            // Check for potion effect definition - this needs refinement based on actual Item type structure
            if (!potionDefinition || potionDefinition.type !== 'potion' /* || !potionDefinition.effect */) {
                 console.error(`InventoryService: Potion definition or effect not found for baseId: ${potionBaseId}`);
                 // Need to define how effects are stored on Item type in types.ts
                 // Assuming effect structure like { health?: number; healthPercent?: number; mana?: number; manaPercent?: number }
                 return { success: false, message: 'Invalid potion data definition.' };
            }
            // Assuming effect structure exists on the definition (needs type update)
            const effect = (potionDefinition as any).effect as { health?: number; healthPercent?: number; mana?: number; manaPercent?: number } || {};


            const currentInventory = character.inventory || [];
            const inventoryIndex = currentInventory.findIndex(item => item.baseId === potionBaseId);
            if (inventoryIndex === -1) {
                return { success: false, message: `No ${potionDefinition.name} found in inventory.` }; // Changed from info to error
            }

            const potionToUse = currentInventory[inventoryIndex];
             if (!potionToUse) {
                 console.error(`InventoryService: Use Potion Error - Item ${potionBaseId} found at index ${inventoryIndex} but object is undefined.`);
                 return { success: false, message: 'Internal server error finding potion' };
             }

            // Calculate effect
            let hpRestored = 0;
            let manaRestored = 0;
            const maxHp = character.maxHp || 0;
            const currentHp = character.currentHp || 0;
            const maxMana = character.maxMana || 0;
            const currentMana = character.currentMana || 0;

            if (effect.health) {
                hpRestored = Math.min(effect.health, maxHp - currentHp);
            } else if (effect.healthPercent) {
                hpRestored = Math.min(Math.floor(maxHp * effect.healthPercent), maxHp - currentHp);
            }

            if (effect.mana) {
                manaRestored = Math.min(effect.mana, maxMana - currentMana);
            } else if (effect.manaPercent) {
                manaRestored = Math.min(Math.floor(maxMana * effect.manaPercent), maxMana - currentMana);
            }

            hpRestored = Math.max(0, hpRestored); // Ensure non-negative
            manaRestored = Math.max(0, manaRestored); // Ensure non-negative

            if (hpRestored === 0 && manaRestored === 0) {
                 return { success: false, message: `Could not use ${potionDefinition.name} (already full?).` }; // Changed from info
            }

            // Prepare updates
            const updates: Partial<Character> = {};
            const newInventory = [...currentInventory];

            if (hpRestored > 0) updates.currentHp = currentHp + hpRestored;
            if (manaRestored > 0) updates.currentMana = currentMana + manaRestored;

            // Update inventory (decrement quantity or remove)
            if (potionToUse.quantity && potionToUse.quantity > 1) {
                // Create a new item object with decremented quantity to avoid mutating the original
                 newInventory[inventoryIndex] = { ...potionToUse, quantity: potionToUse.quantity - 1 };
            } else {
                newInventory.splice(inventoryIndex, 1);
            }
            updates.inventory = newInventory;

            // Save updates
            await this.characterRepository.update(characterId, updates);

            // Fetch updated character
            const updatedCharacterRaw = await this.characterRepository.findById(characterId);
            if (!updatedCharacterRaw) {
                 console.error(`InventoryService: Failed to fetch character ${characterId} after use potion update.`);
                 return { success: false, message: 'Failed to retrieve updated character data.' };
            }

            // Recalculate stats
            const finalCharacterData = calculateCharacterStats(updatedCharacterRaw);

            console.log(`InventoryService: Character ${finalCharacterData.name} used ${potionDefinition.name}. HP restored: ${hpRestored}, Mana restored: ${manaRestored}.`);
            return { success: true, message: `Used ${potionDefinition.name}.`, character: finalCharacterData };

        } catch (error) {
            console.error(`Error in InventoryService.usePotionSlot for character ${characterId}, slot ${slotNumber}:`, error);
            return { success: false, message: 'An internal server error occurred while using the potion.' };
        }
    }

    /**
     * Automatically equips the best items from inventory for a specific stat.
     * @param characterId The ID of the character.
     * @param statKey The stat to optimize for ('strength', 'dexterity', 'vitality', 'energy').
     * @returns InventoryServiceResult indicating success/failure and the updated character.
     */
    async autoEquipBestStat(characterId: string, statKey: keyof Character['stats']): Promise<InventoryServiceResult> {
         // Validate targetStat is a valid keyof Character['stats']
        const validStats: (keyof Character['stats'])[] = ['strength', 'dexterity', 'vitality', 'energy'];
        if (!validStats.includes(statKey)) {
            return { success: false, message: `Invalid stat for auto-equip: ${statKey}` };
        }

        console.log(`InventoryService: Character ${characterId} requested auto-equip for stat: ${statKey}`);

        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            // --- Auto-Equip Logic ---
            const currentEquipment = character.equipment || {};
            const currentInventory = character.inventory || [];
            const itemsToEquip: { item: Item; targetSlot: EquipmentSlot }[] = [];
            const slotsToUnequip: EquipmentSlot[] = [];
            const inventoryIndicesToRemove: number[] = []; // Track indices to remove *from the original inventory array*

            const allSlots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];

            for (const slot of allSlots) {
                let bestItemForSlot: Item | null = null;
                let bestStatValue = -Infinity;
                let bestItemInventoryIndex = -1;

                // Consider the currently equipped item as the baseline
                const currentlyEquippedItem = currentEquipment[slot];
                const currentStatValue = currentlyEquippedItem?.stats?.[statKey] ?? 0;
                bestStatValue = currentStatValue; // Initialize best value with current item's stat

                // Iterate through inventory to find a better item for this slot
                for (let i = 0; i < currentInventory.length; i++) {
                    const item = currentInventory[i];
                    // Skip if item is invalid, already marked for removal for another slot, or doesn't fit this slot
                    if (!item || inventoryIndicesToRemove.includes(i) || item.equipmentSlot !== slot) {
                        continue;
                    }
                    const itemStatValue = item.stats?.[statKey] ?? 0;
                    // If this item is better than the current best (which might be the equipped item or another inventory item)
                    if (itemStatValue > bestStatValue) {
                        bestStatValue = itemStatValue;
                        bestItemForSlot = item;
                        bestItemInventoryIndex = i;
                    }
                }

                // If we found a better item in the inventory
                if (bestItemForSlot && bestItemInventoryIndex !== -1) {
                    console.log(`InventoryService: Found upgrade for slot ${slot}: ${bestItemForSlot.name} (${statKey}: ${bestStatValue}) replacing ${currentlyEquippedItem?.name ?? 'nothing'} (${statKey}: ${currentStatValue})`);
                    itemsToEquip.push({ item: bestItemForSlot, targetSlot: slot });
                    inventoryIndicesToRemove.push(bestItemInventoryIndex); // Mark this inventory index for removal
                    // If there was an item equipped in this slot, mark it for unequipping
                    if (currentlyEquippedItem) {
                        slotsToUnequip.push(slot);
                    }
                }
            }

            // --- Perform the Swaps if changes were found ---
            if (itemsToEquip.length === 0) {
                return { success: false, message: `No upgrades found for ${statKey}.` }; // Changed from info
            }

            const finalInventory = [...currentInventory]; // Start with a copy of the original inventory
            const finalEquipment = { ...currentEquipment }; // Start with a copy of the original equipment
            const unequippedItems: Item[] = []; // Items that were equipped and need to go back to inventory

            // 1. Identify items to unequip and remove them from finalEquipment
            for (const slot of slotsToUnequip) {
                 if (Object.prototype.hasOwnProperty.call(finalEquipment, slot)) {
                    const itemToUnequip = finalEquipment[slot];
                    if (itemToUnequip) {
                        unequippedItems.push(itemToUnequip);
                    }
                    delete finalEquipment[slot]; // Clear the slot in the final equipment object
                }
            }

            // 2. Identify items being equipped (based on indices to remove)
            const itemsBeingEquipped: Item[] = [];
             // Sort indices descending to avoid issues when splicing
            inventoryIndicesToRemove.sort((a, b) => b - a);
            for (const index of inventoryIndicesToRemove) {
                 // Splice from the *copy* (finalInventory) and get the item being equipped
                 const removedItems = finalInventory.splice(index, 1);
                 if (removedItems.length > 0 && removedItems[0]) {
                     itemsBeingEquipped.push(removedItems[0]);
                 }
            }


            // 3. Add unequipped items back to the modified inventory
            finalInventory.push(...unequippedItems);

            // 4. Place the new best items into the final equipment object
            for (const { item, targetSlot } of itemsToEquip) {
                 // Find the actual item object we removed in step 2
                 const itemToActuallyEquip = itemsBeingEquipped.find(i => i.id === item.id);
                 if (itemToActuallyEquip) {
                     finalEquipment[targetSlot] = itemToActuallyEquip;
                 } else {
                     // This indicates a logic error if an item marked for equipping wasn't found after removal
                     console.error(`InventoryService Error: Could not find item ${item.id} in itemsBeingEquipped list during auto-equip.`);
                     // Consider returning an error or trying to continue cautiously
                     return { success: false, message: 'Internal error during auto-equip item swap.' };
                 }
            }

            // --- Update DB ---
            const updates: Partial<Character> = { inventory: finalInventory, equipment: finalEquipment };
            await this.characterRepository.update(characterId, updates);

            // Fetch updated character
            const updatedCharacterRaw = await this.characterRepository.findById(characterId);
            if (!updatedCharacterRaw) {
                 console.error(`InventoryService: Failed to fetch character ${characterId} after auto-equip update.`);
                 return { success: false, message: 'Failed to retrieve updated character data.' };
            }

            // Recalculate stats
            const finalCharacterData = calculateCharacterStats(updatedCharacterRaw);

            console.log(`InventoryService: Character ${finalCharacterData.name} auto-equipped for stat: ${statKey}. Items changed: ${itemsToEquip.length}.`);
            return { success: true, message: `Auto-equipped best items for ${statKey}.`, character: finalCharacterData };

        } catch (error) {
            console.error(`Error in InventoryService.autoEquipBestStat for character ${characterId}, stat ${statKey}:`, error);
            return { success: false, message: `An internal server error occurred during auto-equip for ${statKey}.` };
        }
    }

    /**
     * Adds an item instance to the character's inventory. Handles stacking.
     * @param characterId The ID of the character.
     * @param itemToAdd The Item object instance to add.
     * @returns InventoryServiceResult indicating success/failure. Character data is not returned here as CombatService handles the final update.
     */
    async addItemToInventory(characterId: string, itemToAdd: Item): Promise<Omit<InventoryServiceResult, 'character'>> {
        // Basic validation
        if (!itemToAdd || !itemToAdd.id || !itemToAdd.baseId) {
            return { success: false, message: 'Invalid item data provided.' };
        }

        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            const currentInventory = character.inventory || [];
            const isStackable = (itemToAdd.type === 'potion' || itemToAdd.type === 'misc') && (itemToAdd.quantity ?? 1) > 0;
            const itemQuantityToAdd = itemToAdd.quantity ?? 1;

            let itemAdded = false;

            // --- Handle Stacking ---
            if (isStackable) {
                for (let i = 0; i < currentInventory.length; i++) {
                    const existingItem = currentInventory[i];
                    // Check if it's the same base item and stackable
                    if (existingItem && existingItem.baseId === itemToAdd.baseId && (existingItem.type === 'potion' || existingItem.type === 'misc')) {
                        // TODO: Add check for stack size limit if implemented later
                        existingItem.quantity = (existingItem.quantity ?? 0) + itemQuantityToAdd;
                        itemAdded = true;
                        console.log(`InventoryService: Stacked ${itemQuantityToAdd} ${itemToAdd.name} onto existing stack for character ${characterId}. New quantity: ${existingItem.quantity}`);
                        break; // Stop after finding the first stack
                    }
                }
            }

            // --- Handle Adding New Item (if not stacked or not stackable) ---
            if (!itemAdded) {
                // TODO: Add check for inventory space limit if implemented later
                currentInventory.push(itemToAdd); // Add the new item instance
                itemAdded = true;
                console.log(`InventoryService: Added new item ${itemToAdd.name} (Qty: ${itemQuantityToAdd}) to inventory for character ${characterId}.`);
            }

            // --- Update Character ---
            if (itemAdded) {
                await this.characterRepository.update(characterId, { inventory: currentInventory });
                return { success: true, message: 'Item added to inventory.' };
            } else {
                // This case should ideally not be reached if inventory space is handled
                console.error(`InventoryService: Failed to add item ${itemToAdd.name} for character ${characterId} - potentially inventory full or logic error.`);
                return { success: false, message: 'Could not add item to inventory (possibly full).' };
            }

        } catch (error) {
            console.error(`Error in InventoryService.addItemToInventory for character ${characterId}, item ${itemToAdd.name} (ID: ${itemToAdd.id}):`, error);
            return { success: false, message: 'An internal server error occurred while adding the item to inventory.' };
        }
    }
}
