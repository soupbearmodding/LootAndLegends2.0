import { zones, monsters, characterClasses, lootTables } from './gameData.js';
import { items, prefixes, suffixes } from './lootData.js';
import { Zone, Monster, Item, CharacterClass } from './types.js';

// Basic validation function to check if a value is a non-negative number
function isNonNegativeNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && value >= 0;
}

// Validate Zone data
function validateZones(): string[] {
    const errors: string[] = [];
    console.log(`Validating ${zones.size} zones...`);
    for (const [id, zone] of zones.entries()) {
        if (!zone) {
            errors.push(`Zone ID "${id}" maps to an undefined value.`);
            continue;
        }
        if (typeof zone.id !== 'string' || zone.id !== id) errors.push(`Zone "${id}": Mismatched id property "${zone.id}".`);
        if (typeof zone.name !== 'string' || zone.name.trim() === '') errors.push(`Zone "${id}": Invalid or missing name.`);
        if (typeof zone.description !== 'string') errors.push(`Zone "${id}": Missing description.`);
        if (!isNonNegativeNumber(zone.requiredLevel)) errors.push(`Zone "${id}": Invalid requiredLevel "${zone.requiredLevel}".`);
        if (!Array.isArray(zone.connectedZoneIds)) errors.push(`Zone "${id}": Missing or invalid connectedZoneIds.`);
        else {
            zone.connectedZoneIds.forEach(connId => {
                if (!zones.has(connId)) errors.push(`Zone "${id}": Connected zone "${connId}" does not exist.`);
            });
        }
        if (!Array.isArray(zone.monsterIds)) errors.push(`Zone "${id}": Missing or invalid monsterIds.`);
        else {
             zone.monsterIds.forEach(monsterId => {
                 if (!monsters.has(monsterId)) errors.push(`Zone "${id}": Monster ID "${monsterId}" does not exist in monsters map.`);
             });
        }
    }
    return errors;
}

// Validate Monster data
function validateMonsters(): string[] {
    const errors: string[] = [];
    console.log(`Validating ${monsters.size} monsters...`);
    for (const [id, monster] of monsters.entries()) {
         if (!monster) {
            errors.push(`Monster ID "${id}" maps to an undefined value.`);
            continue;
        }
        if (typeof monster.id !== 'string' || monster.id !== id) errors.push(`Monster "${id}": Mismatched id property "${monster.id}".`);
        if (typeof monster.name !== 'string' || monster.name.trim() === '') errors.push(`Monster "${id}": Invalid or missing name.`);
        if (!isNonNegativeNumber(monster.level) || monster.level < 1) errors.push(`Monster "${id}": Invalid level "${monster.level}". Must be >= 1.`);
        if (typeof monster.stats !== 'object' || monster.stats === null) errors.push(`Monster "${id}": Missing stats object.`);
        else {
            if (!isNonNegativeNumber(monster.stats.strength)) errors.push(`Monster "${id}": Invalid stats.strength "${monster.stats.strength}".`);
            if (!isNonNegativeNumber(monster.stats.dexterity)) errors.push(`Monster "${id}": Invalid stats.dexterity "${monster.stats.dexterity}".`);
            if (!isNonNegativeNumber(monster.stats.vitality)) errors.push(`Monster "${id}": Invalid stats.vitality "${monster.stats.vitality}".`);
        }
        if (!isNonNegativeNumber(monster.maxHp) || monster.maxHp <= 0) errors.push(`Monster "${id}": Invalid maxHp "${monster.maxHp}". Must be > 0.`);
        // currentHp is initialized at runtime, no need to validate here
        if (!isNonNegativeNumber(monster.baseDamage)) errors.push(`Monster "${id}": Invalid baseDamage "${monster.baseDamage}".`);
        if (!isNonNegativeNumber(monster.attackSpeed) || monster.attackSpeed <= 0) errors.push(`Monster "${id}": Invalid attackSpeed "${monster.attackSpeed}". Must be > 0.`);
        if (monster.lootTableId && (typeof monster.lootTableId !== 'string' || !lootTables.has(monster.lootTableId))) {
             errors.push(`Monster "${id}": Invalid or non-existent lootTableId "${monster.lootTableId}".`);
        }
    }
    return errors;
}

// Validate Character Class data
function validateCharacterClasses(): string[] {
    const errors: string[] = [];
    console.log(`Validating ${characterClasses.size} character classes...`);
    for (const [id, charClass] of characterClasses.entries()) {
        if (!charClass) {
            errors.push(`Class ID "${id}" maps to an undefined value.`);
            continue;
        }
        if (typeof charClass.name !== 'string' || charClass.name.trim() === '') errors.push(`Class "${id}": Invalid or missing name.`);
        if (typeof charClass.description !== 'string') errors.push(`Class "${id}": Missing description.`);
        if (typeof charClass.baseStats !== 'object' || charClass.baseStats === null) errors.push(`Class "${id}": Missing baseStats object.`);
        else {
            if (!isNonNegativeNumber(charClass.baseStats.strength)) errors.push(`Class "${id}": Invalid baseStats.strength "${charClass.baseStats.strength}".`);
            if (!isNonNegativeNumber(charClass.baseStats.dexterity)) errors.push(`Class "${id}": Invalid baseStats.dexterity "${charClass.baseStats.dexterity}".`);
            if (!isNonNegativeNumber(charClass.baseStats.vitality)) errors.push(`Class "${id}": Invalid baseStats.vitality "${charClass.baseStats.vitality}".`);
            if (!isNonNegativeNumber(charClass.baseStats.energy)) errors.push(`Class "${id}": Invalid baseStats.energy "${charClass.baseStats.energy}".`);
        }
    }
    return errors;
}

