import { Item, ItemQuality, Affix, Character, ItemStats } from './types.js'; // Remove LootTable, LootDrop from here
import { baseItemsTyped as baseItems, prefixes as prefixData, suffixes as suffixData, lootTables, LootTable, LootDrop } from './lootData.js'; // Import LootTable, LootDrop from here
import { randomUUID } from 'crypto';

// Helper function to get a random affix of a specific type, avoiding duplicates
function getRandomAffix(type: 'prefix' | 'suffix', existingAffixes: Affix[]): Affix | null {
    const sourceMap = type === 'prefix' ? prefixData : suffixData;
    // Filter out affixes already present on the item
    const availableAffixes = Array.from(sourceMap.values()).filter(affix =>
        !existingAffixes.some(existing => existing.id === affix.id)
    );

    if (availableAffixes.length === 0) {
        return null; // No available affixes of this type left
    }

    const randomIndex = Math.floor(Math.random() * availableAffixes.length);
    const selectedAffix = availableAffixes[randomIndex];
    // Ensure selectedAffix is not undefined before returning
    return selectedAffix ?? null;
}

// Main function to generate loot based on a loot table ID
// TODO: Add characterMagicFind parameter later for MF calculations
export function generateLoot(lootTableId: string): Item[] {
    const table = lootTables.get(lootTableId);
    if (!table) {
        console.warn(`Loot table not found: ${lootTableId}`);
        return [];
    }

    const generatedItems: Item[] = [];
    let dropsCount = 0;

    // 1. Check No Drop Chance
    if (Math.random() < table.noDropChance) {
        return []; // Drop nothing
    }

    // 2. Iterate through possible drops
    for (const drop of table.possibleDrops) {
        // Check if max drops reached
        if (dropsCount >= table.maxDrops) {
            break;
        }

        // 3. Roll for this specific item drop
        // TODO: Incorporate Magic Find sensitivity here later
        const dropRoll = Math.random();
        if (dropRoll <= drop.chance) {
            const baseItemDef = baseItems.get(drop.baseId);
            if (!baseItemDef) {
                console.warn(`Base item not found in loot table entry: ${drop.baseId}`);
                continue;
            }

            // --- Create Base Item Instance ---
            const newItem: Item = {
                ...JSON.parse(JSON.stringify(baseItemDef)), // Deep copy base item properties
                id: randomUUID(),       // Assign unique instance ID
                quality: 'White',       // Default quality
                rarity: 'common',       // Default rarity
                prefixes: [],           // Default empty prefixes
                suffixes: [],           // Default empty suffixes
                stats: { ...(baseItemDef.stats || {}) }, // Start with base stats or empty object
                upgradeCount: 0,        // Initialize upgrade count
                maxUpgrades: 0          // Initialize max upgrades (will be set below)
            };

            // --- Handle Quantity ---
            if (newItem.type === 'misc' || newItem.type === 'potion') {
                if (drop.quantity) {
                    newItem.quantity = Math.floor(Math.random() * (drop.quantity.max - drop.quantity.min + 1)) + drop.quantity.min;
                } else {
                    newItem.quantity = baseItemDef.quantity || 1; // Use base quantity or 1 if range not specified
                }
                // Ensure gold always has quantity > 0 if it drops
                if (newItem.baseId === 'gold_coins') {
                    newItem.quantity = Math.max(1, newItem.quantity ?? 1);
                }
            } else {
                delete newItem.quantity; // Ensure non-stackables don't have quantity
            }


            // --- Determine Quality & Affixes (Only for equippable items) ---
            const canHaveAffixes = newItem.type === 'weapon' || newItem.type === 'armor';
            let finalQuality: ItemQuality = 'White'; // Start assuming White

            if (canHaveAffixes && table.qualityChances) {
                const qualityRoll = Math.random();
                // Check for Rare first
                if (qualityRoll < (table.qualityChances.rare ?? 0)) {
                    finalQuality = 'Blue'; // Rare items are Blue
                }
                // Check for Magic if not Rare
                else if (qualityRoll < ((table.qualityChances.rare ?? 0) + (table.qualityChances.magic ?? 0))) {
                    finalQuality = 'Green'; // Magic items are Green
                }
                // Otherwise, it remains White (or Gray if base item implies it, though we default to White)
                newItem.quality = finalQuality;

                // --- Map Quality to Rarity AND Set Max Upgrades ---
                // newItem.quality can only be 'White', 'Green', or 'Blue' here
                switch (newItem.quality) {
                    case 'Green':
                        newItem.rarity = 'magic';
                        newItem.maxUpgrades = 2;
                        break;
                    case 'Blue':
                        newItem.rarity = 'rare';
                        newItem.maxUpgrades = 3;
                        break;
                    case 'White': // Handles the case where quality roll didn't result in Green or Blue
                        newItem.rarity = 'common';
                        newItem.maxUpgrades = 1; // White items get 1 upgrade
                        break;
                    // No default needed as all possible values ('White', 'Green', 'Blue') are covered
                }

                // --- Determine Number of Affixes based on Quality ---
                let prefixCount = 0;
                let suffixCount = 0;
                const maxAffixesPerType = 3; // Limit affixes for now

                // newItem.quality can only be 'White', 'Green', or 'Blue' here
                switch (newItem.quality) {
                    case 'White':
                        prefixCount = 0;
                        suffixCount = 0;
                        break;
                    case 'Green': // 1 random affix (prefix or suffix)
                        if (Math.random() < 0.5) prefixCount = 1; else suffixCount = 1;
                        break;
                    case 'Blue': // 1 prefix AND 1 suffix
                        prefixCount = 1;
                        suffixCount = 1;
                        break;
                    // No default needed as all possible values ('White', 'Green', 'Blue') are covered
                }

                // --- Add Prefixes ---
                for (let i = 0; i < prefixCount; i++) {
                    const affix = getRandomAffix('prefix', newItem.prefixes);
                    if (affix) {
                        newItem.prefixes.push(affix);
                    } else { break; } // No more available prefixes
                }

                // --- Add Suffixes ---
                 for (let i = 0; i < suffixCount; i++) {
                    const affix = getRandomAffix('suffix', newItem.suffixes);
                    if (affix) {
                        newItem.suffixes.push(affix);
                    } else { break; } // No more available suffixes
                }

                // --- Update Item Name ---
                if (newItem.prefixes.length > 0 || newItem.suffixes.length > 0) {
                    const prefixNames = newItem.prefixes.map(p => p.name).join(' ');
                    const suffixNames = newItem.suffixes.map(s => s.name).join(' ');
                    // Use base name from definition, not potentially modified one
                    newItem.name = `${prefixNames} ${baseItemDef.name} ${suffixNames}`.trim().replace(/\s+/g, ' ');
                }

                // --- Combine Stats (Base + Affixes) ---
                // newItem.stats already initialized with base stats
                const allAffixes = [...newItem.prefixes, ...newItem.suffixes];
                for (const affix of allAffixes) {
                    if (affix.statModifiers) {
                        for (const [stat, value] of Object.entries(affix.statModifiers)) {
                            // Ensure the key exists on ItemStats before assigning
                            if (stat in newItem.stats!) {
                                const key = stat as keyof ItemStats;
                                // Ensure value is treated as number
                                const numValue = Number(value) || 0;
                                newItem.stats![key] = (newItem.stats![key] || 0) + numValue;
                            } else {
                                // Handle cases where affix stat might not directly map (e.g., addedDamage, levelReq)
                                // For now, we only combine stats present in ItemStats
                                // console.warn(`Affix stat ${stat} not directly mappable to ItemStats`);
                            }
                        }
                    }
                    // Handle non-statModifier properties like increasedAttackSpeed, fasterHitRecovery etc.
                    // These need to be added explicitly if they exist on the affix root
                    if ('increasedAttackSpeed' in affix && typeof affix.increasedAttackSpeed === 'number') {
                        newItem.stats!.increasedAttackSpeed = (newItem.stats!.increasedAttackSpeed || 0) + affix.increasedAttackSpeed;
                    }
                    if ('fasterHitRecovery' in affix && typeof affix.fasterHitRecovery === 'number') {
                        newItem.stats!.fasterHitRecovery = (newItem.stats!.fasterHitRecovery || 0) + affix.fasterHitRecovery;
                    }
                    if ('magicFind' in affix && typeof affix.magicFind === 'number') {
                        newItem.stats!.magicFind = (newItem.stats!.magicFind || 0) + affix.magicFind;
                    }
                     if ('goldFind' in affix && typeof affix.goldFind === 'number') {
                        newItem.stats!.goldFind = (newItem.stats!.goldFind || 0) + affix.goldFind;
                    }
                     if ('lifeStealPercent' in affix && typeof affix.lifeStealPercent === 'number') {
                        newItem.stats!.lifeStealPercent = (newItem.stats!.lifeStealPercent || 0) + affix.lifeStealPercent;
                    }
                     if ('manaStealPercent' in affix && typeof affix.manaStealPercent === 'number') {
                        newItem.stats!.manaStealPercent = (newItem.stats!.manaStealPercent || 0) + affix.manaStealPercent;
                    }
                     if ('defenseBonusPercent' in affix && typeof affix.defenseBonusPercent === 'number') {
                        newItem.stats!.defenseBonusPercent = (newItem.stats!.defenseBonusPercent || 0) + affix.defenseBonusPercent;
                    }
                    // Note: addedDamage needs special handling, maybe store it separately on the item?
                }
            }

            // Add the finalized item to the results
            generatedItems.push(newItem);
            dropsCount++; // Increment count of distinct items dropped
        }
    }

    // 4. Return the list of generated items
    return generatedItems;
}
