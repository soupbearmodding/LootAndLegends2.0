import React, { useState, useEffect } from 'react';
import InventoryPanel from './InventoryPanel';
import OptionsScreen from './OptionsScreen';
import {
    EquipmentSlot,
    ItemStats,
    Item,
    EquipmentSlots,
    ZoneStatus,
    ZoneWithStatus,
    CharacterDataForClient,
    EncounterData
} from '../types.js';

interface InGameScreenProps {
    character: CharacterDataForClient | null;
    zone: ZoneWithStatus | null;
    zoneStatuses: ZoneWithStatus[];
    encounter: EncounterData | null;
    onTravel: (targetZoneId: string) => void;
    onLogout: () => void;
    onEquipItem: (itemId: string) => void;
    onUnequipItem: (slot: EquipmentSlot) => void;
    onSellItem: (itemId: string) => void;
    onLootGroundItem: (itemId: string) => void;
    onAssignPotionSlot: (slotNumber: 1 | 2, itemBaseId: string | null) => void;
    onUsePotionSlot: (slotNumber: 1 | 2) => void;
    onAutoEquipBestStat: (stat: keyof ItemStats) => void;
    onReturnToCharacterSelect: () => void; // Prop for returning
    sendWsMessage: (type: string, payload: any) => Promise<any>; // Prop for sending messages
    // Removed onCharacterDataLoaded prop
}

const getItemShorthand = (name: string): string => {
    const words = name.split(' ');
    if (words.length === 1) return name.substring(0, 2).toUpperCase();
    return words.map(word => word.charAt(0)).join('').toUpperCase();
};

interface ProgressBarProps {
    current: number; max: number; label?: string; className?: string; fillClassName?: string;
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

const POTION_COOLDOWN_DURATION = 5000;

const InGameScreen: React.FC<InGameScreenProps> = ({
    character, zone, zoneStatuses, encounter, onTravel, onLogout,
    onEquipItem, onUnequipItem, onSellItem, onAssignPotionSlot,
    onUsePotionSlot, onLootGroundItem, onAutoEquipBestStat,
    onReturnToCharacterSelect, // Destructure new props
    sendWsMessage // Destructure new props
    // Removed onCharacterDataLoaded from destructuring
}) => {
    const [centerTab, setCenterTab] = useState<'combat-log' | 'chat'>('combat-log');
    const [rightTab, setRightTab] = useState<'stats' | 'skills' | 'quests' | 'mercenaries'>('stats');
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false); // State for options modal
    const [potionCooldownEnd, setPotionCooldownEnd] = useState<{ [key in 1 | 2]?: number | null }>({ 1: null, 2: null });
    const [now, setNow] = useState(Date.now());
    // Removed saveStatus state and old modal handlers

    useEffect(() => {
        const timerId = setInterval(() => { setNow(Date.now()); }, 100);
        return () => clearInterval(timerId);
    }, []);

    // Removed old options modal handlers

    const handleUsePotionClick = (slotNumber: 1 | 2) => {
        const cooldownEndTime = potionCooldownEnd[slotNumber];
        if (typeof cooldownEndTime === 'number' && now < cooldownEndTime) {
            console.log(`Potion slot ${slotNumber} is on cooldown.`);
            return;
        }
        const potionBaseId = slotNumber === 1 ? character?.potionSlot1 : character?.potionSlot2;
        const potionItem = potionBaseId ? character?.inventory.find(item => item.baseId === potionBaseId && item.type === 'potion') : null;
        if (character && potionItem && (potionItem.quantity ?? 0) > 0) {
            setPotionCooldownEnd(prev => ({ ...prev, [slotNumber]: Date.now() + POTION_COOLDOWN_DURATION }));
            onUsePotionSlot(slotNumber);
        } else {
            console.log(`Cannot use potion slot ${slotNumber} - empty or out of potions.`);
        }
    };

    const handleAutoEquipBestStat = (stat: keyof ItemStats) => {
        console.log(`Placeholder: Requesting auto-equip for stat: ${stat}`);
        onAutoEquipBestStat(stat);
    };

    const characterLevel = character?.level ?? 1;
    const currentHp = character?.currentHp ?? 0;
    const maxHp = character?.maxHp ?? 1;
    const currentMana = character?.currentMana ?? 0;
    const maxMana = character?.maxMana ?? 1;
    const currentLevelXp = character?.currentLevelXp ?? 0;
    const xpToNextLevelBracket = character?.xpToNextLevelBracket ?? 100;

