import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
    Character,
    Monster,
    ICharacterRepository,
    FindMonsterResult,    
    AttackResult,       
    Item,
    EquipmentSlot,
    ActiveEncountersMap,
    PlayerAttackIntervalsMap,
    MonsterAttackIntervalsMap,
    PlayerAttackUpdatePayload,
    MonsterAttackUpdatePayload
} from '../types.js';
import { InventoryService } from './inventoryService.js'; // Import InventoryService

import { zones, monsters, calculateMaxHp, xpForLevel, xpRequiredForLevel } from '../gameData.js';
import { items as itemDefinitions } from '../lootData.js';
import { generateLoot as generateLootFromTable } from '../lootGenerator.js';
import { randomInt, calculateCharacterStats } from '../utils.js';

const DEFAULT_PLAYER_ATTACK_SPEED = 2000; // Default ms between player attacks if no weapon
const MIN_ATTACK_SPEED = 500; // Minimum attack speed in ms


export class CombatService {
    private characterRepository: ICharacterRepository;
    private inventoryService: InventoryService; // Add InventoryService property

    private activeEncounters: ActiveEncountersMap;
    private playerAttackIntervals: PlayerAttackIntervalsMap;
    private monsterAttackIntervals: MonsterAttackIntervalsMap;

    constructor(
        characterRepository: ICharacterRepository,
        inventoryService: InventoryService, // Inject InventoryService
        activeEncounters: ActiveEncountersMap,
        playerAttackIntervals: PlayerAttackIntervalsMap,
        monsterAttackIntervals: MonsterAttackIntervalsMap
    ) {
        this.characterRepository = characterRepository;
        this.inventoryService = inventoryService; // Store InventoryService
        this.activeEncounters = activeEncounters;
        this.playerAttackIntervals = playerAttackIntervals;
        this.monsterAttackIntervals = monsterAttackIntervals;
    }

    // --- Helper Functions (moved from combat.ts) ---

    private calculatePlayerAttackSpeed(character: Character): number {
        let baseSpeed = DEFAULT_PLAYER_ATTACK_SPEED;
        let totalIncreasedAttackSpeed = 0;

        const mainHand = character.equipment?.mainHand;
        if (mainHand && mainHand.stats?.attackSpeed) {
            baseSpeed = mainHand.stats.attackSpeed;
        }

        for (const slot in character.equipment) {
            const item = character.equipment[slot as EquipmentSlot];
            if (item) {
                totalIncreasedAttackSpeed += item.stats?.increasedAttackSpeed ?? 0;
                item.prefixes?.forEach(affix => {
                    totalIncreasedAttackSpeed += affix.statModifiers?.increasedAttackSpeed ?? 0;
                });
                item.suffixes?.forEach(affix => {
                    totalIncreasedAttackSpeed += affix.statModifiers?.increasedAttackSpeed ?? 0;
                });
            }
        }

        let finalSpeed = baseSpeed / (1 + totalIncreasedAttackSpeed);
        finalSpeed = Math.max(MIN_ATTACK_SPEED, finalSpeed);
        // console.log(`Attack Speed Calc: Base=${baseSpeed}, IAS=${(totalIncreasedAttackSpeed * 100).toFixed(0)}%, Final=${finalSpeed.toFixed(0)}ms`);
        return finalSpeed;
    }

    private calculateXpReward(monster: Monster, characterLevel: number): number {
        const mLvl = monster.level ?? 1;
        const pLvl = characterLevel;
        const baseMonsterXp = 10 + (mLvl * 5);
        const levelDiff = pLvl - mLvl;
        let xpMultiplier = 1.0;

        if (levelDiff > 10) {
            xpMultiplier = Math.max(0.05, 1.0 - (levelDiff - 10) * 0.05);
        } else if (levelDiff < -10) {
            xpMultiplier = Math.max(0.05, 1.0 - (Math.abs(levelDiff) - 10) * 0.05);
        }
        xpMultiplier = Math.max(0, xpMultiplier);
        const finalXp = Math.floor(baseMonsterXp * xpMultiplier);
        // console.log(`XP Calc: pLvl=${pLvl}, mLvl=${mLvl}, baseXP=${baseMonsterXp}, diff=${levelDiff}, mult=${xpMultiplier.toFixed(2)}, finalXP=${finalXp}`);
        return finalXp;
    }

