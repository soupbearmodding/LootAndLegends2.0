import React, { useState } from 'react';
import InventoryPanel from './InventoryPanel'; // Import the new component

// TODO: Define proper types using imports from a shared types file or define here
// --- Duplicated Types (Temporary - Should match InventoryPanel and server/src/types) ---
type EquipmentSlot = 'head' | 'chest' | 'legs' | 'feet' | 'mainHand' | 'offHand' | 'ring1' | 'ring2' | 'amulet';

interface ItemStats {
    strength?: number;
    dexterity?: number;
    vitality?: number;
    energy?: number;
}

interface Item {
    id: string;
    baseId: string;
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
    equipmentSlot?: EquipmentSlot;
    stats?: Partial<ItemStats>;
    quantity?: number;
}

type EquipmentSlots = {
    [key in EquipmentSlot]?: Item;
};
// --- End Duplicated Types ---

interface ZoneData {
    id: string;
    name: string;
    description?: string; // Add description
    requiredLevel: number;
    connectedZoneIds: string[];
    killsToUnlock?: number;
    // Add other relevant fields from server/src/types.ts Zone
}

interface CharacterData {
    id: string;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    experience: number;
    xpToNextLevel?: number; // Add xpToNextLevel (optional for now)
    currentResource?: number; // Add currentResource (optional)
    maxResource?: number; // Add maxResource (optional)
    availableAttributePoints?: number; // Add availableAttributePoints (optional)
    currentZoneId: string;
    zoneKills: Record<string, number>;
    stats: ItemStats; // Use the defined ItemStats type
    inventory: Item[]; // Add inventory
    equipment: EquipmentSlots; // Add equipment
    combatStats?: any; // Define combat stats type properly
    // Add other relevant fields
}

interface EncounterData {
    id: string;
    name: string;
    level: number;
    currentHp: number;
    maxHp: number;
    hitRateVsPlayer?: number;
    // Add other relevant fields
}


interface InGameScreenProps {
    character: CharacterData | null;
    zone: ZoneData | null; // Current zone data
    allZones: ZoneData[]; // All zones from gameData
    encounter: EncounterData | null;
    onTravel: (targetZoneId: string) => void;
    onLogout: () => void;
    // Add props for inventory management
    onEquipItem: (itemId: string) => void;
    onUnequipItem: (slot: EquipmentSlot) => void;
}

// --- Helper: ProgressBar Component ---
interface ProgressBarProps {
    current: number;
    max: number;
    label?: string;
    className?: string; // e.g., 'health-bar', 'xp-bar'
    fillClassName?: string; // e.g., 'monster-hp'
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, max, label, className = '', fillClassName = '' }) => {
    const percent = Math.max(0, Math.min(100, max > 0 ? (current / max) * 100 : 0));
    const displayLabel = label ?? `${current} / ${max}`;

    return (
        <div className={`progress-bar ${className}`}>
            <div className={`progress-bar-fill ${fillClassName}`} style={{ width: `${percent}%` }}></div>
            <span>{displayLabel}</span>
        </div>
    );
};


