import { Item, ItemQuality, Affix, Character } from './types.js';
import { lootTables, qualityWeights } from './gameData.js';
import { baseItemsTyped as baseItems, prefixes as prefixData, suffixes as suffixData } from './lootData.js';
import { randomUUID } from 'crypto';

// Helper function to select an item quality based on weights
function rollQuality(): ItemQuality {
    // Explicitly type the entry in reduce
    const totalWeight = qualityWeights.reduce((sum, entry: { quality: ItemQuality; weight: number }) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    // Explicitly type the entry in the loop
    for (const entry of qualityWeights as { quality: ItemQuality; weight: number }[]) {
        if (roll < entry.weight) {
            return entry.quality;
        }
        roll -= entry.weight;
    }
    // Fallback in case of floating point issues or empty weights
    return qualityWeights.length > 0 && qualityWeights[0] ? qualityWeights[0].quality : 'Gray';
}

// Helper function to get a random affix of a specific type, avoiding duplicates
function getRandomAffix(type: 'prefix' | 'suffix', existingAffixes: Affix[]): Affix | null {
    const sourceMap = type === 'prefix' ? prefixData : suffixData;
    const availableAffixes = Array.from(sourceMap.values()).filter(affix =>
        !existingAffixes.some(existing => existing.id === affix.id)
    );

    if (availableAffixes.length === 0) {
        return null; // No available affixes of this type left
    }

    const randomIndex = Math.floor(Math.random() * availableAffixes.length);
    const selectedAffix = availableAffixes[randomIndex];
    return selectedAffix !== undefined ? selectedAffix : null;
}
// Main function to generate loot based on a loot table ID
export function generateLoot(lootTableId: string): Item[] {
    const tableEntries = lootTables.get(lootTableId);
    if (!tableEntries) {
        console.warn(`Loot table not found: ${lootTableId}`);
        return [];
    }

    const generatedItems: Item[] = [];

    for (const entry of tableEntries) {
        // Roll for drop chance
        if (Math.random() <= entry.chance) {
            const baseItem = baseItems.get(entry.baseId);
            if (!baseItem) {
                console.warn(`Base item not found in loot table entry: ${entry.baseId}`);
                continue;
            }

            // --- Create Base Item Instance ---
            // Need to explicitly add the default quality/affixes missing from baseItems definition
            const newItem: Item = {
                ...JSON.parse(JSON.stringify(baseItem)), // Deep copy base item properties
                id: randomUUID(), // Assign unique instance ID
                quality: 'White', // Default quality
                prefixes: [],     // Default empty prefixes
                suffixes: [],     // Default empty suffixes
            };

            // --- Handle Quantity ---
            if (baseItem.type === 'misc' || baseItem.type === 'potion') {
                newItem.quantity = entry.minQuantity !== undefined && entry.maxQuantity !== undefined
                    ? Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1)) + entry.minQuantity
                    : baseItem.quantity || 1; // Use base quantity or 1 if range not specified
            } else {
                delete newItem.quantity; // Ensure non-stackables don't have quantity
            }


            // --- Determine Quality & Affixes (Only for equippable items) ---
            const canHaveAffixes = newItem.type === 'weapon' || newItem.type === 'armor';

            if (canHaveAffixes) {
                newItem.quality = rollQuality();

                // --- Map Quality to Rarity ---
                switch (newItem.quality) {
                    case 'Green':
                        newItem.rarity = 'magic';
                        break;
                    case 'Blue':
                        newItem.rarity = 'rare';
                        break;
                    case 'Purple':
                        newItem.rarity = 'unique';
                        break;
                    case 'Red':
                        newItem.rarity = 'legendary';
                        break;
                    case 'Gray':
                    case 'White':
                    default:
                        newItem.rarity = 'common';
                        break;
                }

                let prefixCount = 0;
                let suffixCount = 0;
                const maxAffixesPerType = 4; // Max 4 prefixes, 4 suffixes

                switch (newItem.quality) {
                    case 'Green': // 1 random affix
                        if (Math.random() < 0.5) prefixCount = 1; else suffixCount = 1;
                        break;
                    case 'Blue': // 1 prefix, 1 suffix
                        prefixCount = 1;
                        suffixCount = 1;
                        break;
                    case 'Purple': // 3 random affixes (respecting max 4 each)
                        let purpleAffixes = 3;
                        while(purpleAffixes > 0 && (prefixCount + suffixCount < maxAffixesPerType * 2)) {
                            if (Math.random() < 0.5) { // Try adding prefix
                                if (prefixCount < maxAffixesPerType) prefixCount++; else if (suffixCount < maxAffixesPerType) suffixCount++; // Add suffix if prefix maxed
                            } else { // Try adding suffix
                                if (suffixCount < maxAffixesPerType) suffixCount++; else if (prefixCount < maxAffixesPerType) prefixCount++; // Add prefix if suffix maxed
                            }
                            purpleAffixes--;
                        }
                        break;
                    case 'Red': // 4 random affixes (respecting max 4 each) - Simplified for now
                         let redAffixes = 4;
                         while(redAffixes > 0 && (prefixCount + suffixCount < maxAffixesPerType * 2)) {
                             if (Math.random() < 0.5) { // Try adding prefix
                                 if (prefixCount < maxAffixesPerType) prefixCount++; else if (suffixCount < maxAffixesPerType) suffixCount++;
                             } else { // Try adding suffix
                                 if (suffixCount < maxAffixesPerType) suffixCount++; else if (prefixCount < maxAffixesPerType) prefixCount++;
                             }
                             redAffixes--;
                         }
                        break;
                    // Gray and White have 0 affixes by default
                }

                // --- Add Prefixes ---
                for (let i = 0; i < prefixCount; i++) {
                    const affix = getRandomAffix('prefix', newItem.prefixes);
                    if (affix) {
                        newItem.prefixes.push(affix);
                    } else {
                        break; // No more available prefixes
                    }
                }

                // --- Add Suffixes ---
                 for (let i = 0; i < suffixCount; i++) {
                    const affix = getRandomAffix('suffix', newItem.suffixes);
                    if (affix) {
                        newItem.suffixes.push(affix);
                    } else {
                        break; // No more available suffixes
                    }
                }

                // --- Update Item Name ---
                const prefixNames = newItem.prefixes.map(p => p.name).join(' ');
                const suffixNames = newItem.suffixes.map(s => s.name).join(' ');
                newItem.name = `${prefixNames} ${baseItem.name} ${suffixNames}`.trim().replace(/\s+/g, ' ');

                // --- Combine Stats (Base + Affixes) ---
                // Initialize stats if they don't exist on base item OR create a new object
                 const combinedStats: Partial<Character['stats']> = { ...(baseItem.stats || {}) };


                const allAffixes = [...newItem.prefixes, ...newItem.suffixes];
                for (const affix of allAffixes) {
                    if (affix.statModifiers) {
                        for (const [stat, value] of Object.entries(affix.statModifiers)) {
                            const key = stat as keyof Character['stats'];
                            combinedStats[key] = (combinedStats[key] || 0) + value;
                        }
                    }
                }
                 // Assign the newly calculated combined stats to the item
                 newItem.stats = combinedStats;
            }

            generatedItems.push(newItem);
        }
    }

    return generatedItems;
}