    // Function to clear combat state for a specific connection (identified by ws, needs adaptation)
    // This might need the WebSocket object or a unique connection ID if ws is removed from service layer
    public clearCombatState(connectionId: any /* WebSocket or unique ID */): void {
        // Find intervals/encounter associated with connectionId and clear them
        // This requires adapting how state maps are keyed or accessed
        console.log(`Clearing combat state for connection: ${connectionId}`); // Placeholder
        // Example using ws as key (if passed or available)
        if (connectionId instanceof WebSocket) {
            const ws = connectionId;
            const playerInterval = this.playerAttackIntervals.get(ws);
            if (playerInterval) {
                clearInterval(playerInterval);
                this.playerAttackIntervals.delete(ws);
            }
            const monsterInterval = this.monsterAttackIntervals.get(ws);
            if (monsterInterval) {
                clearInterval(monsterInterval);
                this.monsterAttackIntervals.delete(ws);
            }
            this.activeEncounters.delete(ws);
            console.log("Cleared combat state (intervals and encounter).");
        } else {
            console.warn("clearCombatState called with non-WebSocket ID, implementation needed.");
        }
    }


    // --- Service Methods ---

    /**
     * Finds a suitable monster for the character in their current zone.
     * @param characterId The ID of the character initiating the search.
     * @param connectionId A unique identifier for the connection (e.g., WebSocket object).
     * @returns FindMonsterResult indicating success/failure and the found monster instance.
     */
    async findMonster(characterId: string, connectionId: any /* WebSocket or unique ID */): Promise<FindMonsterResult> {
        const character = await this.characterRepository.findById(characterId);
        if (!character) {
            return { success: false, message: 'Character not found' };
        }

        const currentZone = zones.get(character.currentZoneId);
        if (!currentZone || currentZone.monsterIds.length === 0) {
            return { success: false, message: 'No monsters available in this zone' };
        }

        // Check if already in an encounter (using connectionId as key)
        if (this.activeEncounters.has(connectionId)) {
             return { success: false, message: 'Already in an encounter' };
        }

        // Find a random monster template
        const randomMonsterId = currentZone.monsterIds[Math.floor(Math.random() * currentZone.monsterIds.length)];
        const monsterTemplate = monsters.get(randomMonsterId as string);

        if (!monsterTemplate) {
            console.error(`CombatService: Monster template not found for ID: ${randomMonsterId}`);
            return { success: false, message: 'Internal server error: Monster definition missing' };
        }

        // Create a unique instance
        const monsterInstance: Monster = {
            ...monsterTemplate,
            id: uuidv4(), // Unique instance ID
            currentHp: monsterTemplate.maxHp,
            stats: { ...monsterTemplate.stats },
            // Ensure attackSpeed is present, default if necessary
            attackSpeed: monsterTemplate.attackSpeed || 2000
        };

        // Store the encounter state, keyed by connectionId
        this.activeEncounters.set(connectionId, monsterInstance);
        console.log(`CombatService: Character ${character.name} encountered ${monsterInstance.name} (Instance ID: ${monsterInstance.id})`);

        // Calculate player attack speed for this encounter
        const playerAttackSpeed = this.calculatePlayerAttackSpeed(character);

        return {
            success: true,
            message: `Encountered ${monsterInstance.name}!`,
            monster: monsterInstance,
            playerAttackSpeed: playerAttackSpeed
        };
    }

