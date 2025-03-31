import { Item, Affix } from './types.js';

type PotionEffect = { health?: number; mana?: number; healthPercent?: number; manaPercent?: number };
type BaseItemDefinition = Omit<Item, 'id' | 'quality' | 'prefixes' | 'suffixes' | 'rarity'> & {
    sellValue?: number;
    effect?: PotionEffect;
    damage?: { min: number; max: number };
    defense?: number;
    blockChance?: number;
    twoHanded?: boolean;
};


// --- Item Data ---
// Base definitions for items - These represent the "template" before quality/affixes are rolled.
export const items: Map<string, BaseItemDefinition> = new Map([
    // --- Potions ---
    ['minor_health_potion', { baseId: 'minor_health_potion', name: 'Minor Health Potion', type: 'potion', description: 'Restores 25 health.', quantity: 1, sellValue: 5, effect: { health: 25 } }],
    ['light_health_potion', { baseId: 'light_health_potion', name: 'Light Health Potion', type: 'potion', description: 'Restores 50 health.', quantity: 1, sellValue: 15, effect: { health: 50 } }],
    ['health_potion', { baseId: 'health_potion', name: 'Health Potion', type: 'potion', description: 'Restores 100 health.', quantity: 1, sellValue: 40, effect: { health: 100 } }],
    ['greater_health_potion', { baseId: 'greater_health_potion', name: 'Greater Health Potion', type: 'potion', description: 'Restores 200 health.', quantity: 1, sellValue: 100, effect: { health: 200 } }],
    ['minor_mana_potion', { baseId: 'minor_mana_potion', name: 'Minor Mana Potion', type: 'potion', description: 'Restores 20 mana.', quantity: 1, sellValue: 10, effect: { mana: 20 } }],
    ['light_mana_potion', { baseId: 'light_mana_potion', name: 'Light Mana Potion', type: 'potion', description: 'Restores 40 mana.', quantity: 1, sellValue: 25, effect: { mana: 40 } }],
    ['mana_potion', { baseId: 'mana_potion', name: 'Mana Potion', type: 'potion', description: 'Restores 80 mana.', quantity: 1, sellValue: 60, effect: { mana: 80 } }],
    ['greater_mana_potion', { baseId: 'greater_mana_potion', name: 'Greater Mana Potion', type: 'potion', description: 'Restores 150 mana.', quantity: 1, sellValue: 120, effect: { mana: 150 } }],
    ['rejuvenation_potion', { baseId: 'rejuvenation_potion', name: 'Rejuvenation Potion', type: 'potion', description: 'Restores 35% health and mana.', quantity: 1, sellValue: 200, effect: { healthPercent: 0.35, manaPercent: 0.35 } }],

    // --- Weapons ---
    // Daggers (Fast Attack Speed)
    ['rusty_dagger', { baseId: 'rusty_dagger', name: 'Rusty Dagger', type: 'weapon', description: 'A simple, worn dagger.', equipmentSlot: 'mainHand', stats: { dexterity: 1 }, attackSpeed: 1800, damage: { min: 1, max: 3 }, sellValue: 2 }],
    ['dagger', { baseId: 'dagger', name: 'Dagger', type: 'weapon', description: 'A standard dagger.', equipmentSlot: 'mainHand', stats: { dexterity: 2 }, attackSpeed: 1700, damage: { min: 2, max: 5 }, sellValue: 8 }],
    ['kris', { baseId: 'kris', name: 'Kris', type: 'weapon', description: 'A wavy-bladed dagger.', equipmentSlot: 'mainHand', stats: { dexterity: 3 }, attackSpeed: 1650, damage: { min: 3, max: 7 }, sellValue: 20 }],
    ['rondel', { baseId: 'rondel', name: 'Rondel', type: 'weapon', description: 'A dagger with a disc-shaped guard.', equipmentSlot: 'mainHand', stats: { dexterity: 4 }, attackSpeed: 1750, damage: { min: 4, max: 8 }, sellValue: 35 }],

    // Swords (Medium Attack Speed, Balanced Stats)
    ['short_sword', { baseId: 'short_sword', name: 'Short Sword', type: 'weapon', description: 'A basic short sword.', equipmentSlot: 'mainHand', stats: { strength: 1, dexterity: 1 }, attackSpeed: 2000, damage: { min: 2, max: 6 }, sellValue: 5 }],
    ['scimitar', { baseId: 'scimitar', name: 'Scimitar', type: 'weapon', description: 'A curved sword, fast and light.', equipmentSlot: 'mainHand', stats: { dexterity: 3 }, attackSpeed: 1900, damage: { min: 3, max: 7 }, sellValue: 12 }],
    ['saber', { baseId: 'saber', name: 'Saber', type: 'weapon', description: 'A light cavalry sword.', equipmentSlot: 'mainHand', stats: { strength: 2, dexterity: 3 }, attackSpeed: 1950, damage: { min: 4, max: 9 }, sellValue: 25 }],
    ['falchion', { baseId: 'falchion', name: 'Falchion', type: 'weapon', description: 'A heavy, single-edged sword.', equipmentSlot: 'mainHand', stats: { strength: 4, dexterity: 1 }, attackSpeed: 2100, damage: { min: 5, max: 11 }, sellValue: 40 }],
    ['long_sword', { baseId: 'long_sword', name: 'Long Sword', type: 'weapon', description: 'A standard military sword.', equipmentSlot: 'mainHand', stats: { strength: 3, dexterity: 2 }, attackSpeed: 2100, damage: { min: 4, max: 10 }, sellValue: 15 }],
    ['broad_sword', { baseId: 'broad_sword', name: 'Broad Sword', type: 'weapon', description: 'A wide-bladed sword.', equipmentSlot: 'mainHand', stats: { strength: 5, dexterity: 1 }, attackSpeed: 2150, damage: { min: 6, max: 12 }, sellValue: 50 }],
    ['bastard_sword', { baseId: 'bastard_sword', name: 'Bastard Sword', type: 'weapon', description: 'Can be wielded with one or two hands.', equipmentSlot: 'mainHand', stats: { strength: 6, dexterity: 2 }, attackSpeed: 2200, damage: { min: 7, max: 14 }, sellValue: 75 }],
    ['great_sword', { baseId: 'great_sword', name: 'Great Sword', type: 'weapon', description: 'A large two-handed sword.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 8 }, attackSpeed: 2400, damage: { min: 10, max: 20 }, sellValue: 100 }],

    // Axes (Medium-Slow Attack Speed, High Strength)
    ['hand_axe', { baseId: 'hand_axe', name: 'Hand Axe', type: 'weapon', description: 'A small axe for one hand.', equipmentSlot: 'mainHand', stats: { strength: 3 }, attackSpeed: 2200, damage: { min: 3, max: 8 }, sellValue: 10 }],
    ['hatchet', { baseId: 'hatchet', name: 'Hatchet', type: 'weapon', description: 'A light chopping axe.', equipmentSlot: 'mainHand', stats: { strength: 4 }, attackSpeed: 2150, damage: { min: 4, max: 9 }, sellValue: 22 }],
    ['battle_axe', { baseId: 'battle_axe', name: 'Battle Axe', type: 'weapon', description: 'A standard combat axe.', equipmentSlot: 'mainHand', stats: { strength: 6 }, attackSpeed: 2300, damage: { min: 6, max: 13 }, sellValue: 60 }],
    ['war_axe', { baseId: 'war_axe', name: 'War Axe', type: 'weapon', description: 'A heavier axe designed for war.', equipmentSlot: 'mainHand', stats: { strength: 7 }, attackSpeed: 2350, damage: { min: 7, max: 15 }, sellValue: 85 }],
    ['great_axe', { baseId: 'great_axe', name: 'Great Axe', type: 'weapon', description: 'A large two-handed axe.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 9 }, attackSpeed: 2500, damage: { min: 12, max: 22 }, sellValue: 120 }],

    // Maces/Clubs/Hammers (Slow Attack Speed, High Damage)
    ['club', { baseId: 'club', name: 'Club', type: 'weapon', description: 'A crude wooden club.', equipmentSlot: 'mainHand', stats: { strength: 2 }, attackSpeed: 2300, damage: { min: 1, max: 5 }, sellValue: 3 }],
    ['spiked_club', { baseId: 'spiked_club', name: 'Spiked Club', type: 'weapon', description: 'A club enhanced with spikes.', equipmentSlot: 'mainHand', stats: { strength: 4 }, attackSpeed: 2350, damage: { min: 4, max: 8 }, sellValue: 9 }],
    ['mace', { baseId: 'mace', name: 'Mace', type: 'weapon', description: 'A blunt weapon with a flanged head.', equipmentSlot: 'mainHand', stats: { strength: 5 }, attackSpeed: 2400, damage: { min: 5, max: 10 }, sellValue: 30 }],
    ['morning_star', { baseId: 'morning_star', name: 'Morning Star', type: 'weapon', description: 'A mace with a spiked ball head.', equipmentSlot: 'mainHand', stats: { strength: 6 }, attackSpeed: 2450, damage: { min: 6, max: 12 }, sellValue: 55 }],
    ['flail', { baseId: 'flail', name: 'Flail', type: 'weapon', description: 'A spiked ball attached to a handle by a chain.', equipmentSlot: 'mainHand', stats: { strength: 5, dexterity: 2 }, attackSpeed: 2300, damage: { min: 5, max: 14 }, sellValue: 70 }],
    ['war_hammer', { baseId: 'war_hammer', name: 'War Hammer', type: 'weapon', description: 'A hammer designed for combat.', equipmentSlot: 'mainHand', stats: { strength: 8 }, attackSpeed: 2500, damage: { min: 9, max: 18 }, sellValue: 90 }],
    ['maul', { baseId: 'maul', name: 'Maul', type: 'weapon', description: 'A large two-handed hammer.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 10 }, attackSpeed: 2700, damage: { min: 15, max: 25 }, sellValue: 130 }],

    // Bows (Require Dexterity, Varying Speed)
    ['short_bow', { baseId: 'short_bow', name: 'Short Bow', type: 'weapon', description: 'A simple hunting bow.', equipmentSlot: 'mainHand', twoHanded: true, stats: { dexterity: 3 }, attackSpeed: 2000, damage: { min: 2, max: 5 }, sellValue: 10 }],
    ['hunters_bow', { baseId: 'hunters_bow', name: 'Hunter\'s Bow', type: 'weapon', description: 'A bow favored by hunters.', equipmentSlot: 'mainHand', twoHanded: true, stats: { dexterity: 5 }, attackSpeed: 2100, damage: { min: 3, max: 7 }, sellValue: 25 }],
    ['long_bow', { baseId: 'long_bow', name: 'Long Bow', type: 'weapon', description: 'A large bow requiring strength and skill.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 2, dexterity: 6 }, attackSpeed: 2200, damage: { min: 4, max: 10 }, sellValue: 50 }],
    ['composite_bow', { baseId: 'composite_bow', name: 'Composite Bow', type: 'weapon', description: 'A bow made from multiple materials.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 3, dexterity: 7 }, attackSpeed: 2150, damage: { min: 5, max: 12 }, sellValue: 80 }],

    // Staves (Caster Focused, Slow Attack)
    ['short_staff', { baseId: 'short_staff', name: 'Short Staff', type: 'weapon', description: 'A simple wooden staff.', equipmentSlot: 'mainHand', stats: { energy: 2 }, attackSpeed: 2400, damage: { min: 1, max: 4 }, sellValue: 8 }],
    ['gnarled_staff', { baseId: 'gnarled_staff', name: 'Gnarled Staff', type: 'weapon', description: 'A staff made from twisted wood.', equipmentSlot: 'mainHand', stats: { energy: 4 }, attackSpeed: 2450, damage: { min: 2, max: 6 }, sellValue: 20 }],
    ['long_staff', { baseId: 'long_staff', name: 'Long Staff', type: 'weapon', description: 'A standard wizard\'s staff.', equipmentSlot: 'mainHand', twoHanded: true, stats: { energy: 6 }, attackSpeed: 2500, damage: { min: 3, max: 8 }, sellValue: 45 }],
    ['battle_staff', { baseId: 'battle_staff', name: 'Battle Staff', type: 'weapon', description: 'A staff reinforced for combat.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 3, energy: 5 }, attackSpeed: 2400, damage: { min: 5, max: 10 }, sellValue: 70 }],

    // Wands (Caster Focused, Fast Attack)
    ['wand', { baseId: 'wand', name: 'Wand', type: 'weapon', description: 'A basic magic wand.', equipmentSlot: 'mainHand', stats: { energy: 3 }, attackSpeed: 1800, damage: { min: 1, max: 3 }, sellValue: 15 }],
    ['yew_wand', { baseId: 'yew_wand', name: 'Yew Wand', type: 'weapon', description: 'A wand crafted from yew wood.', equipmentSlot: 'mainHand', stats: { energy: 5 }, attackSpeed: 1750, damage: { min: 2, max: 4 }, sellValue: 35 }],
    ['bone_wand', { baseId: 'bone_wand', name: 'Bone Wand', type: 'weapon', description: 'A wand carved from bone.', equipmentSlot: 'mainHand', stats: { energy: 7 }, attackSpeed: 1850, damage: { min: 2, max: 5 }, sellValue: 60 }],

    // Scepters (Hybrid Caster/Melee)
    ['scepter', { baseId: 'scepter', name: 'Scepter', type: 'weapon', description: 'A short rod, often used by priests.', equipmentSlot: 'mainHand', stats: { strength: 2, energy: 3 }, attackSpeed: 2200, damage: { min: 4, max: 8 }, sellValue: 40 }],
    ['grand_scepter', { baseId: 'grand_scepter', name: 'Grand Scepter', type: 'weapon', description: 'An ornate scepter.', equipmentSlot: 'mainHand', stats: { strength: 3, energy: 5 }, attackSpeed: 2250, damage: { min: 6, max: 11 }, sellValue: 75 }],
    ['war_scepter', { baseId: 'war_scepter', name: 'War Scepter', type: 'weapon', description: 'A scepter designed for battle.', equipmentSlot: 'mainHand', stats: { strength: 5, energy: 4 }, attackSpeed: 2300, damage: { min: 8, max: 14 }, sellValue: 100 }],

    // Polearms (Two-Handed, Reach)
    ['spear', { baseId: 'spear', name: 'Spear', type: 'weapon', description: 'A simple polearm with a pointed tip.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 4, dexterity: 3 }, attackSpeed: 2300, damage: { min: 5, max: 12 }, sellValue: 30 }],
    ['trident', { baseId: 'trident', name: 'Trident', type: 'weapon', description: 'A three-pronged spear.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 5, dexterity: 4 }, attackSpeed: 2350, damage: { min: 7, max: 15 }, sellValue: 65 }],
    ['halberd', { baseId: 'halberd', name: 'Halberd', type: 'weapon', description: 'A versatile polearm with an axe blade and spike.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 7, dexterity: 2 }, attackSpeed: 2500, damage: { min: 9, max: 18 }, sellValue: 95 }],
    ['scythe', { baseId: 'scythe', name: 'Scythe', type: 'weapon', description: 'A farming tool adapted for war.', equipmentSlot: 'mainHand', twoHanded: true, stats: { strength: 6, dexterity: 4 }, attackSpeed: 2600, damage: { min: 8, max: 20 }, sellValue: 110 }],

    // --- Armor ---
    // Helms
    ['leather_cap', { baseId: 'leather_cap', name: 'Leather Cap', type: 'armor', description: 'A simple cap made of hardened leather.', equipmentSlot: 'head', stats: { vitality: 1 }, defense: 3, sellValue: 3 }],
    ['skull_cap', { baseId: 'skull_cap', name: 'Skull Cap', type: 'armor', description: 'A reinforced leather cap.', equipmentSlot: 'head', stats: { vitality: 2 }, defense: 5, sellValue: 7 }],
    ['helm', { baseId: 'helm', name: 'Helm', type: 'armor', description: 'A basic metal helmet.', equipmentSlot: 'head', stats: { vitality: 3 }, defense: 10, sellValue: 15 }],
    ['great_helm', { baseId: 'great_helm', name: 'Great Helm', type: 'armor', description: 'A large, enclosing helmet.', equipmentSlot: 'head', stats: { vitality: 5 }, defense: 18, sellValue: 30 }],
    ['crown', { baseId: 'crown', name: 'Crown', type: 'armor', description: 'A symbol of royalty, offering moderate protection.', equipmentSlot: 'head', stats: { energy: 5, vitality: 3 }, defense: 15, sellValue: 50 }],

    // Body Armor
    ['quilted_armor', { baseId: 'quilted_armor', name: 'Quilted Armor', type: 'armor', description: 'Padded cloth armor.', equipmentSlot: 'chest', stats: { vitality: 2 }, defense: 8, sellValue: 5 }],
    ['leather_armor', { baseId: 'leather_armor', name: 'Leather Armor', type: 'armor', description: 'Armor made from hardened leather.', equipmentSlot: 'chest', stats: { vitality: 3 }, defense: 12, sellValue: 10 }],
    ['hard_leather_armor', { baseId: 'hard_leather_armor', name: 'Hard Leather Armor', type: 'armor', description: 'Stiffer, more protective leather.', equipmentSlot: 'chest', stats: { vitality: 4 }, defense: 18, sellValue: 20 }],
    ['studded_leather', { baseId: 'studded_leather', name: 'Studded Leather', type: 'armor', description: 'Leather reinforced with metal studs.', equipmentSlot: 'chest', stats: { vitality: 5, dexterity: 1 }, defense: 25, sellValue: 35 }],
    ['ring_mail', { baseId: 'ring_mail', name: 'Ring Mail', type: 'armor', description: 'Leather armor with sewn-on rings.', equipmentSlot: 'chest', stats: { vitality: 6 }, defense: 35, sellValue: 50 }],
    ['scale_mail', { baseId: 'scale_mail', name: 'Scale Mail', type: 'armor', description: 'Armor made of overlapping metal scales.', equipmentSlot: 'chest', stats: { strength: 2, vitality: 7 }, defense: 45, sellValue: 70 }],
    ['chain_mail', { baseId: 'chain_mail', name: 'Chain Mail', type: 'armor', description: 'Armor made of interlocking metal rings.', equipmentSlot: 'chest', stats: { strength: 3, vitality: 8 }, defense: 60, sellValue: 100 }],
    ['splint_mail', { baseId: 'splint_mail', name: 'Splint Mail', type: 'armor', description: 'Armor with vertical metal strips.', equipmentSlot: 'chest', stats: { strength: 4, vitality: 9 }, defense: 75, sellValue: 130 }],
    ['plate_mail', { baseId: 'plate_mail', name: 'Plate Mail', type: 'armor', description: 'Armor made of large metal plates.', equipmentSlot: 'chest', stats: { strength: 5, vitality: 10 }, defense: 90, sellValue: 170 }],
    ['field_plate', { baseId: 'field_plate', name: 'Field Plate', type: 'armor', description: 'Finely crafted plate armor.', equipmentSlot: 'chest', stats: { strength: 6, vitality: 12 }, defense: 110, sellValue: 220 }],
    ['gothic_plate', { baseId: 'gothic_plate', name: 'Gothic Plate', type: 'armor', description: 'Ornate and heavy plate armor.', equipmentSlot: 'chest', stats: { strength: 7, vitality: 15 }, defense: 135, sellValue: 300 }],

    // Gloves
    ['leather_gloves', { baseId: 'leather_gloves', name: 'Leather Gloves', type: 'armor', description: 'Simple leather gloves.', equipmentSlot: 'hands', stats: { dexterity: 1 }, defense: 2, sellValue: 4 }],
    ['heavy_gloves', { baseId: 'heavy_gloves', name: 'Heavy Gloves', type: 'armor', description: 'Thick leather gloves.', equipmentSlot: 'hands', stats: { strength: 1 }, defense: 4, sellValue: 8 }],
    ['chain_gloves', { baseId: 'chain_gloves', name: 'Chain Gloves', type: 'armor', description: 'Gloves made of chainmail.', equipmentSlot: 'hands', stats: { strength: 1, dexterity: 1 }, defense: 7, sellValue: 15 }],
    ['plate_gauntlets', { baseId: 'plate_gauntlets', name: 'Plate Gauntlets', type: 'armor', description: 'Articulated plate metal gloves.', equipmentSlot: 'hands', stats: { strength: 2 }, defense: 12, sellValue: 25 }],

    // Boots
    ['leather_boots', { baseId: 'leather_boots', name: 'Leather Boots', type: 'armor', description: 'Simple leather boots.', equipmentSlot: 'feet', stats: { vitality: 1 }, defense: 2, sellValue: 4 }],
    ['heavy_boots', { baseId: 'heavy_boots', name: 'Heavy Boots', type: 'armor', description: 'Sturdy leather boots.', equipmentSlot: 'feet', stats: { vitality: 2 }, defense: 4, sellValue: 8 }],
    ['chain_boots', { baseId: 'chain_boots', name: 'Chain Boots', type: 'armor', description: 'Boots reinforced with chainmail.', equipmentSlot: 'feet', stats: { vitality: 3 }, defense: 7, sellValue: 15 }],
    ['plate_greaves', { baseId: 'plate_greaves', name: 'Plate Greaves', type: 'armor', description: 'Plate metal boots.', equipmentSlot: 'feet', stats: { strength: 1, vitality: 3 }, defense: 12, sellValue: 25 }],

    // Belts
    ['sash', { baseId: 'sash', name: 'Sash', type: 'armor', description: 'A simple cloth sash.', equipmentSlot: 'waist', stats: {}, defense: 1, sellValue: 2 }],
    ['leather_belt', { baseId: 'leather_belt', name: 'Leather Belt', type: 'armor', description: 'A sturdy leather belt.', equipmentSlot: 'waist', stats: { vitality: 1 }, defense: 3, sellValue: 6 }],
    ['heavy_belt', { baseId: 'heavy_belt', name: 'Heavy Belt', type: 'armor', description: 'A wide, thick belt.', equipmentSlot: 'waist', stats: { vitality: 3 }, defense: 5, sellValue: 12 }],
    ['plated_belt', { baseId: 'plated_belt', name: 'Plated Belt', type: 'armor', description: 'A belt reinforced with metal plates.', equipmentSlot: 'waist', stats: { strength: 1, vitality: 2 }, defense: 8, sellValue: 20 }],

    // Shields
    ['buckler', { baseId: 'buckler', name: 'Buckler', type: 'armor', description: 'A small shield.', equipmentSlot: 'offHand', stats: { dexterity: 1 }, defense: 5, blockChance: 0.10, sellValue: 6 }],
    ['small_shield', { baseId: 'small_shield', name: 'Small Shield', type: 'armor', description: 'A light shield.', equipmentSlot: 'offHand', stats: { dexterity: 2 }, defense: 8, blockChance: 0.15, sellValue: 12 }],
    ['kite_shield', { baseId: 'kite_shield', name: 'Kite Shield', type: 'armor', description: 'A medium-sized shield shaped like a kite.', equipmentSlot: 'offHand', stats: { strength: 2, vitality: 1 }, defense: 15, blockChance: 0.20, sellValue: 25 }],
    ['tower_shield', { baseId: 'tower_shield', name: 'Tower Shield', type: 'armor', description: 'A large, heavy shield offering maximum coverage.', equipmentSlot: 'offHand', stats: { strength: 4, vitality: 2 }, defense: 25, blockChance: 0.25, sellValue: 45 }],
    ['bone_shield', { baseId: 'bone_shield', name: 'Bone Shield', type: 'armor', description: 'A shield crafted from bone, favored by necromancers.', equipmentSlot: 'offHand', stats: { energy: 3 }, defense: 12, blockChance: 0.18, sellValue: 35 }],

    // --- Jewelry ---
    ['ring', { baseId: 'ring', name: 'Ring', type: 'armor', description: 'A simple ring.', equipmentSlot: 'ring1', stats: {}, sellValue: 50 }],
    ['amulet', { baseId: 'amulet', name: 'Amulet', type: 'armor', description: 'A simple amulet.', equipmentSlot: 'amulet', stats: {}, sellValue: 75 }],

    // --- Misc ---
    ['gold_coins', { baseId: 'gold_coins', name: 'Gold Coins', type: 'misc', description: 'The currency of the realm.', quantity: 1 }],
    ['key', { baseId: 'key', name: 'Key', type: 'misc', description: 'Opens locked chests.', quantity: 1, sellValue: 10 }],
]);

// Re-assert the type for items using the helper type
// This alias is used in lootGenerator.ts
export const baseItemsTyped: Map<string, BaseItemDefinition> = items;

// --- Affix Data ---
// Define possible prefixes and suffixes
export const prefixes: Map<string, Affix> = new Map([
    // --- Prefixes ---
    // Tier 1 Stats (+1-2)
    ['str_p1', { id: 'str_p1', name: 'Strong', type: 'prefix', levelReq: 1, statModifiers: { strength: 1 } }],
    ['dex_p1', { id: 'dex_p1', name: 'Agile', type: 'prefix', levelReq: 1, statModifiers: { dexterity: 1 } }],
    ['vit_p1', { id: 'vit_p1', name: 'Sturdy', type: 'prefix', levelReq: 1, statModifiers: { vitality: 1 } }],
    ['enr_p1', { id: 'enr_p1', name: 'Charged', type: 'prefix', levelReq: 1, statModifiers: { energy: 1 } }],
    ['str_p1b', { id: 'str_p1b', name: 'Tough', type: 'prefix', levelReq: 3, statModifiers: { strength: 2 } }],
    ['dex_p1b', { id: 'dex_p1b', name: 'Fine', type: 'prefix', levelReq: 3, statModifiers: { dexterity: 2 } }],
    ['vit_p1b', { id: 'vit_p1b', name: 'Burly', type: 'prefix', levelReq: 3, statModifiers: { vitality: 2 } }],
    ['enr_p1b', { id: 'enr_p1b', name: 'Glowing', type: 'prefix', levelReq: 3, statModifiers: { energy: 2 } }],

    // Tier 2 Stats (+3-5)
    ['str_p2', { id: 'str_p2', name: 'Mighty', type: 'prefix', levelReq: 8, statModifiers: { strength: 3 } }],
    ['dex_p2', { id: 'dex_p2', name: 'Nimble', type: 'prefix', levelReq: 8, statModifiers: { dexterity: 3 } }],
    ['vit_p2', { id: 'vit_p2', name: 'Hearty', type: 'prefix', levelReq: 8, statModifiers: { vitality: 3 } }],
    ['enr_p2', { id: 'enr_p2', name: 'Sparking', type: 'prefix', levelReq: 8, statModifiers: { energy: 3 } }],
    ['str_p2b', { id: 'str_p2b', name: 'Powerful', type: 'prefix', levelReq: 12, statModifiers: { strength: 5 } }],
    ['dex_p2b', { id: 'dex_p2b', name: 'Grand', type: 'prefix', levelReq: 12, statModifiers: { dexterity: 5 } }],
    ['vit_p2b', { id: 'vit_p2b', name: 'Lion', type: 'prefix', levelReq: 12, statModifiers: { vitality: 5 } }],
    ['enr_p2b', { id: 'enr_p2b', name: 'Arcing', type: 'prefix', levelReq: 12, statModifiers: { energy: 5 } }],

    // Attack Speed (IAS)
    ['ias_p1', { id: 'ias_p1', name: 'Swift', type: 'prefix', levelReq: 5, increasedAttackSpeed: 0.05 }], // 5% IAS
    ['ias_p2', { id: 'ias_p2', name: 'Quick', type: 'prefix', levelReq: 10, increasedAttackSpeed: 0.10 }], // 10% IAS
    ['ias_p3', { id: 'ias_p3', name: 'Rapid', type: 'prefix', levelReq: 18, increasedAttackSpeed: 0.15 }], // 15% IAS

    // Faster Hit Recovery (FHR)
    ['fhr_p1', { id: 'fhr_p1', name: 'Stable', type: 'prefix', levelReq: 4, fasterHitRecovery: 0.05 }], // 5% FHR
    ['fhr_p2', { id: 'fhr_p2', name: 'Balanced', type: 'prefix', levelReq: 9, fasterHitRecovery: 0.10 }], // 10% FHR

    // Resistances (Single)
    ['res_fire_p1', { id: 'res_fire_p1', name: 'Warming', type: 'prefix', levelReq: 3, statModifiers: { fireRes: 5 } }], // +5 Fire Res
    ['res_cold_p1', { id: 'res_cold_p1', name: 'Cooling', type: 'prefix', levelReq: 3, statModifiers: { coldRes: 5 } }], // +5 Cold Res
    ['res_light_p1', { id: 'res_light_p1', name: 'Grounding', type: 'prefix', levelReq: 3, statModifiers: { lightningRes: 5 } }], // +5 Light Res
    ['res_poison_p1', { id: 'res_poison_p1', name: 'Antidotal', type: 'prefix', levelReq: 3, statModifiers: { poisonRes: 5 } }], // +5 Poison Res
    ['res_fire_p2', { id: 'res_fire_p2', name: 'Heated', type: 'prefix', levelReq: 10, statModifiers: { fireRes: 10 } }], // +10 Fire Res
    ['res_cold_p2', { id: 'res_cold_p2', name: 'Chilling', type: 'prefix', levelReq: 10, statModifiers: { coldRes: 10 } }], // +10 Cold Res
    ['res_light_p2', { id: 'res_light_p2', name: 'Shocking', type: 'prefix', levelReq: 10, statModifiers: { lightningRes: 10 } }], // +10 Light Res
    ['res_poison_p2', { id: 'res_poison_p2', name: 'Venomous', type: 'prefix', levelReq: 10, statModifiers: { poisonRes: 10 } }], // +10 Poison Res

    // Elemental Damage (Added to Attacks)
    ['dmg_fire_p1', { id: 'dmg_fire_p1', name: 'Fiery', type: 'prefix', levelReq: 6, addedDamage: { fire: { min: 1, max: 3 } } }],
    ['dmg_cold_p1', { id: 'dmg_cold_p1', name: 'Chilling', type: 'prefix', levelReq: 6, addedDamage: { cold: { min: 1, max: 3 } } }],
    ['dmg_light_p1', { id: 'dmg_light_p1', name: 'Shocking', type: 'prefix', levelReq: 6, addedDamage: { lightning: { min: 1, max: 5 } } }],
    ['dmg_poison_p1', { id: 'dmg_poison_p1', name: 'Septic', type: 'prefix', levelReq: 6, addedDamage: { poison: { damage: 5, duration: 3 } } }],

    // Health / Mana
    ['hp_p1', { id: 'hp_p1', name: 'Jackal', type: 'prefix', levelReq: 2, statModifiers: { maxHp: 5 } }], // +5 HP
    ['hp_p2', { id: 'hp_p2', name: 'Fox', type: 'prefix', levelReq: 7, statModifiers: { maxHp: 10 } }], // +10 HP
    ['mana_p1', { id: 'mana_p1', name: 'Lizard', type: 'prefix', levelReq: 2, statModifiers: { maxMana: 5 } }], // +5 Mana
    ['mana_p2', { id: 'mana_p2', name: 'Snake', type: 'prefix', levelReq: 7, statModifiers: { maxMana: 10 } }], // +10 Mana

    // Magic Find / Gold Find
    ['mf_p1', { id: 'mf_p1', name: 'Seeking', type: 'prefix', levelReq: 5, magicFind: 5 }], // 5% MF
    ['gf_p1', { id: 'gf_p1', name: 'Glimmering', type: 'prefix', levelReq: 5, goldFind: 10 }], // 10% GF

    // Defense
    ['def_p1', { id: 'def_p1', name: 'Reinforced', type: 'prefix', levelReq: 4, defenseBonusPercent: 0.10 }], // +10% Defense
    ['def_p2', { id: 'def_p2', name: 'Fortified', type: 'prefix', levelReq: 11, defenseBonusPercent: 0.20 }], // +20% Defense

    // Attack Rating (Placeholder for now)
    ['ar_p1', { id: 'ar_p1', name: 'Bronze', type: 'prefix', levelReq: 3, statModifiers: { attackRating: 10 } }],
    ['ar_p2', { id: 'ar_p2', name: 'Iron', type: 'prefix', levelReq: 9, statModifiers: { attackRating: 25 } }],
]);

export const suffixes: Map<string, Affix> = new Map([
    // --- Suffixes ---
    // Tier 1 Stats (+1-2)
    ['str_s1', { id: 'str_s1', name: 'of Strength', type: 'suffix', levelReq: 1, statModifiers: { strength: 1 } }],
    ['dex_s1', { id: 'dex_s1', name: 'of Dexterity', type: 'suffix', levelReq: 1, statModifiers: { dexterity: 1 } }],
    ['vit_s1', { id: 'vit_s1', name: 'of Vitality', type: 'suffix', levelReq: 1, statModifiers: { vitality: 1 } }],
    ['enr_s1', { id: 'enr_s1', name: 'of Energy', type: 'suffix', levelReq: 1, statModifiers: { energy: 1 } }],
    ['str_s1b', { id: 'str_s1b', name: 'of Might', type: 'suffix', levelReq: 3, statModifiers: { strength: 2 } }],
    ['dex_s1b', { id: 'dex_s1b', name: 'of Skill', type: 'suffix', levelReq: 3, statModifiers: { dexterity: 2 } }],
    ['vit_s1b', { id: 'vit_s1b', name: 'of Vigor', type: 'suffix', levelReq: 3, statModifiers: { vitality: 2 } }],
    ['enr_s1b', { id: 'enr_s1b', name: 'of Brilliance', type: 'suffix', levelReq: 3, statModifiers: { energy: 2 } }],

    // Tier 2 Stats (+3-5)
    ['str_s2', { id: 'str_s2', name: 'of the Ox', type: 'suffix', levelReq: 8, statModifiers: { strength: 3 } }],
    ['dex_s2', { id: 'dex_s2', name: 'of the Cat', type: 'suffix', levelReq: 8, statModifiers: { dexterity: 3 } }],
    ['vit_s2', { id: 'vit_s2', name: 'of the Tiger', type: 'suffix', levelReq: 8, statModifiers: { vitality: 3 } }],
    ['enr_s2', { id: 'enr_s2', name: 'of the Mind', type: 'suffix', levelReq: 8, statModifiers: { energy: 3 } }],
    ['str_s2b', { id: 'str_s2b', name: 'of the Giant', type: 'suffix', levelReq: 12, statModifiers: { strength: 5 } }],
    ['dex_s2b', { id: 'dex_s2b', name: 'of Precision', type: 'suffix', levelReq: 12, statModifiers: { dexterity: 5 } }],
    ['vit_s2b', { id: 'vit_s2b', name: 'of the Mammoth', type: 'suffix', levelReq: 12, statModifiers: { vitality: 5 } }],
    ['enr_s2b', { id: 'enr_s2b', name: 'of Wizardry', type: 'suffix', levelReq: 12, statModifiers: { energy: 5 } }],

    // Attack Speed (IAS)
    ['ias_s1', { id: 'ias_s1', name: 'of Alacrity', type: 'suffix', levelReq: 5, increasedAttackSpeed: 0.05 }], // 5% IAS
    ['ias_s2', { id: 'ias_s2', name: 'of Speed', type: 'suffix', levelReq: 10, increasedAttackSpeed: 0.10 }], // 10% IAS
    ['ias_s3', { id: 'ias_s3', name: 'of Haste', type: 'suffix', levelReq: 18, increasedAttackSpeed: 0.15 }], // 15% IAS

    // Faster Hit Recovery (FHR)
    ['fhr_s1', { id: 'fhr_s1', name: 'of Balance', type: 'suffix', levelReq: 4, fasterHitRecovery: 0.05 }], // 5% FHR
    ['fhr_s2', { id: 'fhr_s2', name: 'of Stability', type: 'suffix', levelReq: 9, fasterHitRecovery: 0.10 }], // 10% FHR

    // Resistances (Single)
    ['res_fire_s1', { id: 'res_fire_s1', name: 'of Flame', type: 'suffix', levelReq: 3, statModifiers: { fireRes: 5 } }], // +5 Fire Res
    ['res_cold_s1', { id: 'res_cold_s1', name: 'of Frost', type: 'suffix', levelReq: 3, statModifiers: { coldRes: 5 } }], // +5 Cold Res
    ['res_light_s1', { id: 'res_light_s1', name: 'of Shock', type: 'suffix', levelReq: 3, statModifiers: { lightningRes: 5 } }], // +5 Light Res
    ['res_poison_s1', { id: 'res_poison_s1', name: 'of Blight', type: 'suffix', levelReq: 3, statModifiers: { poisonRes: 5 } }], // +5 Poison Res
    ['res_fire_s2', { id: 'res_fire_s2', name: 'of Fire', type: 'suffix', levelReq: 10, statModifiers: { fireRes: 10 } }], // +10 Fire Res
    ['res_cold_s2', { id: 'res_cold_s2', name: 'of Ice', type: 'suffix', levelReq: 10, statModifiers: { coldRes: 10 } }], // +10 Cold Res
    ['res_light_s2', { id: 'res_light_s2', name: 'of Lightning', type: 'suffix', levelReq: 10, statModifiers: { lightningRes: 10 } }], // +10 Light Res
    ['res_poison_s2', { id: 'res_poison_s2', name: 'of Venom', type: 'suffix', levelReq: 10, statModifiers: { poisonRes: 10 } }], // +10 Poison Res

    // Elemental Damage (Added to Attacks)
    ['dmg_fire_s1', { id: 'dmg_fire_s1', name: 'of Burning', type: 'suffix', levelReq: 6, addedDamage: { fire: { min: 1, max: 3 } } }],
    ['dmg_cold_s1', { id: 'dmg_cold_s1', name: 'of Freezing', type: 'suffix', levelReq: 6, addedDamage: { cold: { min: 1, max: 3 } } }],
    ['dmg_light_s1', { id: 'dmg_light_s1', name: 'of Static', type: 'suffix', levelReq: 6, addedDamage: { lightning: { min: 1, max: 5 } } }],
    ['dmg_poison_s1', { id: 'dmg_poison_s1', name: 'of Pestilence', type: 'suffix', levelReq: 6, addedDamage: { poison: { damage: 5, duration: 3 } } }],

    // Health / Mana
    ['hp_s1', { id: 'hp_s1', name: 'of the Jackal', type: 'suffix', levelReq: 2, statModifiers: { maxHp: 5 } }],
    ['hp_s2', { id: 'hp_s2', name: 'of the Fox', type: 'suffix', levelReq: 7, statModifiers: { maxHp: 10 } }],
    ['mana_s1', { id: 'mana_s1', name: 'of the Lizard', type: 'suffix', levelReq: 2, statModifiers: { maxMana: 5 } }],
    ['mana_s2', { id: 'mana_s2', name: 'of the Snake', type: 'suffix', levelReq: 7, statModifiers: { maxMana: 10 } }],

    // Magic Find / Gold Find
    ['mf_s1', { id: 'mf_s1', name: 'of Luck', type: 'suffix', levelReq: 5, magicFind: 5 }], // 5% MF
    ['gf_s1', { id: 'gf_s1', name: 'of Wealth', type: 'suffix', levelReq: 5, goldFind: 10 }], // 10% GF

    // Life Steal / Mana Steal
    ['lifesteal_s1', { id: 'lifesteal_s1', name: 'of the Leech', type: 'suffix', levelReq: 8, lifeStealPercent: 0.03 }], // 3% Life Steal
    ['manasteal_s1', { id: 'manasteal_s1', name: 'of the Lamprey', type: 'suffix', levelReq: 8, manaStealPercent: 0.03 }], // 3% Mana Steal

    // Defense
    ['def_s1', { id: 'def_s1', name: 'of Protection', type: 'suffix', levelReq: 4, defenseBonusPercent: 0.10 }], // +10% Defense
    ['def_s2', { id: 'def_s2', name: 'of Warding', type: 'suffix', levelReq: 11, defenseBonusPercent: 0.20 }], // +20% Defense

    // Attack Rating (Placeholder for now)
    ['ar_s1', { id: 'ar_s1', name: 'of Measure', type: 'suffix', levelReq: 3, statModifiers: { attackRating: 10 } }],
    ['ar_s2', { id: 'ar_s2', name: 'of Accuracy', type: 'suffix', levelReq: 9, statModifiers: { attackRating: 25 } }],
]);
