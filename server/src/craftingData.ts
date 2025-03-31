import { Item, EquipmentSlot } from './types.js'; // Added EquipmentSlot

// Define the structure for resource costs
interface ResourceCost {
    gold?: number;
    monsterEssence?: number;
    scrapMetal?: number;
    // Could add item baseIds here later, e.g., { baseId: 'iron_ore', quantity: 5 }
}

// Define the structure for the crafting result
type CraftingResult =
    | { type: 'item'; baseId: string; quantity: number } // Craft a specific item
    | { type: 'upgrade_random_affix' }; // Apply an upgrade to a random affix

// Define the structure for a single crafting recipe
export interface CraftingRecipe {
    id: string; // Unique identifier for the recipe (e.g., 'craft_minor_hp_pot')
    name: string; // Display name (e.g., "Craft Minor Health Potion")
    description: string; // Short description
    cost: ResourceCost;
    result: CraftingResult;
    requiredLevel?: number; // Optional level requirement to see/use the recipe
    appliesToSlotType?: EquipmentSlot[]; // For upgrade recipes: which slots can be targeted
}

// Map of available crafting recipes
export const craftingRecipes: Map<string, CraftingRecipe> = new Map([
    [
        'craft_minor_hp_pot',
        {
            id: 'craft_minor_hp_pot',
            name: 'Craft Minor Health Potion',
            description: 'Brew a simple healing potion.',
            cost: { monsterEssence: 5 },
            result: { type: 'item', baseId: 'minor_health_potion', quantity: 1 },
            requiredLevel: 1,
        },
    ],
    [
        'craft_light_hp_pot',
        {
            id: 'craft_light_hp_pot',
            name: 'Craft Light Health Potion',
            description: 'Brew a slightly stronger healing potion.',
            cost: { monsterEssence: 15, gold: 5 },
            result: { type: 'item', baseId: 'light_health_potion', quantity: 1 },
            requiredLevel: 5,
        },
    ],
    [
        'craft_minor_mp_pot',
        {
            id: 'craft_minor_mp_pot',
            name: 'Craft Minor Mana Potion',
            description: 'Concoct a simple mana restoring potion.',
            cost: { monsterEssence: 8 }, // Different cost example
            result: { type: 'item', baseId: 'minor_mana_potion', quantity: 1 },
            requiredLevel: 3,
        },
    ],
    // Example Upgrade Recipe
    [
        'upgrade_weapon_affix_t1',
        {
            id: 'upgrade_weapon_affix_t1',
            name: 'Refine Weapon Affix',
            description: 'Uses Essence and Scrap to attempt enhancing an affix on an equipped weapon.',
            cost: { monsterEssence: 25, scrapMetal: 5, gold: 50 },
            result: { type: 'upgrade_random_affix' }, // Use the new type
            requiredLevel: 10,
            appliesToSlotType: ['mainHand', 'offHand'] // Only applies to weapons
        }
    ],
    [
        'upgrade_armor_affix_t1',
        {
            id: 'upgrade_armor_affix_t1',
            name: 'Reinforce Armor Affix',
            description: 'Uses Essence and Scrap to attempt enhancing an affix on equipped armor.',
            cost: { monsterEssence: 20, scrapMetal: 8, gold: 40 }, // Different costs
            result: { type: 'upgrade_random_affix' },
            requiredLevel: 8,
            appliesToSlotType: ['head', 'chest', 'waist', 'hands', 'feet', 'offHand'] // Armor/Shield slots
        }
    ],
]);