// Validate Item data (Basic checks)
function validateItems(): string[] {
    const errors: string[] = [];
    const validTypes = ['weapon', 'armor', 'potion', 'misc'];
    const validSlots: (string | undefined)[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'ring1', 'ring2', 'amulet', undefined]; // undefined for non-equippable

    console.log(`Validating ${items.size} base items...`);
    for (const [id, item] of items.entries()) {
        if (!item) {
            errors.push(`Item Base ID "${id}" maps to an undefined value.`);
            continue;
        }
        // Validate that the item's baseId property matches the map key
        if (typeof item.baseId !== 'string' || item.baseId !== id) errors.push(`Item "${id}": Mismatched baseId property "${item.baseId}". Should match map key.`);
        if (typeof item.name !== 'string' || item.name.trim() === '') errors.push(`Item "${id}": Invalid or missing name.`);
        if (typeof item.description !== 'string') errors.push(`Item "${id}": Missing description.`);
        if (!validTypes.includes(item.type)) errors.push(`Item "${id}": Invalid type "${item.type}".`);
        if (!validSlots.includes(item.equipmentSlot)) errors.push(`Item "${id}": Invalid equipmentSlot "${item.equipmentSlot}".`);
        if (item.equipmentSlot && item.type !== 'weapon' && item.type !== 'armor') errors.push(`Item "${id}": Non-equipment type "${item.type}" has equipmentSlot "${item.equipmentSlot}".`);
        // Check attackSpeed within the stats object, only if stats and attackSpeed exist
        if (item.stats && (item.stats as any).attackSpeed !== undefined) {
            const attackSpeedValue = (item.stats as any).attackSpeed;
            // Only validate if attackSpeed is present in stats
            if (!isNonNegativeNumber(attackSpeedValue)) {
                errors.push(`Item "${id}": Invalid stats.attackSpeed "${attackSpeedValue}".`);
            }
        }
        if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1)) errors.push(`Item "${id}": Invalid quantity "${item.quantity}". Must be integer >= 1.`);
        if (item.stats && typeof item.stats !== 'object') errors.push(`Item "${id}": Invalid stats definition (must be object or undefined).`);
    }
    console.log(`Validating ${prefixes.size} prefixes...`);
    console.log(`Validating ${suffixes.size} suffixes...`);
    // Basic check: ensure they are Maps
    if (!(prefixes instanceof Map)) errors.push("Prefix data is not a Map.");
    if (!(suffixes instanceof Map)) errors.push("Suffix data is not a Map.");

    return errors;
}

// Validate Loot Table data
function validateLootTables(): string[] {
    const errors: string[] = [];
    console.log(`Validating ${lootTables.size} loot tables...`);
    for (const [id, entries] of lootTables.entries()) {
        if (!entries) {
            errors.push(`Loot Table ID "${id}" maps to an undefined value.`);
            continue;
        }
        if (!Array.isArray(entries)) {
            errors.push(`Loot Table "${id}" is not an array.`);
            continue;
        }
        entries.forEach((entry, index) => {
            if (typeof entry !== 'object' || entry === null) {
                errors.push(`Loot Table "${id}", entry ${index}: Invalid format (not an object).`);
                return; // Skip further checks for this entry
            }
            if (typeof entry.baseId !== 'string' || !items.has(entry.baseId)) {
                errors.push(`Loot Table "${id}", entry ${index}: Invalid or non-existent item baseId "${entry.baseId}".`);
            }
            if (typeof entry.chance !== 'number' || entry.chance < 0 || entry.chance > 1) {
                errors.push(`Loot Table "${id}", entry ${index} (item "${entry.baseId}"): Invalid chance "${entry.chance}". Must be between 0 and 1.`);
            }
            if (entry.minQuantity !== undefined && (!Number.isInteger(entry.minQuantity) || entry.minQuantity < 1)) {
                 errors.push(`Loot Table "${id}", entry ${index} (item "${entry.baseId}"): Invalid minQuantity "${entry.minQuantity}". Must be integer >= 1.`);
            }
            if (entry.maxQuantity !== undefined && (!Number.isInteger(entry.maxQuantity) || entry.maxQuantity < 1)) {
                 errors.push(`Loot Table "${id}", entry ${index} (item "${entry.baseId}"): Invalid maxQuantity "${entry.maxQuantity}". Must be integer >= 1.`);
            }
             if (entry.minQuantity !== undefined && entry.maxQuantity !== undefined && entry.minQuantity > entry.maxQuantity) {
                 errors.push(`Loot Table "${id}", entry ${index} (item "${entry.baseId}"): minQuantity (${entry.minQuantity}) cannot be greater than maxQuantity (${entry.maxQuantity}).`);
            }
        });
    }
    return errors;
}


// Main validation function to be called on startup
export function validateGameData(): void {
    console.log("--- Starting Game Data Validation ---");
    let allErrors: string[] = [];

    allErrors = allErrors.concat(validateZones());
    allErrors = allErrors.concat(validateMonsters());
    allErrors = allErrors.concat(validateCharacterClasses());
    allErrors = allErrors.concat(validateItems());
    allErrors = allErrors.concat(validateLootTables());

    if (allErrors.length > 0) {
        console.error("--- Game Data Validation Failed ---");
        allErrors.forEach(error => console.error(`ERROR: ${error}`));
        // Optional: Throw an error to prevent server startup with invalid data
        throw new Error("Invalid game data detected. Server startup aborted.");
    } else {
        console.log("--- Game Data Validation Successful ---");
    }
}