    /**
     * Performs a player's attack against the monster in the current encounter.
     * Handles damage, monster death, XP, level ups, and loot.
     * @param connectionId Unique identifier for the connection (e.g., WebSocket object).
     * @param characterId The ID of the attacking character.
     * @returns AttackResult detailing the outcome of the attack.
     */
    async performPlayerAttack(connectionId: any, characterId: string): Promise<AttackResult> {
        const encounter = this.activeEncounters.get(connectionId);
        if (!encounter) {
            return { success: false, message: "Not in an encounter.", encounterEnded: true };
        }

        let character = await this.characterRepository.findById(characterId);
        if (!character) {
            this.clearCombatState(connectionId); // Clear state if character is gone
            return { success: false, message: "Character not found.", encounterEnded: true };
        }

        // Calculate final stats including equipment for this attack
        const calculatedCharacter = calculateCharacterStats(character);

        try {
            // --- Player Attack Calculation ---
            // Use calculated stats
            // TODO: Refine damage calculation (consider weapon damage, etc.)
            let playerDamage = Math.floor((calculatedCharacter.stats.strength ?? 0) / 5); // Use calculated strength
            playerDamage = Math.max(1, playerDamage); // Ensure at least 1 damage

            encounter.currentHp -= playerDamage;
            console.log(`CombatService: Player Attack - ${character.name} dealt ${playerDamage} damage to ${encounter.name}. ${encounter.name} HP: ${encounter.currentHp}/${encounter.maxHp}`);

            // Update encounter map (important for subsequent monster attacks in the same tick if applicable)
            this.activeEncounters.set(connectionId, encounter);

            const playerAttackPayload: PlayerAttackUpdatePayload = {
                playerDamageDealt: playerDamage,
                monsterUpdate: { currentHp: encounter.currentHp }
            };

            // --- Check if Monster is Defeated ---
            if (encounter.currentHp <= 0) {
                console.log(`CombatService: Monster Defeated - ${encounter.name} by ${character.name}.`);
                const defeatedMonster = { ...encounter }; // Copy data before clearing state

                this.clearCombatState(connectionId); // Clear intervals and encounter map entry

                // --- Grant Experience & Check Level Up ---
                let xpGained = this.calculateXpReward(defeatedMonster, character.level);
                xpGained = Math.max(0, xpGained);
                character.experience = (character.experience ?? 0) + xpGained;
                console.log(`CombatService: XP Gain - ${character.name} gained ${xpGained} XP. Total: ${character.experience}.`);

                let leveledUp = false;
                let statIncreases = {};
                const initialLevel = character.level; // Store initial level for comparison

                while (character.experience >= xpForLevel(character.level + 1)) {
                    leveledUp = true;
                    character.level++;
                    console.log(`CombatService: Level Up - ${character.name} to ${character.level}!`);

                    // Apply Stat Increases (Example: +1 to all)
                    if (!character.stats) character.stats = { strength: 0, dexterity: 0, vitality: 0, energy: 0 };
                    character.stats.strength = (character.stats.strength ?? 0) + 1;
                    character.stats.dexterity = (character.stats.dexterity ?? 0) + 1;
                    character.stats.vitality = (character.stats.vitality ?? 0) + 1;
                    character.stats.energy = (character.stats.energy ?? 0) + 1;
                    statIncreases = { strength: 1, dexterity: 1, vitality: 1, energy: 1 }; // Store increases for potential message

                    // Recalculate Max HP/Mana and restore
                    character.maxHp = calculateMaxHp(character.stats);
                    character.currentHp = character.maxHp; // Full heal on level up
                    // character.maxMana = calculateMaxMana(character.stats); // If mana exists
                    // character.currentMana = character.maxMana;
                }

                // --- Prepare update object for DB ---
                const updateData: Partial<Character> = { experience: character.experience };
                if (leveledUp) {
                    updateData.level = character.level;
                    updateData.stats = character.stats;
                    updateData.maxHp = character.maxHp;
                    updateData.currentHp = character.currentHp;
                    // updateData.maxMana = character.maxMana; // If mana exists
                    // updateData.currentMana = character.currentMana;
                }

                // --- Grant Resources ---
                // Simple example: grant resources based on monster level
                const essenceDropped = randomInt(1, 1 + defeatedMonster.level); // 1 + level essence
                const scrapDropped = Math.random() < 0.2 ? randomInt(0, 1) : 0; // 20% chance for 0-1 scrap

                character.monsterEssence = (character.monsterEssence ?? 0) + essenceDropped;
                character.scrapMetal = (character.scrapMetal ?? 0) + scrapDropped;
                updateData.monsterEssence = character.monsterEssence;
                updateData.scrapMetal = character.scrapMetal;
                console.log(`CombatService: Resource Gain - ${character.name} gained ${essenceDropped} Essence, ${scrapDropped} Scrap.`);

                // --- Generate Loot ---
                let generatedLoot: Item[] = [];
                if (defeatedMonster.lootTableId) {
                    generatedLoot = generateLootFromTable(defeatedMonster.lootTableId);
                    console.log(`CombatService: Loot generated for ${defeatedMonster.name}: ${generatedLoot.length} items.`);
                }

                // --- Process Gold Drops Separately ---
                let goldDropped = 0;
                const itemsToAddToInventory: Item[] = [];
                for (const lootItem of generatedLoot) {
                    if (lootItem.baseId === 'gold_coins') {
                        goldDropped += lootItem.quantity ?? 1; // Sum up gold quantity
                    } else {
                        itemsToAddToInventory.push(lootItem); // Keep actual items
                    }
                }

                if (goldDropped > 0) {
                    character.gold = (character.gold ?? 0) + goldDropped;
                    updateData.gold = character.gold; // Add gold to the main DB update
                    console.log(`CombatService: Gold Gain - ${character.name} gained ${goldDropped} Gold. Total: ${character.gold}.`);
                }

                // --- Add Actual Items to Inventory using InventoryService ---
                let characterAfterLoot = character; // Start with the character state after potential gold update
                if (itemsToAddToInventory.length > 0) {
                    for (const newItem of itemsToAddToInventory) { // Iterate only over non-gold items
                        try {
                            // Call InventoryService to handle adding the actual item
                            // Capture the result which now includes the updated character
                            const addItemResult = await this.inventoryService.addItemToInventory(characterAfterLoot.id, newItem);
                            if (addItemResult.success && addItemResult.character) {
                                // Update our local character reference *after each successful item add*
                                // This ensures subsequent calls (if any) operate on the latest inventory state
                                characterAfterLoot = addItemResult.character;
                            } else if (!addItemResult.success) {
                                // Log error if adding item failed, but continue processing other loot
                                console.error(`CombatService: Failed to add item ${newItem.name} (ID: ${newItem.id}) to inventory for character ${characterAfterLoot.id}: ${addItemResult.message}`);
                            }
                        } catch (inventoryError) {
                            console.error(`CombatService: Exception while adding item ${newItem.name} (ID: ${newItem.id}) to inventory for character ${characterAfterLoot.id}:`, inventoryError);
                        }
                    }
                    // No need to manually refetch character here, characterAfterLoot holds the latest state after all item adds
                }

                // --- Save Character Updates (XP, Level, Stats, Resources, Gold - Inventory is saved by InventoryService) ---
                // updateData already contains XP, level, stats, resources, and potentially gold
                await this.characterRepository.update(character.id, updateData);

                // --- Prepare Character Update Payload for Client ---
                // Use the character state *after* loot has been added and potentially stats recalculated
                 const finalCharacterData = characterAfterLoot; // Use the potentially updated character from inventory service
                 const finalTotalXpForCurrentLevel = xpForLevel(finalCharacterData.level);
                 const finalXpToNextLevelBracket = xpRequiredForLevel(finalCharacterData.level);
                 const finalCurrentLevelXp = finalCharacterData.experience - finalTotalXpForCurrentLevel;

                 const characterUpdatePayload: any = {
                     experience: finalCharacterData.experience,
                     currentLevelXp: finalCurrentLevelXp,
                     xpToNextLevelBracket: finalXpToNextLevelBracket,
                     monsterEssence: finalCharacterData.monsterEssence,
                     scrapMetal: finalCharacterData.scrapMetal,
                     // Include the final inventory state after adding items
                     inventory: finalCharacterData.inventory,
                     equipment: finalCharacterData.equipment,
                     gold: finalCharacterData.gold, // Ensure gold is included
                 };
                 if (leveledUp) {
                     // Use the final character data for level-up info as well
                     characterUpdatePayload.level = finalCharacterData.level;
                     characterUpdatePayload.stats = finalCharacterData.stats;
                     characterUpdatePayload.maxHp = finalCharacterData.maxHp;
                     characterUpdatePayload.currentHp = finalCharacterData.currentHp;
                     // characterUpdatePayload.maxMana = finalCharacterData.maxMana; // If mana exists
                     // characterUpdatePayload.currentMana = finalCharacterData.currentMana;
                     characterUpdatePayload.level = character.level;
                     characterUpdatePayload.stats = character.stats;
                     characterUpdatePayload.maxHp = character.maxHp;
                     characterUpdatePayload.currentHp = character.currentHp;
                     // characterUpdatePayload.maxMana = character.maxMana; // If mana exists
                     // characterUpdatePayload.currentMana = character.currentMana;
                     characterUpdatePayload.leveledUp = true;
                     characterUpdatePayload.statIncreases = statIncreases;
                 }


                return {
                    success: true,
                    message: `Defeated ${defeatedMonster.name}!`,
                    playerUpdate: playerAttackPayload, // Include the final hit
                    encounterEnded: true,
                    endReason: `Defeated ${defeatedMonster.name}! Gained ${xpGained} XP.`,
                    characterUpdate: characterUpdatePayload,
                    loot: itemsToAddToInventory // Send only actual items, not the gold object
                };
            } else {
                // Monster survived
                return {
                    success: true,
                    message: `Attacked ${encounter.name}.`,
                    playerUpdate: playerAttackPayload,
                    encounterEnded: false
                };
            }
        } catch (error) {
            console.error(`Error during player attack for character ${characterId}:`, error);
            this.clearCombatState(connectionId); // Clear state on error
            return { success: false, message: "Internal server error during player attack.", encounterEnded: true };
        }
    }

