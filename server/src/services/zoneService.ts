import { Character, Zone, ICharacterRepository, TravelResult, ZoneStatus, ZoneWithStatus } from '../types.js';
import { zones, calculateMaxHp } from '../gameData.js';



export class ZoneService {
    private characterRepository: ICharacterRepository;

    constructor(characterRepository: ICharacterRepository) {
        this.characterRepository = characterRepository;
    }

    /**
     * Calculates the unlock status for all zones based *only* on character level.
     * @param character The character object.
     * @returns An array of ZoneWithStatus objects.
     */
    getZoneStatuses(character: Character): ZoneWithStatus[] {
        const allZonesArray = Array.from(zones.values());

        return allZonesArray.map(zone => {
            const isUnlocked = character.level >= zone.requiredLevel;
            return {
                ...zone,
                status: isUnlocked ? 'unlocked' : 'locked',
            };
        });
    }


    /**
     * Handles a character traveling to a new zone.
     * @param characterId The ID of the character traveling.
     * @param targetZoneId The ID of the destination zone.
     * @returns TravelResult indicating success/failure and relevant data.
     */
    async travel(characterId: string, targetZoneId: string): Promise<TravelResult> {
        try {
            const character = await this.characterRepository.findById(characterId);
            if (!character) {
                return { success: false, message: 'Character not found' };
            }

            const currentZone = zones.get(character.currentZoneId);
            const targetZone = zones.get(targetZoneId);

            if (!currentZone || !targetZone) {
                return { success: false, message: 'Invalid current or target zone ID' };
            }

            // Check connectivity
            if (!currentZone.connectedZoneIds.includes(targetZoneId)) {
                return { success: false, message: `Cannot travel directly from ${currentZone.name} to ${targetZone.name}` };
            }

            // Check level requirement
            if (character.level < targetZone.requiredLevel) {
                return { success: false, message: `Level ${targetZone.requiredLevel} required to enter ${targetZone.name}` };
            }

            // --- Prepare Updates ---
            const updates: Partial<Character> = { currentZoneId: targetZoneId };
            let needsCombatClear = character.currentZoneId !== targetZoneId; // Clear combat if actually moving zones
            let startCombat = false;

            // Heal if entering Town
            if (targetZoneId === 'town') {
                const maxHp = calculateMaxHp(character.stats);
                if (character.currentHp < maxHp) {
                    console.log(`ZoneService: Character ${character.name} entering town, healing to full HP (${maxHp}).`);
                    updates.currentHp = maxHp;
                }
            } else {
                // Entering a non-town zone, flag to start combat
                startCombat = true;
            }

            // --- Save Updates ---
            await this.characterRepository.update(character.id, updates);

            // --- Fetch Updated Character ---
            // Fetch again to ensure we have the absolute latest state after updates
            const updatedCharacter = await this.characterRepository.findById(characterId);
            if (!updatedCharacter) {
                 console.error(`ZoneService: Failed to fetch character ${characterId} after travel update.`);
                 // This is critical, likely indicates a DB issue
                 return { success: false, message: 'Failed to retrieve updated character data after travel.' };
            }


            console.log(`ZoneService: Character ${updatedCharacter.name} traveled to ${targetZone.name}`);

            // Prepare available zones data for the new location
            const availableZones = targetZone.connectedZoneIds
                .map(id => zones.get(id))
                .filter((z): z is Zone => !!z); // Type guard to filter out undefined

            return {
                success: true,
                message: `Traveled to ${targetZone.name}.`,
                character: updatedCharacter,
                newZone: targetZone,
                availableZones: availableZones,
                needsCombatClear: needsCombatClear,
                startCombat: startCombat
            };

        } catch (error) {
            console.error(`Error in ZoneService.travel for character ${characterId} to zone ${targetZoneId}:`, error);
            return { success: false, message: 'An internal server error occurred during travel.' };
        }
    }
}
