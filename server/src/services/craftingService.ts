import { ICharacterRepository, Character, Item, InventoryServiceResult, Affix, ItemQuality, EquipmentSlot, ItemStats } from '../types.js'; // Added EquipmentSlot, ItemStats
import { InventoryService } from './inventoryService.js';
import { craftingRecipes, CraftingRecipe } from '../craftingData.js';
import { baseItemsTyped as itemDefinitions, prefixes as prefixData, suffixes as suffixData, affixTiers, getAffixBaseName } from '../lootData.js';
import { calculateCharacterStats } from '../utils.js';
import { randomUUID } from 'crypto';

// Define a result type specific to crafting
export interface CraftingServiceResult {
    success: boolean;
    message: string;
    character?: Character; // Return updated character on success
}

// Define a result type specific to upgrading
export interface UpgradeServiceResult {
    success: boolean;
    message: string;
    character?: Character; // Return updated character on success
    updatedItem?: Item; // Optionally return the modified item
}


export class CraftingService {
    private characterRepository: ICharacterRepository;
    private inventoryService: InventoryService;

    constructor(characterRepository: ICharacterRepository, inventoryService: InventoryService) {
        this.characterRepository = characterRepository;
        this.inventoryService = inventoryService;
    }

    /**
     * Attempts to craft an item based on a recipe ID.
     * @param characterId The ID of the character attempting to craft.
     * @param recipeId The ID of the recipe to craft.
     * @returns CraftingServiceResult indicating success/failure and updated character.
     */
    async craftItem(characterId: string, recipeId: string): Promise<CraftingServiceResult> {
        const recipe = craftingRecipes.get(recipeId);
        if (!recipe) {
            return { success: false, message: 'Invalid crafting recipe ID.' };
        }

        const character = await this.characterRepository.findById(characterId);
        if (!character) {
            return { success: false, message: 'Character not found.' };
        }

        // Check level requirement
        if (recipe.requiredLevel && character.level < recipe.requiredLevel) {
            return { success: false, message: `Requires level ${recipe.requiredLevel} to craft.` };
        }

        // Check resource costs
        const currentGold = character.gold ?? 0;
        const currentEssence = character.monsterEssence ?? 0;
        const currentScrap = character.scrapMetal ?? 0;

        if ((recipe.cost.gold ?? 0) > currentGold) {
            return { success: false, message: `Not enough gold. Requires ${recipe.cost.gold}.` };
        }
        if ((recipe.cost.monsterEssence ?? 0) > currentEssence) {
            return { success: false, message: `Not enough Monster Essence. Requires ${recipe.cost.monsterEssence}.` };
        }
        if ((recipe.cost.scrapMetal ?? 0) > currentScrap) {
            return { success: false, message: `Not enough Scrap Metal. Requires ${recipe.cost.scrapMetal}.` };
        }

        // --- Process Crafting Result ---
        let itemCraftedSuccessfully = false;
        const updates: Partial<Character> = {};

        if (recipe.result.type === 'item') {
            const baseItem = itemDefinitions.get(recipe.result.baseId);
            if (!baseItem) {
                console.error(`CraftingService: Base item definition not found for recipe result: ${recipe.result.baseId}`);
                return { success: false, message: 'Internal server error: Invalid item definition in recipe.' };
            }

            // Create item instance(s) - for now, assume quality is always 'White' for crafted items
            const itemsToAdd: Item[] = [];
            for (let i = 0; i < recipe.result.quantity; i++) {
                const newItemInstance: Item = {
                    ...JSON.parse(JSON.stringify(baseItem)), // Deep copy
                    id: randomUUID(),
                    quality: 'White', // Crafted items are White quality for now
                    rarity: 'common',
                    prefixes: [],
                    suffixes: [],
                    stats: { ...(baseItem.stats || {}) }, // Ensure stats object exists
                    upgradeCount: 0, // Initialize upgrade count
                    maxUpgrades: 1 // White items get 1 upgrade
                };
                 // Handle quantity for stackable crafted items (like potions)
                 if (newItemInstance.type === 'potion' || newItemInstance.type === 'misc') {
                    newItemInstance.quantity = 1; // Each craft makes one instance, stacking handled by inventory service
                 } else {
                    delete newItemInstance.quantity;
                 }
                itemsToAdd.push(newItemInstance);
            }

            // Add crafted items to inventory via InventoryService
            for (const item of itemsToAdd) {
                // We use inventoryService to handle stacking etc.
                // We don't need the result here, just await completion or handle error
                try {
                    const addResult = await this.inventoryService.addItemToInventory(characterId, item);
                    if (!addResult.success) {
                        // If adding fails (e.g., inventory full), we should ideally roll back resource costs
                        // For now, we'll return the error message from addItemToInventory
                        console.warn(`CraftingService: Failed to add crafted item ${item.name} to inventory for ${characterId}. Reason: ${addResult.message}`);
                        return { success: false, message: addResult.message }; // Propagate inventory error
                    }
                    itemCraftedSuccessfully = true; // Mark success if at least one item was added attempt
                } catch (invError) {
                     console.error(`CraftingService: Error calling addItemToInventory for ${item.name}:`, invError);
                     return { success: false, message: 'Internal error adding crafted item to inventory.' };
                }
            }

        } else if (recipe.result.type === 'upgrade_random_affix') {
            // This recipe type should be handled by upgradeItemAffix, not craftItem
            console.warn(`CraftingService: 'upgrade_random_affix' recipe type used in craftItem for recipe ${recipeId}. Use upgradeItemAffix instead.`);
            return { success: false, message: 'Invalid recipe type for this action. Use upgrade action.' };
        }

        // --- Deduct Costs and Save ---
        if (itemCraftedSuccessfully) { // Only deduct if crafting succeeded
            updates.gold = currentGold - (recipe.cost.gold ?? 0);
            updates.monsterEssence = currentEssence - (recipe.cost.monsterEssence ?? 0);
            updates.scrapMetal = currentScrap - (recipe.cost.scrapMetal ?? 0);

            try {
                await this.characterRepository.update(characterId, updates);

                // Fetch updated character data to return
                const updatedCharacter = await this.characterRepository.findById(characterId);
                if (!updatedCharacter) {
                     console.error(`CraftingService: Failed to fetch character ${characterId} after crafting update.`);
                     return { success: false, message: 'Failed to retrieve updated character data after crafting.' };
                }
                 // Recalculate stats (might be needed if upgrades affect stats later)
                 const finalCharacterData = calculateCharacterStats(updatedCharacter);

                console.log(`CraftingService: Character ${characterId} successfully crafted recipe ${recipeId}.`);
                return { success: true, message: `${recipe.name} successful!`, character: finalCharacterData };

            } catch (dbError) {
                console.error(`CraftingService: Failed to update character resources after crafting recipe ${recipeId}:`, dbError);
                // TODO: Consider attempting to roll back inventory changes if DB update fails? Complex.
                return { success: false, message: 'Failed to update resources after crafting.' };
            }
        } else {
             // Should have returned earlier if addItemToInventory failed
             console.error(`CraftingService: Reached end of craftItem for ${recipeId} without success flag set.`);
             return { success: false, message: 'An unknown error occurred during crafting.' };
        }
    }

