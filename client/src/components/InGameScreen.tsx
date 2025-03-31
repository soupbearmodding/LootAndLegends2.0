import React, { useState, useEffect, useRef } from 'react';
import InventoryPanel from './InventoryPanel';
import OptionsScreen from './OptionsScreen';
import CraftingPanel from './CraftingPanel';
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
    encounter: EncounterData | null; // This prop drives the state changes
    onTravel: (targetZoneId: string) => void;
    onLogout: () => void;
    onEquipItem: (itemId: string) => void;
    onUnequipItem: (slot: EquipmentSlot) => void;
    onSellItem: (itemId: string) => void;
    onLootGroundItem: (itemId: string) => void;
    onAssignPotionSlot: (slotNumber: 1 | 2, itemBaseId: string | null) => void;
    onUsePotionSlot: (slotNumber: 1 | 2) => void;
    onAutoEquipBestStat: (stat: keyof ItemStats) => void;
    onReturnToCharacterSelect: () => void;
    sendWsMessage: (type: string, payload: any) => Promise<any>;
    availableRecipes: any[];
    requestRecipes: () => void;
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
        <div className={`relative h-4 bg-gray-700 rounded overflow-hidden text-xs text-white ${className}`}>
            <div className={`absolute top-0 left-0 h-full ${fillClassName}`} style={{ width: `${percent}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center z-10">{displayLabel}</span>
        </div>
    );
};

const POTION_COOLDOWN_DURATION = 5000;
const SPAWN_ANIMATION_DURATION = 400;
const DEATH_ANIMATION_DURATION = 400;
const HIT_ANIMATION_DURATION = 300;

const InGameScreen: React.FC<InGameScreenProps> = ({
    character, zone, zoneStatuses, encounter, onTravel, onLogout,
    onEquipItem, onUnequipItem, onSellItem, onAssignPotionSlot,
    onUsePotionSlot, onLootGroundItem, onAutoEquipBestStat,
    onReturnToCharacterSelect,
    sendWsMessage,
    availableRecipes,
    requestRecipes
}) => {
    const [centerTab, setCenterTab] = useState<'combat-log' | 'chat'>('combat-log');
    const [rightTab, setRightTab] = useState<'stats' | 'skills' | 'quests' | 'mercenaries'>('stats');
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
    const [isCraftingModalOpen, setIsCraftingModalOpen] = useState(false);
    const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
    const [potionCooldownEnd, setPotionCooldownEnd] = useState<{ [key in 1 | 2]?: number | null }>({ 1: null, 2: null });
    const [now, setNow] = useState(Date.now());

    // Animation State
    const [displayEncounter, setDisplayEncounter] = useState<EncounterData | null>(encounter); // What's currently rendered
    const [encounterContainerClass, setEncounterContainerClass] = useState(''); // Spawn animation
    const [monsterPanelClass, setMonsterPanelClass] = useState(''); // Hit/Death animation
    const spawnDeathTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for spawn/death animation timeouts
    const hitTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Separate timeout ref for hit animation
    const prevHpRef = useRef<number | undefined>(encounter?.currentHp); // Ref to track previous HP for hit detection

    // Timer for potion cooldown display
    useEffect(() => {
        const timerId = setInterval(() => { setNow(Date.now()); }, 100);
        return () => clearInterval(timerId);
    }, []);

    // Clear any existing animation timeouts when component unmounts
    useEffect(() => {
        return () => {
            if (spawnDeathTimeoutRef.current) {
                clearTimeout(spawnDeathTimeoutRef.current);
            }
            if (hitTimeoutRef.current) {
                clearTimeout(hitTimeoutRef.current);
            }
        };
    }, []);

    // Effect to handle SPAWN, DEATH, and HP updates for display
    useEffect(() => {
        // Clear previous spawn/death animation timeout if encounter state changes rapidly
        if (spawnDeathTimeoutRef.current) {
            clearTimeout(spawnDeathTimeoutRef.current);
            spawnDeathTimeoutRef.current = null;
        }
        // Clear hit animation class if encounter changes ID or becomes null
        if (!encounter || (displayEncounter && encounter.id !== displayEncounter.id)) {
            setMonsterPanelClass('');
            if (hitTimeoutRef.current) {
                clearTimeout(hitTimeoutRef.current);
                hitTimeoutRef.current = null;
            }
        }

        if (encounter && (!displayEncounter || encounter.id !== displayEncounter.id)) {
            // --- SPAWN ---
            setDisplayEncounter(encounter); // Update display immediately
            prevHpRef.current = encounter.currentHp; // Sync prevHpRef
            setEncounterContainerClass('animate-drop-fade-in'); // Trigger spawn animation
            spawnDeathTimeoutRef.current = setTimeout(() => {
                setEncounterContainerClass('');
                spawnDeathTimeoutRef.current = null;
            }, SPAWN_ANIMATION_DURATION);

        } else if (!encounter && displayEncounter) {
            // --- DEATH ---
            setMonsterPanelClass('animate-shrink-fade-out'); // Trigger death animation
            spawnDeathTimeoutRef.current = setTimeout(() => {
                setDisplayEncounter(null); // Remove monster after animation
                setMonsterPanelClass('');
                prevHpRef.current = undefined;
                spawnDeathTimeoutRef.current = null;
            }, DEATH_ANIMATION_DURATION);
        } else if (encounter && displayEncounter && encounter.id === displayEncounter.id) {
             // --- SAME MONSTER, HP/OTHER UPDATE ---
             // Update displayEncounter if any data differs, ensuring HP bar updates
             if (JSON.stringify(encounter) !== JSON.stringify(displayEncounter)) {
                 setDisplayEncounter(encounter);
             }
             // Update prevHpRef *after* the hit effect has had a chance to compare
             // This ensures the hit effect compares against the value *before* this update
             // We'll update prevHpRef in the hit effect itself.
        } else if (!encounter && !displayEncounter) {
            // Ensure clean state if starting with no encounter
            setEncounterContainerClass('');
            setMonsterPanelClass('');
            prevHpRef.current = undefined;
        }
    }, [encounter, displayEncounter]); // Depend on encounter and displayEncounter

    // Effect to handle HIT animation based on HP changes
     useEffect(() => {
         // Check if the HP of the *incoming* encounter prop is less than the *previous* HP stored
         if (encounter && encounter.id === displayEncounter?.id && encounter.currentHp < (prevHpRef.current ?? Infinity)) {
             // Clear previous hit animation timeout if any
             if (hitTimeoutRef.current) {
                 clearTimeout(hitTimeoutRef.current);
             }
             setMonsterPanelClass('animate-wiggle'); // Apply wiggle
             hitTimeoutRef.current = setTimeout(() => {
                 setMonsterPanelClass(''); // Remove class after animation
                 hitTimeoutRef.current = null;
             }, HIT_ANIMATION_DURATION);
         }
         // Update prevHpRef *after* the comparison for the next cycle
         // This ensures the next check compares against the HP that was just received
         if (encounter) {
             prevHpRef.current = encounter.currentHp;
         } else if (!displayEncounter) { // Ensure prevHp is cleared if display is also cleared (after death anim)
              prevHpRef.current = undefined;
         }
     }, [encounter?.currentHp, encounter?.id, displayEncounter]); // Depend on incoming HP/ID and current display state


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
            <ul id="zone-list" className="space-y-1"> {/* Add spacing between items */}
                {sortedZones.map(zone => {
                    const isCurrent = zone.id === currentZoneId;
                    const isConnected = currentZoneData?.connectedZoneIds?.includes(zone.id) ?? false;
                    let isDisabled = false, title = zone.name, progressText = '', showLockIcon = false;
                    let baseButtonClasses = "w-full text-left px-3 py-2 rounded border transition-colors duration-150 flex justify-between items-center text-sm";
                    let stateClasses = "";

                    if (zone.status === 'unlocked') {
                        if (isCurrent) {
                            stateClasses = "bg-indigo-600 border-indigo-500 cursor-default"; // Active zone
                            isDisabled = true;
                        } else if (!isConnected && zone.id !== 'town') { // Town is always accessible if unlocked
                            stateClasses = "bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed"; // Inaccessible
                            isDisabled = true;
                            title = `${zone.name} (Not directly accessible)`;
                        } else {
                            stateClasses = "bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500 cursor-pointer"; // Accessible & unlocked
                            title = `Travel to ${zone.name}`;
                        }
                    } else { // Locked
                        stateClasses = "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed"; // Locked zone
                        isDisabled = true;
                        showLockIcon = true;
                        title = `${zone.name} (Requires Level ${zone.requiredLevel})`;
                        progressText = `Lvl ${zone.requiredLevel} Req.`;
                    }

                    const levelText = zone.id !== 'town' ? `(Lvl ${zone.requiredLevel})` : '';

                    return (
                        <li key={zone.id}>
                            <button
                                className={`${baseButtonClasses} ${stateClasses}`}
                                data-zone-id={zone.id}
                                disabled={isDisabled}
                                onClick={() => !isDisabled && onTravel(zone.id)}
                                title={title}
                            >
                                {/* Zone Name and Level */}
                                <span>{zone.name} {levelText}</span>

                                {/* Status Icons/Text */}
                                <div className="flex items-center space-x-2 text-xs">
                                    {showLockIcon && <i className="fas fa-lock text-red-500"></i>}
                                    {progressText && <span className="text-gray-400">{progressText}</span>}
                                    {isCurrent && <i className="fas fa-play text-green-400"></i>}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        );
     };

    const renderCombatArea = () => {
        // Use displayEncounter for rendering, allows death animation to finish
        const currentDisplay = displayEncounter;

        // When not in an encounter or monster is fading out
        // Check monsterPanelClass as well to ensure death animation finishes before hiding
        if (!currentDisplay && !monsterPanelClass.includes('shrink-fade-out')) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-2">
                    <h4 className="text-lg font-semibold">{zone?.id !== 'town' ? 'Exploring...' : 'Welcome!'}</h4>
                    <div className="combat-stats grid grid-cols-2 gap-x-4 text-xs w-full max-w-xs">
                        <p className="text-right">Your Hit Rate:</p> <span className="text-left font-semibold text-gray-500">N/A</span>
                        <p className="text-right">Monster Hit Rate:</p> <span className="text-left font-semibold text-gray-500">N/A</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">{zone?.id !== 'town' ? zone?.description ?? 'Exploring the area...' : 'Town is safe.'}</p>
                </div>
            );
        }

        // When in an encounter and monster should be visible (or animating death)
        return (
            <div className="flex flex-col h-full">
                <h4 className="text-lg font-semibold text-red-400 text-center mb-2">Encounter!</h4>
                {/* Apply SPAWN animation to the container */}
                <div className={`flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 place-items-center py-2 ${encounterContainerClass}`}>
                    {/* Render monster panel only if we have display data (even if fading out) */}
                    {currentDisplay && (
                         <div className={`monster-panel bg-gray-800/60 p-3 rounded shadow w-full max-w-[220px] text-center border border-gray-600 ${monsterPanelClass}`}>
                            <p className="text-base font-medium mb-1">{currentDisplay.name} (Lvl {currentDisplay.level})</p>
                            {/* Progress bar uses displayEncounter state */}
                            <ProgressBar current={currentDisplay.currentHp} max={currentDisplay.maxHp} className="h-3" fillClassName="bg-red-600" label={`${currentDisplay.currentHp} / ${currentDisplay.maxHp}`} />
                        </div>
                    )}
                </div>
                {/* Render stats only if monster is displayed and not fading out */}
                {currentDisplay && !monsterPanelClass.includes('shrink-fade-out') && (
                    <div className="combat-stats grid grid-cols-2 gap-x-4 text-xs w-full max-w-xs mx-auto mt-2">
                        <p className="text-right">Your Hit Rate:</p> <span className="text-left font-semibold">{character?.combatStats?.hitRateVsCurrent ?? '0.0'}%</span>
                        <p className="text-right">Monster Hit Rate:</p> <span className="text-left font-semibold">{currentDisplay?.hitRateVsPlayer ?? '0.0'}%</span>
                    </div>
                )}
            </div>
        );
     };

    const renderStatsTab = () => {
        const StatRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
            <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400">{label}:</span>
                <span className="font-medium">{value ?? '??'}</span>
            </div>
        );

        return (
            <div className="space-y-3"> {/* Add space between sections */}
                <div className="panel-section">
                    <h4 className="font-semibold text-base mb-1 border-b border-gray-700 pb-0.5">Attributes</h4>
                    <div className="stat-list space-y-0.5"> {/* Fine-tune spacing within list */}
                        <StatRow label="Strength" value={character?.stats?.strength} />
                        <StatRow label="Dexterity" value={character?.stats?.dexterity} />
                        <StatRow label="Vitality" value={character?.stats?.vitality} />
                        <StatRow label="Energy" value={character?.stats?.energy} />
                        <StatRow label="Available Points" value={character?.availableAttributePoints ?? 0} />
                    </div>
                </div>
                <div className="panel-section">
                    <h4 className="font-semibold text-base mb-1 border-b border-gray-700 pb-0.5">Combat</h4>
                    <div className="stat-list space-y-0.5">
                        <StatRow label="Damage" value={character?.combatStats?.damageRange} />
                        <StatRow label="Attack Rating" value={character?.combatStats?.attackRating} />
                        <StatRow label="Defense" value={character?.combatStats?.defense} />
                        <StatRow label="Attack Speed" value={character?.combatStats?.attackSpeed} />
                    </div>
                </div>
                <div className="panel-section">
                    <h4 className="font-semibold text-base mb-1 border-b border-gray-700 pb-0.5">Resources</h4>
                    <div className="stat-list space-y-0.5">
                        <StatRow label="Life" value={`${currentHp} / ${maxHp}`} />
                        <StatRow label="Mana" value={`${currentMana} / ${maxMana}`} />
                    </div>
                </div>
            </div>
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

    // Tailwind styled InGameScreen
    return (
        <div id="game-screen" className="flex flex-col h-screen bg-gray-900 text-gray-200">
            <header id="game-header" className="bg-gray-800 shadow-md p-2">
                <div className="header-top flex justify-between items-center mb-2">
                    <nav className="main-nav flex space-x-2"> {/* Placeholder nav */}
                        <button className="text-xs text-gray-400 hover:text-white disabled:opacity-50" disabled>Friends</button>
                        <button className="text-xs text-gray-400 hover:text-white disabled:opacity-50" disabled>Clan</button>
                        <button className="text-xs text-gray-400 hover:text-white disabled:opacity-50" disabled>Leaderboard</button>
                        <button className="text-xs text-gray-400 hover:text-white disabled:opacity-50" disabled>Achievements</button>
                    </nav>
                    <div className="game-title"> <h1 className="text-xl font-bold text-yellow-400">LOOT & LEGENDS</h1> </div>
                    <div className="header-right flex items-center space-x-3">
                        <button className="text-gray-400 hover:text-white" title="Options" onClick={() => setIsOptionsModalOpen(true)}>
                            <i className="fas fa-cog"></i>
                        </button>
                        <button id="logout-button" className="text-gray-400 hover:text-white" title="Logout" onClick={onLogout}>
                            <i className="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
                <div className="player-status-bars grid grid-cols-3 gap-2">
                    <ProgressBar current={currentHp} max={maxHp} className="health-bar" fillClassName="bg-red-600" />
                    <ProgressBar current={currentMana} max={maxMana} className="resource-bar" fillClassName="bg-blue-600" label={`${currentMana} / ${maxMana}`} />
                    <ProgressBar current={currentLevelXp} max={xpToNextLevelBracket} label={`Lvl ${characterLevel} - ${currentLevelXp} / ${xpToNextLevelBracket} XP`} className="xp-bar" fillClassName="bg-yellow-500" />
                </div>
            </header>

            <main id="game-main" className="flex flex-grow overflow-hidden p-2 gap-2">
                {/* Left Panel */}
                <aside id="left-panel" className="w-1/5 bg-gray-800 rounded shadow p-2 flex flex-col">
                    <h3 className="panel-title text-center font-semibold mb-2 border-b border-gray-700 pb-1">Zones</h3>
                    <div className="flex-grow overflow-y-auto"> {/* Make zone list scrollable */}
                        {renderZoneList()}
                    </div>
                </aside>

                {/* Center Panel */}
                <section id="center-panel" className="flex-grow bg-gray-800 rounded shadow p-2 flex flex-col">
                    {/* Combat/Exploration Area - Adjusted padding and min-height */}
                    <div id="combat-area" className="bg-gray-700/80 p-2 rounded mb-2 min-h-[180px] flex flex-col"> {/* Use flex-col for internal layout */}
                        {renderCombatArea()}
                    </div>
                    {/* Message Tabs */}
                    <div id="message-tabs" className="flex border-b border-gray-700 mb-1">
                        <button className={`py-1 px-3 text-sm ${centerTab === 'combat-log' ? 'bg-gray-700 rounded-t font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`} onClick={() => setCenterTab('combat-log')}>Combat</button>
                        <button className={`py-1 px-3 text-sm ${centerTab === 'chat' ? 'bg-gray-700 rounded-t font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`} onClick={() => setCenterTab('chat')}>Chat</button>
                    </div>
                    {/* Message Content */}
                    <div id="message-content" className="flex-grow bg-gray-700/50 rounded p-2 overflow-y-auto text-xs mb-2 min-h-[100px]"> {/* Ensure min height */}
                        <div id="combat-log-content" className={`tab-content ${centerTab === 'combat-log' ? 'block' : 'hidden'}`}>
                            {/* TODO: Replace static messages with dynamic log */}
                            <p>Welcome!</p>
                            <p>Connecting to server...</p>
                            <p>Connected to server.</p>
                        </div>
                        <div id="chat-content" className={`tab-content ${centerTab === 'chat' ? 'block' : 'hidden'}`}>
                            <p>Chat system not implemented yet.</p>
                        </div>
                    </div>
                    <div id="action-bar" className="mt-auto flex justify-center items-center space-x-4 p-1 bg-gray-700 rounded"> {/* Action bar styling */}
                        <div className="action-bar-potions flex space-x-1">
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
                                // Basic Tailwind styling for potion button
                                return (
                                    <button
                                        key={`potion-${slotNumber}`}
                                        className={`relative w-10 h-10 bg-gray-600 rounded border border-gray-500 text-white text-xs flex items-center justify-center overflow-hidden ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-500'}`}
                                        onClick={() => handleUsePotionClick(slotNumber)}
                                        disabled={isDisabled}
                                        title={isDisabled ? (isOnCooldown ? `Cooldown (${(remainingCooldown / 1000).toFixed(1)}s)` : (potionBaseId ? 'Out of potions' : 'Slot empty')) : `Use ${potionName}`}
                                    >
                                        {isOnCooldown && (<div className="absolute bottom-0 left-0 w-full bg-black/70" style={{ height: `${cooldownPercent}%` }}></div>)}
                                        <span className="relative z-10 flex flex-col items-center">
                                            <span>{potionItem ? getItemShorthand(potionName) : '+'}</span>
                                            {potionItem && <span className="text-[8px]">{potionQuantity}</span>}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="action-bar-skills flex space-x-1"> {/* Basic skill button styling */}
                            <button className="w-10 h-10 bg-gray-600 rounded border border-gray-500 text-gray-400 text-xs flex items-center justify-center opacity-50 cursor-not-allowed" title="Skill 1 (Not Implemented)">S1</button>
                            <button className="w-10 h-10 bg-gray-600 rounded border border-gray-500 text-gray-400 text-xs flex items-center justify-center opacity-50 cursor-not-allowed" title="Skill 2 (Not Implemented)">S2</button>
                            <button className="w-10 h-10 bg-gray-600 rounded border border-gray-500 text-gray-400 text-xs flex items-center justify-center opacity-50 cursor-not-allowed" title="Skill 3 (Not Implemented)">S3</button>
                        </div>
                    </div>
                </section>

                {/* Right Panel */}
                <aside id="right-panel" className="w-1/4 bg-gray-800 rounded shadow p-2 flex flex-col">
                    {/* Right Panel Tabs (Inventory/Crafting Buttons) */}
                    <div id="right-panel-tabs" className="grid grid-cols-2 gap-2 mb-2"> {/* Use grid for equal width */}
                        <button className="py-1.5 px-3 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors" onClick={() => setIsInventoryModalOpen(true)}>Inventory</button>
                        <button className="py-1.5 px-3 text-sm bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors" onClick={() => setIsCraftingModalOpen(true)}>Crafting</button>
                    </div>
                    {/* Right Panel Content (Stats/Skills/etc.) */}
                    <div id="right-panel-content" className="flex-grow overflow-y-auto text-sm px-1"> {/* Add slight padding */}
                        {renderRightPanelContent()} {/* Corrected: Call renderRightPanelContent */}
                    </div>
                </aside>
            </main>

            {/* --- Inventory Modal --- */}
            {isInventoryModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setIsInventoryModalOpen(false)}> {/* Added padding to outer container */}
                    {/* Increased max-w, added w-full and h-5/6 for larger size */}
                    <div className="bg-gray-800 rounded shadow-xl p-4 max-w-6xl w-full h-5/6 text-gray-200 relative flex flex-col" onClick={e => e.stopPropagation()}>
                        <button className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl font-bold z-10" onClick={() => setIsInventoryModalOpen(false)}>&times;</button> {/* Ensure button is above */}
                        {/* Added flex-grow and overflow-hidden to allow panel to fill space */}
                        <div className="flex-grow overflow-hidden">
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
                </div>
            )}

             {/* --- Crafting Modal --- */}
             {isCraftingModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setIsCraftingModalOpen(false)}> {/* Added padding */}
                    {/* Increased max-w, added w-full and h-5/6 for larger size */}
                    <div className="bg-gray-800 rounded shadow-xl p-4 max-w-6xl w-full h-5/6 text-gray-200 relative flex flex-col" onClick={e => e.stopPropagation()}>
                        <button className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl font-bold z-10" onClick={() => setIsCraftingModalOpen(false)}>&times;</button> {/* Ensure button is above */}
                        {/* Added flex-grow and overflow-hidden */}
                        <div className="flex-grow overflow-hidden">
                            {/* Render CraftingPanel directly and pass props */}
                            <CraftingPanel
                                character={character}
                                availableRecipes={availableRecipes}
                                sendWsMessage={sendWsMessage}
                                requestRecipes={requestRecipes}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- Options Modal --- */}
            <OptionsScreen
                isOpen={isOptionsModalOpen}
                onClose={() => setIsOptionsModalOpen(false)}
                character={character}
                sendWsMessage={sendWsMessage}
                onReturnToCharacterSelect={onReturnToCharacterSelect}
                onLogout={onLogout}
            />
        </div>
    );
};

export default InGameScreen;