import { zones, monsters, characterClasses, lootTables } from './gameData.js';
import { items, prefixes, suffixes } from './lootData.js';
import { Zone, Monster, Item, CharacterClass, ValidationRule, ValidationSchema } from './types.js';

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
    return errors; // Added missing return statement
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


// --- Runtime Payload Validation ---

// Schemas for Auth Payloads (Interfaces moved to types.ts)
export const RegisterPayloadSchema: ValidationSchema = {
    username: { type: 'string', required: true, minLength: 3 },
    password: { type: 'string', required: true, minLength: 6 } // Example: require 6+ chars
};

export const LoginPayloadSchema: ValidationSchema = {
    username: { type: 'string', required: true },
    password: { type: 'string', required: true }
};

// Schemas for Inventory Payloads
export const EquipItemPayloadSchema: ValidationSchema = {
    itemId: { type: 'string', required: true, minLength: 1 } // Assuming item IDs are non-empty strings
};

export const UnequipItemPayloadSchema: ValidationSchema = {
    slot: { type: 'string', required: true, minLength: 1 } // Assuming slot names are non-empty strings
};

export const SellItemPayloadSchema: ValidationSchema = {
    itemId: { type: 'string', required: true, minLength: 1 }
};

export const AssignPotionSlotPayloadSchema: ValidationSchema = {
    slotNumber: { type: 'number', required: true }, // Further validation (1 or 2) happens in handler/service
    itemBaseId: { type: 'string', required: false } // Allow null/undefined, specific check in handler/service
};

export const UsePotionSlotPayloadSchema: ValidationSchema = {
    slotNumber: { type: 'number', required: true } // Further validation (1 or 2) happens in handler/service
};

export const AutoEquipPayloadSchema: ValidationSchema = {
    stat: { type: 'string', required: true, minLength: 1 } // Assuming stat names are non-empty strings
};

// Schema for Combat Payloads
export const FindMonsterPayloadSchema: ValidationSchema = {
    // No properties currently needed, but schema exists for structure
};

// Schema for Zone Payloads
export const TravelPayloadSchema: ValidationSchema = {
    targetZoneId: { type: 'string', required: true, minLength: 1 } // Assuming zone IDs are non-empty strings
};

// Schemas for Character Payloads
export const CreateCharacterPayloadSchema: ValidationSchema = {
    name: { type: 'string', required: true, minLength: 1 },
    classId: { type: 'string', required: true, minLength: 1 },
    // Keep devUserId optional for the dev skip logic, validation happens in handler
    devUserId: { type: 'string', required: false }
};

export const SelectCharacterPayloadSchema: ValidationSchema = {
    characterId: { type: 'string', required: true, minLength: 1 }
};

export const DeleteCharacterPayloadSchema: ValidationSchema = {
    characterId: { type: 'string', required: true, minLength: 1 }
};

// Schema for crafting an item
export const CraftItemPayloadSchema: ValidationSchema = {
    recipeId: { type: 'string', required: true },
};

// Schema for upgrading an item
export const UpgradeItemPayloadSchema: ValidationSchema = {
    itemId: { type: 'string', required: true },
    recipeId: { type: 'string', required: true },
    affixId: { type: 'string', required: false }, // Optional, only needed for Magic/Rare upgrades
};


// Generic payload validation function
export function validatePayload(payload: unknown, schema: ValidationSchema): boolean {
    if (typeof payload !== 'object' || payload === null) {
        console.warn('Payload validation failed: Payload is not an object.');
        return false;
    }

    const data = payload as Record<string, any>;

    for (const key in schema) {
        const rule = schema[key];
        // Check if rule exists before accessing properties
        if (!rule) {
            console.warn(`Payload validation warning: No schema rule found for key "${key}". Skipping.`);
            continue;
        }
        const value = data[key];

        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) { // Also check for empty string if required
            console.warn(`Payload validation failed: Required field "${key}" is missing or empty.`);
            return false;
        }

        // Skip validation for non-required fields if they are absent
        if (!rule.required && (value === undefined || value === null)) {
            continue;
        }

        // Check type if value is present
        if (value !== undefined && value !== null) {
             if (typeof value !== rule.type) {
                // Allow for array type check if needed
                if (rule.type === 'array' && !Array.isArray(value)) {
                     console.warn(`Payload validation failed: Field "${key}" has incorrect type. Expected array, got ${typeof value}. Value:`, value);
                     return false;
                } else if (rule.type !== 'array') { // Avoid logging error if type is array but check passed
                    console.warn(`Payload validation failed: Field "${key}" has incorrect type. Expected ${rule.type}, got ${typeof value}. Value:`, value);
                    return false;
                }
            }

            // Check string minLength
            if (rule.type === 'string' && rule.minLength !== undefined && value.length < rule.minLength) {
                console.warn(`Payload validation failed: Field "${key}" length (${value.length}) is less than minimum ${rule.minLength}.`);
                return false;
            }
        }
        // Add more checks here based on ValidationSchema properties (e.g., number ranges, patterns)
    }

    // Optional: Check for extra fields not defined in the schema?
    // for (const key in data) {
    //     if (!schema.hasOwnProperty(key)) {
    //         console.warn(`Payload validation warning: Unexpected field "${key}" found.`);
    //         // Decide whether to return false or just warn based on strictness requirements
    //     }
    // }

    return true;
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