    /**
     * Gets the list of recipes available to the character.
     * @param characterId The ID of the character.
     * @returns A promise resolving to an array of available CraftingRecipe objects.
     */
    async getAvailableRecipes(characterId: string): Promise<CraftingRecipe[]> {
        const character = await this.characterRepository.findById(characterId);
        if (!character) {
            console.warn(`CraftingService: Character not found when getting recipes: ${characterId}`);
            return [];
        }

        const available: CraftingRecipe[] = [];
        for (const recipe of craftingRecipes.values()) {
            if (!recipe.requiredLevel || character.level >= recipe.requiredLevel) {
                available.push(recipe);
            }
        }
        return available;
    }

     /**
     * Attempts to upgrade a specific affix on an item or add an affix to a Gray/White item.
     * @param characterId The ID of the character.
     * @param itemId The ID of the item instance to upgrade (must be in inventory or equipped).
     * @param affixIdToUpgrade The ID of the specific affix to upgrade (for Magic/Rare). Null/undefined for Gray/White.
     * @param recipeId The ID of the upgrade recipe being used (for cost calculation).
     * @returns UpgradeServiceResult indicating success/failure and updated character/item.
     */
    async upgradeItemAffix(characterId: string, itemId: string, affixIdToUpgrade: string | null | undefined, recipeId: string): Promise<UpgradeServiceResult> {
        const recipe = craftingRecipes.get(recipeId);
        if (!recipe || recipe.result.type !== 'upgrade_random_affix') { // Check for correct recipe type
            return { success: false, message: 'Invalid upgrade recipe ID or type.' };
        }

        const character = await this.characterRepository.findById(characterId);
        if (!character) { return { success: false, message: 'Character not found.' }; }

        // Find the item in inventory or equipment
        let itemToUpgrade: Item | undefined | null = null;
        let itemLocation: 'inventory' | 'equipment' = 'inventory';
        let itemIndex = -1; // Only relevant for inventory

        itemToUpgrade = (character.inventory || []).find((item, index) => {
            if (item.id === itemId) {
                itemIndex = index;
                return true;
            }
            return false;
        });

        if (!itemToUpgrade) {
            itemLocation = 'equipment';
            for (const slot in character.equipment) {
                if (character.equipment[slot as EquipmentSlot]?.id === itemId) {
                    itemToUpgrade = character.equipment[slot as EquipmentSlot];
                    break;
                }
            }
        }

        if (!itemToUpgrade) { return { success: false, message: 'Item not found on character.' }; }

        // --- Perform Checks BEFORE consuming resources ---
        const currentUpgradeCount = itemToUpgrade.upgradeCount ?? 0;
        const maxUpgrades = itemToUpgrade.maxUpgrades ?? 0;

        if (currentUpgradeCount >= maxUpgrades) {
            return { success: false, message: 'Item has reached maximum upgrades.' };
        }

        // Check resource costs
        const currentGold = character.gold ?? 0;
        const currentEssence = character.monsterEssence ?? 0;
        const currentScrap = character.scrapMetal ?? 0;
        if ((recipe.cost.gold ?? 0) > currentGold) { return { success: false, message: `Not enough gold. Requires ${recipe.cost.gold}.` }; }
        if ((recipe.cost.monsterEssence ?? 0) > currentEssence) { return { success: false, message: `Not enough Monster Essence. Requires ${recipe.cost.monsterEssence}.` }; }
        if ((recipe.cost.scrapMetal ?? 0) > currentScrap) { return { success: false, message: `Not enough Scrap Metal. Requires ${recipe.cost.scrapMetal}.` }; }

        // --- Apply Upgrade Logic ---
        const modifiedItem = { ...itemToUpgrade, prefixes: [...itemToUpgrade.prefixes], suffixes: [...itemToUpgrade.suffixes] }; // Deep copy affixes
        let upgradeApplied = false;
        let message = '';

        if ((itemToUpgrade.quality === 'Gray' || itemToUpgrade.quality === 'White') && currentUpgradeCount === 0) {
            // Add a random T1 affix
            if (affixIdToUpgrade) { return { success: false, message: 'Cannot target an affix on a Gray/White item.' }; }

            const isPrefix = Math.random() < 0.5;
            const availableT1Affixes = Array.from(isPrefix ? prefixData.values() : suffixData.values())
                                           .filter(a => a.id.endsWith('1')); // Simple check for T1

            if (availableT1Affixes.length > 0) {
                const randomAffix = availableT1Affixes[Math.floor(Math.random() * availableT1Affixes.length)];
                if (randomAffix) {
                    if (isPrefix) modifiedItem.prefixes.push(randomAffix);
                    else modifiedItem.suffixes.push(randomAffix);
                    modifiedItem.upgradeCount = (modifiedItem.upgradeCount ?? 0) + 1;
                    upgradeApplied = true;
                    message = `Added affix '${randomAffix.name}' to ${itemToUpgrade.name}.`;
                }
            }
            if (!upgradeApplied) { message = 'Failed to find a suitable Tier 1 affix to add.'; }

        } else if (itemToUpgrade.quality === 'Green' || itemToUpgrade.quality === 'Blue') {
            // Upgrade an existing affix
            if (!affixIdToUpgrade) { return { success: false, message: 'Must select an affix to upgrade.' }; }

            const allAffixes = [...modifiedItem.prefixes, ...modifiedItem.suffixes];
            const affixToUpgrade = allAffixes.find(a => a.id === affixIdToUpgrade);
            if (!affixToUpgrade) { return { success: false, message: 'Selected affix not found on item.' }; }

            const baseAffixName = getAffixBaseName(affixToUpgrade.id);
            if (!baseAffixName) { return { success: false, message: 'Could not determine affix tier.' }; }

            const tierList = affixTiers.get(baseAffixName);
            // Add check here: If tierList is undefined, the affix progression is not defined
            if (!tierList) { return { success: false, message: 'Affix tier progression not defined.' }; }

            // Now tierList is guaranteed to be string[]
            // Also ensure affixIdToUpgrade is a string before using indexOf
            if (!affixIdToUpgrade) { return { success: false, message: 'Internal error: Affix ID missing for upgrade.' }; }
            const currentTierIndex = tierList.indexOf(affixIdToUpgrade);
            if (currentTierIndex === -1) { return { success: false, message: 'Current affix tier unknown.' }; }
            if (currentTierIndex >= tierList.length - 1) { return { success: false, message: 'Selected affix is already at maximum tier.' }; }

            const nextTierAffixId = tierList[currentTierIndex + 1];
            // Ensure the next tier ID exists before proceeding
            if (!nextTierAffixId) {
                 console.error(`CraftingService: Could not find next tier affix ID for ${affixToUpgrade.id} in list ${tierList}`);
                 return { success: false, message: 'Internal error finding next affix tier.' };
            }

            const nextAffixData = (affixToUpgrade.type === 'prefix' ? prefixData : suffixData).get(nextTierAffixId);
            if (!nextAffixData) { return { success: false, message: 'Next affix tier data not found.' }; }

            // Replace the old affix with the new one
            if (affixToUpgrade.type === 'prefix') {
                modifiedItem.prefixes = modifiedItem.prefixes.map(p => p.id === affixIdToUpgrade ? nextAffixData : p);
            } else {
                modifiedItem.suffixes = modifiedItem.suffixes.map(s => s.id === affixIdToUpgrade ? nextAffixData : s);
            }
            modifiedItem.upgradeCount = (modifiedItem.upgradeCount ?? 0) + 1;
            upgradeApplied = true;
            message = `Upgraded affix on ${itemToUpgrade.name} to '${nextAffixData.name}'.`;

        } else {
            return { success: false, message: 'This item quality cannot be upgraded.' };
        }

        // --- Final Update if Successful ---
        if (upgradeApplied) {
            // Recalculate combined stats for the modified item
            // (This assumes base stats don't change, only affixes)
            const baseItemStats = itemDefinitions.get(modifiedItem.baseId)?.stats ?? {};
            const combinedStats: Partial<ItemStats> = { ...baseItemStats }; // Use Partial<ItemStats>
            const allNewAffixes = [...modifiedItem.prefixes, ...modifiedItem.suffixes];
            for (const affix of allNewAffixes) {
                 if (affix.statModifiers) {
                    for (const [stat, value] of Object.entries(affix.statModifiers)) {
                        const key = stat as keyof ItemStats; // Assert key type
                        // Check if the key is actually part of ItemStats before assigning
                        if (key in combinedStats || key === 'defense' || key === 'defenseBonusPercent' /* add other valid non-base stats if needed */) {
                            combinedStats[key] = (combinedStats[key] || 0) + (Number(value) || 0);
                        }
                    }
                }
                 // Handle non-statModifier properties explicitly
                 if ('increasedAttackSpeed' in affix && typeof affix.increasedAttackSpeed === 'number') combinedStats.increasedAttackSpeed = (combinedStats.increasedAttackSpeed || 0) + affix.increasedAttackSpeed;
                 if ('fasterHitRecovery' in affix && typeof affix.fasterHitRecovery === 'number') combinedStats.fasterHitRecovery = (combinedStats.fasterHitRecovery || 0) + affix.fasterHitRecovery;
                 // ... add other non-modifier stats here ...
            }
            modifiedItem.stats = combinedStats;


            // Prepare character updates (resources + modified item)
            const updates: Partial<Character> = {
                gold: currentGold - (recipe.cost.gold ?? 0),
                monsterEssence: currentEssence - (recipe.cost.monsterEssence ?? 0),
                scrapMetal: currentScrap - (recipe.cost.scrapMetal ?? 0),
            };

            if (itemLocation === 'inventory') {
                const newInventory = [...(character.inventory || [])];
                newInventory[itemIndex] = modifiedItem;
                updates.inventory = newInventory;
            } else { // itemLocation === 'equipment'
                const newEquipment = { ...character.equipment };
                // Correctly type the key 's' as EquipmentSlot during find
                const slot = Object.keys(newEquipment).find(s => newEquipment[s as EquipmentSlot]?.id === itemId) as EquipmentSlot | undefined;
                if (slot) {
                    newEquipment[slot] = modifiedItem; // Assign the modified item
                    updates.equipment = newEquipment;
                } else {
                     console.error(`CraftingService: Failed to find slot for equipped item ${itemId} during upgrade.`);
                     return { success: false, message: 'Internal error updating equipped item.' };
                }
            }

            try {
                await this.characterRepository.update(characterId, updates);
                const finalCharacter = await this.characterRepository.findById(characterId);
                 if (!finalCharacter) { throw new Error("Failed to refetch character after upgrade."); }
                 const finalCharacterData = calculateCharacterStats(finalCharacter); // Recalculate overall stats

                console.log(`CraftingService: ${message}`);
                return { success: true, message: message, character: finalCharacterData, updatedItem: modifiedItem };
            } catch (dbError) {
                console.error(`CraftingService: Failed to update character/item after upgrade ${recipeId}:`, dbError);
                return { success: false, message: 'Failed to save upgrade.' };
            }
        } else {
            // Upgrade wasn't applied (e.g., failed to add T1 affix)
            return { success: false, message: message || 'Upgrade could not be applied.' };
        }
    }
}