    /**
     * Performs a monster's attack against the player in the current encounter.
     * Handles damage and player death/respawn.
     * @param connectionId Unique identifier for the connection (e.g., WebSocket object).
     * @param characterId The ID of the character being attacked.
     * @returns AttackResult detailing the outcome of the attack.
     */
    async performMonsterAttack(connectionId: any, characterId: string): Promise<AttackResult> {
        const encounter = this.activeEncounters.get(connectionId);
         // If encounter ended between player attack and monster attack (e.g., player won), stop monster attack
        if (!encounter) {
            // Don't clear state here, player attack already did
            return { success: false, message: "Encounter already ended.", encounterEnded: true };
        }

        let character = await this.characterRepository.findById(characterId);
        if (!character) {
            this.clearCombatState(connectionId);
            return { success: false, message: "Character not found.", encounterEnded: true };
        }

        // Calculate final stats including equipment for defense calculation
        const calculatedCharacter = calculateCharacterStats(character);

        try {
            // --- Monster Attack Calculation ---
            let monsterRawDamage = encounter.baseDamage ?? 1;
            monsterRawDamage = Math.max(1, monsterRawDamage); // Ensure at least 1 base damage

            // Apply defense reduction (simple flat reduction for now)
            const defenseReduction = calculatedCharacter.defense ?? 0;
            const damageTaken = Math.max(1, monsterRawDamage - defenseReduction); // Ensure at least 1 damage taken

            const newHp = (calculatedCharacter.currentHp ?? 0) - damageTaken;
            console.log(`CombatService: Monster Attack - ${encounter.name} (Raw: ${monsterRawDamage}) dealt ${damageTaken} damage to ${character.name} (Def: ${defenseReduction}). ${character.name} HP: ${newHp}/${calculatedCharacter.maxHp ?? '??'}`);

            // --- Check if Player is Defeated ---
            if (newHp <= 0) {
                console.log(`CombatService: Player Death - ${character.name} defeated by ${encounter.name}.`);
                const defeatedByMonsterName = encounter.name;

                this.clearCombatState(connectionId); // Clear intervals and encounter

                // --- Player Death Consequences ---
                // Use calculated stats for respawn HP
                const respawnHp = calculateMaxHp(calculatedCharacter.stats ?? { strength: 0, dexterity: 0, vitality: 0, energy: 0 });
                const respawnZoneId = 'town'; // Respawn in town

                // Prepare updates for DB
                const updateData: Partial<Character> = {
                    currentHp: respawnHp,
                    currentZoneId: respawnZoneId,
                    // TODO: Consider XP loss or other penalties?
                };
                await this.characterRepository.update(character.id, updateData);

                // Update local character object for return payload
                character.currentHp = respawnHp;
                character.currentZoneId = respawnZoneId;

                console.log(`CombatService: Respawn - ${character.name} respawned in ${respawnZoneId} with ${respawnHp} HP.`);

                 // Prepare Character Update Payload for Client
                 const finalTotalXpForCurrentLevel = xpForLevel(character.level);
                 const finalXpToNextLevelBracket = xpRequiredForLevel(character.level);
                 const finalCurrentLevelXp = character.experience - finalTotalXpForCurrentLevel;

                 const characterUpdatePayload = {
                     currentHp: character.currentHp,
                     currentZoneId: character.currentZoneId,
                     // Include other relevant stats that might be displayed on death/respawn
                     level: character.level,
                     experience: character.experience,
                     currentLevelXp: finalCurrentLevelXp,
                     xpToNextLevelBracket: finalXpToNextLevelBracket,
                 };

                return {
                    success: true, // Attack happened, player died
                    message: `You were defeated by ${defeatedByMonsterName}!`,
                    // Send actual damage taken, not raw monster damage
                    monsterUpdate: { monsterDamageTaken: damageTaken, characterUpdate: { currentHp: 0 } },
                    encounterEnded: true,
                    respawn: true,
                    endReason: `Defeated by ${defeatedByMonsterName}! Respawning...`,
                    characterUpdate: characterUpdatePayload
                };
            } else {
                // --- Player Survived ---
                // Update DB with the new HP after taking damage
                await this.characterRepository.update(character.id, { currentHp: newHp });

                const monsterAttackPayload: MonsterAttackUpdatePayload = {
                    monsterDamageTaken: damageTaken, // Send actual damage taken
                    characterUpdate: { currentHp: newHp }
                };

                return {
                    success: true,
                    message: `${encounter.name} attacked.`,
                    monsterUpdate: monsterAttackPayload,
                    encounterEnded: false
                };
            }
        } catch (error) {
            console.error(`Error during monster attack for character ${characterId}:`, error);
            this.clearCombatState(connectionId);
            return { success: false, message: "Internal server error during monster attack.", encounterEnded: true };
        }
    }

    // TODO: Implement startCombatIntervals (maybe called by handler after findMonster success)

    /**
     * Calculates offline gains (XP, Gold) based on character and duration.
     * Placeholder implementation.
     * @param character The character who was offline.
     * @param durationSeconds The duration in seconds the character was offline.
     * @returns An object containing calculated XP and Gold gains.
     */
    async calculateOfflineGains(character: Character, durationSeconds: number): Promise<{ xp: number, gold: number }> {
        // Placeholder logic: Grant 1 XP and 1 Gold per minute offline
        const minutesOffline = Math.floor(durationSeconds / 60);
        const xpGained = minutesOffline * 1; // Example: 1 XP per minute
        const goldGained = minutesOffline * 1; // Example: 1 Gold per minute

        console.log(`CombatService (Placeholder): Calculated offline gains for ${minutesOffline} minutes: ${xpGained} XP, ${goldGained} Gold`);

        // In a real implementation, this would involve:
        // - Determining the average XP/Gold per second in the character's last zone (character.currentZoneId)
        // - Considering character stats/level/gear for efficiency
        // - Applying multipliers (e.g., from potential future prestige upgrades)
        // - Potentially capping gains based on time or other factors

        return { xp: xpGained, gold: goldGained };
    }
}