    const renderZoneList = () => {
        if (!character || !zoneStatuses || zoneStatuses.length === 0) return <p>Loading zones...</p>;
        const currentZoneId = character.currentZoneId;
        const currentZoneData = zoneStatuses.find(z => z.id === currentZoneId);
        const sortedZones = [...zoneStatuses].sort((a, b) => {
            if (a.id === 'town') return -1; if (b.id === 'town') return 1;
            return (a.requiredLevel ?? Infinity) - (b.requiredLevel ?? Infinity);
        });
        return (
            <ul id="zone-list">
                {sortedZones.map(zone => {
                    const isCurrent = zone.id === currentZoneId;
                    const isConnected = currentZoneData?.connectedZoneIds?.includes(zone.id) ?? false;
                    let isDisabled = false, buttonClass = 'zone-button', listItemClass = 'zone-item', title = zone.name, progressText = '', showLockIcon = false;
                    if (zone.status === 'unlocked') {
                        listItemClass += ' unlocked';
                        if (isCurrent) { listItemClass += ' active'; isDisabled = true; }
                        else if (!isConnected) { listItemClass += ' inaccessible'; isDisabled = true; title = `${zone.name} (Not directly accessible)`; }
                        else { title = `Travel to ${zone.name}`; }
                    } else { listItemClass += ' locked'; isDisabled = true; showLockIcon = true; title = `${zone.name} (Requires Level ${zone.requiredLevel})`; progressText = `Lvl ${zone.requiredLevel} Req.`; }
                    const levelText = zone.id !== 'town' ? `(Lvl ${zone.requiredLevel})` : '';
                    return (
                        <li key={zone.id} className={listItemClass}>
                            <button className={buttonClass} data-zone-id={zone.id} disabled={isDisabled} onClick={() => !isDisabled && onTravel(zone.id)} title={title}>
                                <div className="zone-button-fill" style={{ width: `${zone.status === 'unlocked' ? 100 : 0}%` }}></div>
                                <span className="zone-button-text">{zone.name} {levelText}</span>
                                <div className="zone-button-status">
                                    {showLockIcon && <i className="fas fa-lock"></i>}
                                    {progressText && <span className="zone-progress-text">{progressText}</span>}
                                    {isCurrent && <i className="fas fa-play"></i>}
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
                        <ProgressBar current={encounter.currentHp} max={encounter.maxHp} className="small-progress" fillClassName="monster-hp" />
                    </div>
                    <div className="combat-stats">
                        <p>Your Hit Rate: <span>{character?.combatStats?.hitRateVsCurrent ?? '0.0'}%</span></p>
                        <p>Monster Hit Rate: <span>{encounter?.hitRateVsPlayer ?? '0.0'}%</span></p>
                    </div>
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
    const renderStatsTab = () => {
        return (
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
                        <p><span>Mana:</span> <span>{currentMana} / {maxMana}</span></p>
                    </div>
                </div>
            </>
        );
     };
    const renderRightPanelContent = () => {
        switch (rightTab) {
            case 'stats': return renderStatsTab();
            case 'skills': return <p>Skills not implemented yet.</p>;
            case 'quests': return <p>Quests not implemented yet.</p>;
            case 'mercenaries': return <p>Mercenaries not implemented yet.</p>;
            default: return null;
        }
     };

    return (
        <div id="game-screen">
            <header id="game-header">
                <div className="header-top">
                    <nav className="main-nav"> <button>Friends</button> <button>Clan</button> <button>Leaderboard</button> <button>Achievements</button> </nav>
                    <div className="game-title"> <h1>LOOT & LEGENDS</h1> </div>
                    {/* --- Modified Header Right --- */}
                    <div className="header-right">
                        <button className="options-button" title="Options" onClick={() => setIsOptionsModalOpen(true)}>
                            <i className="fas fa-cog"></i>
                        </button>
                        <button id="logout-button" className="logout-button-header" title="Logout" onClick={onLogout}>
                            <i className="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                    {/* --------------------------- */}
                </div>
                <div className="player-status-bars">
                    <ProgressBar current={currentHp} max={maxHp} className="health-bar" />
                    <ProgressBar current={currentMana} max={maxMana} className="resource-bar" label={`${currentMana} / ${maxMana}`} />
                    <ProgressBar current={currentLevelXp} max={xpToNextLevelBracket} label={`Level ${characterLevel} - ${currentLevelXp} / ${xpToNextLevelBracket} XP`} className="xp-bar" />
                </div>
            </header>

            <main id="game-main">
                <aside id="left-panel"> <h3 className="panel-title">Zones</h3> {renderZoneList()} </aside>
                <section id="center-panel">
                    <div id="combat-area">{renderCombatArea()}</div>
                    <div id="message-tabs"> <button className={`tab-button ${centerTab === 'combat-log' ? 'active' : ''}`} onClick={() => setCenterTab('combat-log')}>Combat</button> <button className={`tab-button ${centerTab === 'chat' ? 'active' : ''}`} onClick={() => setCenterTab('chat')}>Chat</button> </div>
                    <div id="message-content"> <div id="combat-log-content" className={`tab-content ${centerTab === 'combat-log' ? 'active' : ''}`}> <p>Welcome!</p><p>Connecting to server...</p><p>Connected to server.</p> </div> <div id="chat-content" className={`tab-content ${centerTab === 'chat' ? 'active' : ''}`}> <p>Chat system not implemented yet.</p> </div> </div>
                    <div id="action-bar">
                        <div className="action-bar-potions">
                            {[1, 2].map(slotNumberUntyped => {
                                const slotNumber = slotNumberUntyped as 1 | 2;
                                const potionBaseId = slotNumber === 1 ? character?.potionSlot1 : character?.potionSlot2;
                                const potionItem = potionBaseId ? character?.inventory.find(item => item.baseId === potionBaseId && item.type === 'potion') : null;
                                const potionName = potionItem?.name ?? '';
                                const potionQuantity = potionItem?.quantity ?? 0;
                                const cooldownEndTime = potionCooldownEnd[slotNumber];
                                const isOnCooldown = typeof cooldownEndTime === 'number' && now < cooldownEndTime;
                                const remainingCooldown = isOnCooldown ? Math.max(0, (cooldownEndTime ?? 0) - now) : 0;
                                const cooldownPercent = isOnCooldown ? (remainingCooldown / POTION_COOLDOWN_DURATION) * 100 : 0;
                                const isDisabled = !potionItem || potionQuantity <= 0 || isOnCooldown;
                                return (
                                    <button key={`potion-${slotNumber}`} className={`action-button potion-button ${isOnCooldown ? 'on-cooldown' : ''}`} onClick={() => handleUsePotionClick(slotNumber)} disabled={isDisabled} title={isDisabled ? (isOnCooldown ? `Cooldown (${(remainingCooldown / 1000).toFixed(1)}s)` : (potionBaseId ? 'Out of potions' : 'Slot empty')) : `Use ${potionName}`}>
                                        {isOnCooldown && (<div className="cooldown-overlay" style={{ height: `${cooldownPercent}%` }}></div>)}
                                        <span className="button-content"> {potionItem ? getItemShorthand(potionName) : '+'} {potionItem && <span className="potion-quantity">{potionQuantity}</span>} </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="action-bar-skills"> <button className="action-button skill-button" title="Skill 1 (Not Implemented)">S1</button> <button className="action-button skill-button" title="Skill 2 (Not Implemented)">S2</button> <button className="action-button skill-button" title="Skill 3 (Not Implemented)">S3</button> </div>
                    </div>
                </section>
                <aside id="right-panel">
                    {/* --- Removed old settings button, moved to header --- */}
                    <div id="right-panel-tabs"> <button className="tab-button inventory-button" onClick={() => setIsInventoryModalOpen(true)}>Inventory</button> </div>
                    <div id="right-panel-content"> {renderStatsTab()} </div>
                </aside>
            </main>

            {/* --- Inventory Modal --- */}
            {isInventoryModalOpen && (
                <div className="modal-overlay" onClick={() => setIsInventoryModalOpen(false)}>
                    <div className="modal-content inventory-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-button" onClick={() => setIsInventoryModalOpen(false)}>&times;</button>
                        <InventoryPanel
                            character={character}
                            onEquipItem={onEquipItem}
                            onUnequipItem={onUnequipItem}
                            onSellItem={onSellItem}
                            onLootGroundItem={onLootGroundItem}
                            onAssignPotionSlot={onAssignPotionSlot}
                            onAutoEquipBestStat={handleAutoEquipBestStat}
                        />
                    </div>
                </div>
            )}

            {/* --- Render the new OptionsScreen component --- */}
            <OptionsScreen
                isOpen={isOptionsModalOpen}
                onClose={() => setIsOptionsModalOpen(false)}
                character={character}
                sendWsMessage={sendWsMessage}
                onReturnToCharacterSelect={onReturnToCharacterSelect}
                onLogout={onLogout}
                // Removed onCharacterDataLoaded prop
            />
        </div>
    );
};

export default InGameScreen;