// --- Main InGameScreen Component ---
const InGameScreen: React.FC<InGameScreenProps> = ({
    character,
    zone, // Current zone
    allZones, // All zones
    encounter,
    onTravel,
    onLogout,
    onEquipItem, // Receive the handlers from App
    onUnequipItem
}) => {
    const [centerTab, setCenterTab] = useState<'combat-log' | 'chat'>('combat-log');
    const [rightTab, setRightTab] = useState<'inventory' | 'stats' | 'skills' | 'quests' | 'mercenaries'>('inventory');

    // --- Calculations for display ---
    const characterLevel = character?.level ?? 1;
    const currentHp = character?.currentHp ?? 0;
    const maxHp = character?.maxHp ?? 1;
    const currentResource = character?.currentResource ?? 0; // Placeholder
    const maxResource = character?.maxResource ?? 1; // Placeholder
    const currentXp = character?.experience ?? 0;
    const xpToNextLevel = character?.xpToNextLevel ?? 100;

    // --- Render Sub-Components (Could be further broken down) ---

    const renderZoneList = () => {
        // Render list if we have character data and the list of all zones
        if (!character || !allZones || allZones.length === 0) {
             console.log("Skipping zone list render: Missing character or allZones", { character, allZones });
             return <p>Loading zones...</p>; // Or return null, or a loading indicator
        }

        const currentZoneId = character.currentZoneId;
        const currentZoneData = allZones.find(z => z.id === currentZoneId); // Get full data for current zone
        const characterKills = character.zoneKills || {}; // Ensure zoneKills exists

        // Log data for debugging if needed
        // console.log("Rendering zones:", { currentZoneId, currentZoneData, allZones, characterKills });

        // Sort zones: Current first, then connected & unlocked, then connected & locked, then unconnected
        // This sorting is complex, maybe just sort by level primarily? Let's stick to level sort for now.
        const sortedZones = [...allZones].sort((a, b) => {
            if (a.id === 'town') return -1; // Town always first after current (if not current)
            if (b.id === 'town') return 1;
            return (a.requiredLevel ?? Infinity) - (b.requiredLevel ?? Infinity);
        });


        return (
            <ul id="zone-list">
                {sortedZones.map(z => {
                    const isCurrent = z.id === currentZoneId;
                    // Check connectivity safely, currentZoneData might be undefined if ID is invalid
                    const isConnected = currentZoneData?.connectedZoneIds?.includes(z.id) ?? false;
                    const levelRequirementMet = character.level >= z.requiredLevel;
                    const killsRequired = z.killsToUnlock ?? 0;
                    // Use characterKills safely, default to 0
                    const killsInCurrentZone = characterKills[currentZoneId] || 0; // Kills in the zone *you are currently in*
                    const killRequirementMet = killsRequired === 0 || killsInCurrentZone >= killsRequired;

                    // A zone is considered "locked" for travel if it's connected but requirements aren't met.
                    const isLocked = isConnected && (!levelRequirementMet || !killRequirementMet);
                    // A zone is simply inaccessible if not connected.
                    const isInaccessible = !isConnected && !isCurrent;

                    const canTravel = isConnected && levelRequirementMet && killRequirementMet;
                    const isDisabled = isCurrent || !canTravel; // Disable if current or cannot travel

                    const levelText = z.id !== 'town' ? `(Lvl ${z.requiredLevel})` : '';
                    let progressText = '';
                    let progressPercent = 0;

                    if (isConnected && !levelRequirementMet) {
                        progressText = `Lvl ${z.requiredLevel} Req.`;
                    } else if (isConnected && !killRequirementMet && killsRequired > 0) {
                        progressText = `${killsInCurrentZone} / ${killsRequired} Kills`;
                        progressPercent = (killsInCurrentZone / killsRequired) * 100;
                    }

                    return (
                        <li key={z.id} className={`zone-item ${isCurrent ? 'active' : ''} ${isLocked ? 'locked' : ''} ${isInaccessible ? 'inaccessible' : ''}`}>
                            <button
                                className="zone-button"
                                data-zone-id={z.id}
                                disabled={isDisabled}
                                onClick={() => !isDisabled && onTravel(z.id)}
                                title={isLocked ? `Requires: ${!levelRequirementMet ? `Level ${z.requiredLevel}` : ''}${!levelRequirementMet && !killRequirementMet ? ', ' : ''}${!killRequirementMet ? `${killsRequired} kills in ${currentZoneData?.name}` : ''}` : (isInaccessible ? 'Not directly accessible' : z.name)}
                            >
                                <div className="zone-button-fill" style={{ width: `${isLocked ? progressPercent : 100}%` }}></div>
                                <span className="zone-button-text">{z.name} {levelText}</span>
                                <div className="zone-button-status">
                                    {isLocked && <i className="fas fa-lock"></i>}
                                    {isLocked && progressText && <span className="zone-progress-text">{progressText}</span>}
                                    {isCurrent && <i className="fas fa-play"></i>}
                                    {/* Maybe add an icon for unconnected? */}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        );
    };

    const renderCombatArea = () => {
        if (encounter) {
            const monsterHpPercent = Math.max(0, Math.min(100, encounter.maxHp > 0 ? (encounter.currentHp / encounter.maxHp) * 100 : 0));
            return (
                <>
                    <h4>Encounter!</h4>
                    <div className="monster-info">
                        <p>{encounter.name} (Lvl {encounter.level})</p>
                        <ProgressBar
                            current={encounter.currentHp}
                            max={encounter.maxHp}
                            className="small-progress"
                            fillClassName="monster-hp"
                        />
                    </div>
                    <div className="combat-stats">
                        <p>Your Hit Rate: <span>{character?.combatStats?.hitRateVsCurrent ?? '0.0'}%</span></p>
                        <p>Monster Hit Rate: <span>{encounter?.hitRateVsPlayer ?? '0.0'}%</span></p>
                    </div>
                    {/* TODO: Add Attack Button */}
                </>
            );
        } else {
            return (
                <>
                    <h4>{zone?.id !== 'town' ? 'Exploring...' : 'Welcome!'}</h4>
                    <div className="combat-stats">
                        <p>Your Hit Rate: <span>N/A</span></p>
                        <p>Monster Hit Rate: <span>N/A</span></p>
                    </div>
                    <p>{zone?.id !== 'town' ? zone?.description ?? 'Exploring the area...' : 'Town is safe.'}</p>
                </>
            );
        }
    };

    const renderStatsTab = () => (
        <>
            <div className="panel-section">
                <h4>Attributes</h4>
                <div className="stat-list">
                    <p><span>Strength:</span> <span>{character?.stats?.strength ?? '??'}</span></p>
                    <p><span>Dexterity:</span> <span>{character?.stats?.dexterity ?? '??'}</span></p>
                    <p><span>Vitality:</span> <span>{character?.stats?.vitality ?? '??'}</span></p>
                    <p><span>Energy:</span> <span>{character?.stats?.energy ?? '??'}</span></p>
                    <p><span>Available Points:</span> <span>{character?.availableAttributePoints ?? 0}</span></p>
                </div>
            </div>
            <div className="panel-section">
                <h4>Combat</h4>
                <div className="stat-list">
                    <p><span>Damage:</span> <span>{character?.combatStats?.damageRange ?? '1-2'}</span></p>
                    <p><span>Attack Rating:</span> <span>{character?.combatStats?.attackRating ?? '??'}</span></p>
                    <p><span>Defense:</span> <span>{character?.combatStats?.defense ?? '??'}</span></p>
                    <p><span>Attack Speed:</span> <span>{character?.combatStats?.attackSpeed ?? 'Normal'}</span></p>
                </div>
            </div>
            <div className="panel-section">
                <h4>Resources</h4>
                <div className="stat-list">
                    <p><span>Life:</span> <span>{currentHp} / {maxHp}</span></p>
                    <p><span>Resource:</span> <span>{currentResource} / {maxResource}</span></p> {/* Placeholder */}
                </div>
            </div>
        </>
    );

    const renderRightPanelContent = () => {
        switch (rightTab) {
            // Pass down the handlers to InventoryPanel
            case 'inventory': return <InventoryPanel character={character} onEquipItem={onEquipItem} onUnequipItem={onUnequipItem} />;
            case 'stats': return renderStatsTab();
            case 'skills': return <p>Skills not implemented yet.</p>;
            case 'quests': return <p>Quests not implemented yet.</p>;
            case 'mercenaries': return <p>Mercenaries not implemented yet.</p>;
            default: return null;
        }
    };

    // --- Main JSX Structure ---
    return (
        <div id="game-screen">
            <header id="game-header">
                <div className="header-top">
                    <nav className="main-nav">
                        <button>Friends</button>
                        <button>Clan</button>
                        <button>Leaderboard</button>
                        <button>Achievements</button>
                    </nav>
                    <div className="game-title">
                        <h1>LOOT & LEGENDS</h1>
                    </div>
                    <div className="header-right">
                        {/* Connection status handled by App component overlay for now */}
                        <div className="debug-info">F5</div> {/* Placeholder */}
                        <button id="logout-button" className="logout-button-header" title="Logout" onClick={onLogout}>
                            <i className="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
                <div className="player-status-bars">
                    <ProgressBar current={currentHp} max={maxHp} className="health-bar" />
                    <ProgressBar current={currentResource} max={maxResource} className="resource-bar" />
                    <ProgressBar current={currentXp} max={xpToNextLevel} label={`Level ${characterLevel} - ${currentXp} / ${xpToNextLevel} XP`} className="xp-bar" />
                </div>
            </header>

            <main id="game-main">
                <aside id="left-panel">
                    <h3 className="panel-title">Zones</h3>
                    {renderZoneList()}
                </aside>

                <section id="center-panel">
                    <div id="combat-area">
                        {renderCombatArea()}
                    </div>
                    <div id="message-tabs">
                        <button className={`tab-button ${centerTab === 'combat-log' ? 'active' : ''}`} onClick={() => setCenterTab('combat-log')}>Combat</button>
                        <button className={`tab-button ${centerTab === 'chat' ? 'active' : ''}`} onClick={() => setCenterTab('chat')}>Chat</button>
                    </div>
                    <div id="message-content">
                        <div id="combat-log-content" className={`tab-content ${centerTab === 'combat-log' ? 'active' : ''}`}>
                            {/* TODO: Display actual combat log messages */}
                            <p>Welcome!</p>
                            <p>Connecting to server...</p>
                            <p>Connected to server.</p>
                        </div>
                        <div id="chat-content" className={`tab-content ${centerTab === 'chat' ? 'active' : ''}`}>
                            <p>Chat system not implemented yet.</p>
                        </div>
                    </div>
                    <div id="action-bar">
                        {/* TODO: Implement action buttons */}
                        <button>+</button> <button>+</button> <button>+</button> <button>+</button> <button>+</button>
                    </div>
                </section>

                <aside id="right-panel">
                    <div id="right-panel-tabs">
                        {(['inventory', 'stats', 'skills', 'quests', 'mercenaries'] as const).map(tab => (
                            <button
                                key={tab}
                                className={`tab-button ${rightTab === tab ? 'active' : ''}`}
                                data-tab={tab} // Keep data-tab for potential CSS targeting
                                onClick={() => setRightTab(tab)}
                                style={tab === 'inventory' && rightTab === 'inventory' ? { backgroundColor: '#4CAF50', borderColor: '#4CAF50', color: '#fff' } : {}} // Inline style for active inventory
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)} {/* Capitalize */}
                            </button>
                        ))}
                        <button className="settings-button"><i className="fas fa-cog"></i></button>
                    </div>
                    <div id="right-panel-content">
                        {renderRightPanelContent()}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default InGameScreen;
