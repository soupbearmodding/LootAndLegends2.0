import React, { useState, useEffect } from 'react';

import {
    EquipmentSlot,
    ItemStats,
    Item,
    EquipmentSlots,
    CharacterDataForClient
} from '../types.js';

interface InventoryPanelProps {
    character: CharacterDataForClient | null;
    onEquipItem: (itemId: string) => void;
    onUnequipItem: (slot: EquipmentSlot) => void;
    onSellItem: (itemId: string) => void;
    onLootGroundItem: (itemId: string) => void;
    onAssignPotionSlot: (slotNumber: 1 | 2, itemBaseId: string | null) => void;
    onAutoEquipBestStat: (stat: keyof ItemStats) => void;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({
    character,
    onEquipItem,
    onUnequipItem,
    onSellItem,
    onLootGroundItem,
    onAssignPotionSlot,
    onAutoEquipBestStat
}) => {
    const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
    const [itemTooltipPosition, setItemTooltipPosition] = useState({ x: 0, y: 0 });
    const [hoveredAutoEquipStat, setHoveredAutoEquipStat] = useState<keyof ItemStats | null>(null);
    const [autoEquipTooltipContent, setAutoEquipTooltipContent] = useState<string>('');
    const [autoEquipTooltipPosition, setAutoEquipTooltipPosition] = useState({ x: 0, y: 0 });


    if (!character) {
        return <p>Loading character data...</p>;
    }

    // --- Event Handlers ---
    const handleItemMouseEnter = (item: Item, event: React.MouseEvent) => {
        setHoveredItem(item);
        setItemTooltipPosition({ x: event.clientX + 15, y: event.clientY + 15 });
    };
    const handleItemMouseLeave = () => {
        setHoveredItem(null);
    };

    // --- Auto-Equip Calculation & Tooltip Handlers ---
    const calculateAutoEquipChanges = (targetStat: keyof ItemStats): Partial<ItemStats> => {
        if (!character) return {};

        const netChanges: Partial<ItemStats> = {};
        const slots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
        const inventoryItems = character.inventory;
        const currentEquipment = character.equipment;

        for (const slot of slots) {
            const currentItem = currentEquipment[slot];
            let bestInventoryItem: Item | null = null;
            let bestStatValue = -Infinity;

            // Find best item in inventory for this slot and target stat
            for (const invItem of inventoryItems) {
                if (invItem.equipmentSlot === slot) {
                    const statValue = invItem.stats?.[targetStat] ?? 0;
                    // Ensure we don't consider the currently equipped item if it's also in inventory
                    if (invItem.id !== currentItem?.id && statValue > bestStatValue) {
                        bestStatValue = statValue;
                        bestInventoryItem = invItem;
                    }
                }
            }

            // If no better item found in inventory, or if the best is the current one, skip slot
            if (!bestInventoryItem || bestInventoryItem.id === currentItem?.id) {
                continue;
            }

            // Calculate stat differences for this slot
            const currentStats = currentItem?.stats ?? {};
            const bestStats = bestInventoryItem.stats ?? {};
            const allStatKeys = new Set([...Object.keys(currentStats), ...Object.keys(bestStats)]) as Set<keyof ItemStats>;

            allStatKeys.forEach(statKey => {
                const currentVal = currentStats[statKey] ?? 0;
                const bestVal = bestStats[statKey] ?? 0;
                const diff = bestVal - currentVal;
                if (diff !== 0) {
                    netChanges[statKey] = (netChanges[statKey] ?? 0) + diff;
                }
            });
        }

        return netChanges;
    };

    const formatStatChanges = (changes: Partial<ItemStats>): string => {
        const lines = Object.entries(changes)
            .filter(([, value]) => value !== 0)
            .map(([stat, value]) => {
                const sign = value > 0 ? '+' : '';
                const color = value > 0 ? 'lightgreen' : 'salmon';
                return `${stat}: ${sign}${value}`;
            });
        return lines.length > 0 ? lines.join('\n') : 'No changes';
    };


    const handleAutoEquipMouseEnter = (stat: keyof ItemStats, event: React.MouseEvent) => {
        const changes = calculateAutoEquipChanges(stat);
        const formattedChanges = formatStatChanges(changes);
        setHoveredAutoEquipStat(stat);
        setAutoEquipTooltipContent(formattedChanges);
        setAutoEquipTooltipPosition({ x: event.clientX + 15, y: event.clientY + 15 });
    };

    const handleAutoEquipMouseLeave = () => {
        setHoveredAutoEquipStat(null);
    };


    // --- Helper Functions ---
    // Updated to return Tailwind classes
    const getRarityClass = (rarity?: string): string => {
        switch (rarity) {
            case 'magic': return 'text-blue-400 border-blue-400';
            case 'rare': return 'text-yellow-400 border-yellow-400';
            case 'unique': return 'text-orange-400 border-orange-400'; // Example color
            case 'legendary': return 'text-purple-500 border-purple-500';
            case 'common': default: return 'text-white border-gray-500';
        }
    };
    const getRarityColor = (rarity?: string): string => { // Keep this for tooltip border maybe? Or remove if not needed.
        switch (rarity) {
            case 'magic': return '#6888ff';
            case 'rare': return '#ffff00';
            case 'unique': return '#a5694f';
            case 'legendary': return '#af00ff';
            case 'common': default: return '#ffffff'; // White for common text
        }
    };
    const getItemShorthand = (nameInput: string | undefined): string => {
        if (!nameInput) return '??';
        const trimmedName = nameInput.trim();
        if (!trimmedName) return '??';
        const shorthand = trimmedName.substring(0, 2).toUpperCase();
        return shorthand || '??';
    };

    // --- Render Functions ---
    const renderInventoryGrid = () => {
        const columns = 10;
        const rows = 6;
        const gridSize = columns * rows; // 10 wide, 6 down = 60 slots
        const gridItems: (Item | null)[] = Array(gridSize).fill(null);
        const itemsToDisplay = character?.inventory.filter(item => item.baseId !== 'gold_coins') || [];
        itemsToDisplay.forEach((item, index) => {
            if (index < gridSize) { gridItems[index] = item; }
        });
        const goldAmount = character?.gold ?? 0;

        // Tailwind styled Inventory Grid
        return (
            <div className="inventory-grid-container mb-4">
                <div className="inventory-header flex justify-between items-center mb-2 border-b border-gray-600 pb-1">
                    <h4 className="text-lg font-semibold">Inventory</h4>
                    <div className="currency-display text-sm space-x-3">
                        <span>Gold: <span className="text-yellow-400">{goldAmount}</span></span>
                        <span>Essence: <span className="text-purple-400">{character?.monsterEssence ?? 0}</span></span>
                        <span>Scrap: <span className="text-gray-400">{character?.scrapMetal ?? 0}</span></span>
                    </div>
                </div>
                {/* Improved grid styling */}
                <div className="grid grid-cols-10 gap-1 bg-gray-900/50 p-2 rounded border border-gray-700 shadow-inner">
                    {gridItems.map((item, index) => (
                        <div
                            key={item ? item.id : `empty-${index}`}
                            className={`aspect-square border flex items-center justify-center text-sm font-semibold relative transition-colors duration-150 ${item ? getRarityClass(item.rarity) : 'border-gray-600/50'} ${item ? 'bg-gray-800 hover:bg-gray-700 shadow-md' : 'bg-gray-800/30'}`}
                            onMouseEnter={(e) => item && handleItemMouseEnter(item, e)}
                            onMouseLeave={handleItemMouseLeave}
                            onClick={() => item && item.equipmentSlot && onEquipItem(item.id)}
                            onContextMenu={(e) => {
                                if (item) {
                                    e.preventDefault();
                                    setHoveredItem(null); // Hide tooltip before selling
                                    onSellItem(item.id);
                                }
                            }}
                            style={{ cursor: item ? 'pointer' : 'default' }}
                            title={item ? `Left-click to equip\nRight-click to sell ${item.name}` : 'Empty slot'}
                        >
                            {/* Slightly larger text for shorthand */}
                            <span className="z-10">{item ? getItemShorthand(item.baseName || item.name) : ''}</span>
                            {item && item.quantity && item.quantity > 1 && (
                                <span className="absolute bottom-0 right-0 text-[9px] bg-black/80 px-1 rounded-tl leading-tight">{item.quantity}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
     };

    const renderGroundLoot = () => {
        const groundItems = character?.groundLoot ?? [];
        // Tailwind styled Ground Loot
        return (
            <div className="ground-loot-container mt-4">
                <h4 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">Ground Loot (Last 10)</h4>
                <ul className="space-y-1 text-sm max-h-32 overflow-y-auto"> {/* Scrollable list */}
                    {groundItems.length === 0 && <li className="text-gray-500 italic">Nothing on the ground.</li>}
                    {groundItems.map(item => (
                        <li
                            key={item.id}
                            className={`p-1 rounded cursor-pointer hover:bg-gray-700 ${getRarityClass(item.rarity)}`} // Use rarity class for text color
                            onMouseEnter={(e) => handleItemMouseEnter(item, e)}
                            onMouseLeave={handleItemMouseLeave}
                            onClick={() => onLootGroundItem(item.id)}
                            title={`Click to loot ${item.name}`}
                        >
                            {item.name} {item.quantity && item.quantity > 1 ? `(${item.quantity})` : ''}
                        </li>
                    ))}
                </ul>
            </div>
        );
     };

    const renderEquipmentSlots = () => {
        const slots: EquipmentSlot[] = ['head', 'chest', 'waist', 'hands', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
        // Tailwind styled Equipment Slots
        return (
            <div className="equipment-slots-container mb-4">
                <h4 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">Equipped</h4>
                {/* Removed max-height, allow natural flow */}
                <ul className="space-y-1.5 text-sm pr-1"> {/* Increased spacing slightly */}
                    {slots.map(slot => {
                        const item = Object.prototype.hasOwnProperty.call(character.equipment, slot)
                            ? character.equipment[slot]
                            : undefined;
                        return (
                            <li
                                key={slot}
                                className={`flex justify-between items-center p-1 rounded ${item ? 'cursor-pointer hover:bg-gray-700' : ''}`}
                                onMouseEnter={(e) => item && handleItemMouseEnter(item, e)}
                                onMouseLeave={handleItemMouseLeave}
                                onClick={() => item && onUnequipItem(slot)}
                                title={item ? `Unequip ${item.name}` : 'Slot empty'}
                            >
                                {/* Improved alignment and spacing */}
                                <strong className="capitalize mr-2 w-20 flex-shrink-0">{slot.replace(/([A-Z])/g, ' $1')}:</strong>
                                {item ? <span className={`truncate ${getRarityClass(item.rarity)}`}>{item.name}</span> : <span className="text-gray-500 italic">(Empty)</span>}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
     };

    // --- Render Auto-Equip Panel ---
    const renderAutoEquipPanel = () => {
        const statsToEquip: (keyof ItemStats)[] = ['strength', 'dexterity', 'vitality', 'energy'];
        // Tailwind styled Auto-Equip
        return (
            <div className="auto-equip-container mt-4">
                <h4 className="text-lg font-semibold mb-2 border-b border-gray-600 pb-1">Auto Equip Best Stats</h4>
                <div className="grid grid-cols-2 gap-2">
                    {statsToEquip.map(stat => (
                        <button
                            key={stat}
                            className="py-1 px-2 rounded focus:outline-none focus:shadow-outline text-white font-bold text-sm bg-gray-600 hover:bg-gray-700"
                            onClick={() => onAutoEquipBestStat(stat)}
                            onMouseEnter={(e) => handleAutoEquipMouseEnter(stat, e)}
                            onMouseLeave={handleAutoEquipMouseLeave}
                        >
                            {stat.charAt(0).toUpperCase() + stat.slice(1)} {/* Capitalize stat name */}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    const renderItemTooltip = () => {
        if (!hoveredItem) return null;

        const itemToShow = hoveredItem;
        const isInventoryItem = character.inventory.some(invItem => invItem.id === itemToShow.id);
        const isEquippable = !!itemToShow.equipmentSlot;
        let comparisonElements: React.ReactElement[] = [];

        // --- Stat Comparison Logic ---
        if (isInventoryItem && isEquippable && itemToShow.equipmentSlot) {
            const targetSlot = itemToShow.equipmentSlot;
            if (targetSlot && Object.prototype.hasOwnProperty.call(character.equipment, targetSlot)) {
                const currentItem = character.equipment[targetSlot];
                const hoveredStats = itemToShow.stats || {};
                // Check currentItem exists before accessing stats
                const currentStats = currentItem?.stats || {};
                const allStatKeys = new Set([...Object.keys(hoveredStats), ...Object.keys(currentStats)]) as Set<keyof ItemStats>;

                comparisonElements = Array.from(allStatKeys)
                    .map(stat => {
                        const hoveredValue = hoveredStats[stat] || 0;
                        const currentValue = currentStats[stat] || 0;
                        const diff = hoveredValue - currentValue;
                        if (diff !== 0) {
                            const sign = diff > 0 ? '+' : '';
                            const color = diff > 0 ? 'lightgreen' : 'salmon';
                            return <li key={stat} style={{ color }}>{stat}: {sign}{diff}</li>;
                        }
                        return null;
                    })
                    .filter((el): el is React.ReactElement => el !== null);
            }
        }

        const rarityColor = getRarityColor(itemToShow.rarity); // Keep using this for border/title color
        const rarityTextClass = getRarityClass(itemToShow.rarity).split(' ')[0]; // Extract text color class

        // Tailwind styled Tooltip
        return (
            <div
                className="fixed bg-gray-900 border-2 rounded shadow-lg p-3 text-sm z-[1000] pointer-events-none max-w-xs"
                style={{ left: itemTooltipPosition.x, top: itemTooltipPosition.y, borderColor: rarityColor }}
            >
                <h5 className={`font-bold mb-1 pb-1 border-b ${rarityTextClass}`} style={{ borderColor: rarityColor }}>{itemToShow.name}</h5>
                <p className="text-gray-400 italic mb-1">{itemToShow.type}{itemToShow.equipmentSlot ? ` (${itemToShow.equipmentSlot})` : ''}</p>
                <p className="text-gray-300 mb-2">{itemToShow.description}</p>
                {itemToShow.stats && Object.keys(itemToShow.stats).length > 0 && (
                    <>
                        <hr className="border-gray-600 my-1"/>
                        <h6 className="font-semibold text-gray-200 mb-1">Stats:</h6>
                        <ul className="list-none pl-2 space-y-0.5">
                            {Object.entries(itemToShow.stats).map(([stat, value]) => (
                                <li key={stat} className="text-blue-300">{stat}: +{value}</li>
                            ))}
                        </ul>
                    </>
                )}
                {isInventoryItem && isEquippable && (
                    <>
                        <hr className="border-gray-600 my-1"/>
                        <h6 className="font-semibold text-gray-200 mb-1">Comparison vs Equipped:</h6>
                        {comparisonElements.length > 0 ? (
                            <ul className="list-none pl-2 space-y-0.5">{comparisonElements}</ul>
                        ) : (
                            <p className="text-gray-500 italic">(No stat changes or slot empty)</p>
                        )}
                    </>
                )}
            </div>
        );
     };

    // --- Render Auto-Equip Tooltip ---
    const renderAutoEquipTooltip = () => {
        if (!hoveredAutoEquipStat) return null;

        // Tailwind styled Auto-Equip Tooltip
        return (
            <div
                className="fixed bg-gray-900 border border-gray-500 rounded shadow-lg p-3 text-xs z-[1000] pointer-events-none max-w-xs"
                style={{ left: autoEquipTooltipPosition.x, top: autoEquipTooltipPosition.y }}
            >
                <h6 className="font-semibold text-gray-200 mb-1 pb-1 border-b border-gray-600">Net Stat Changes:</h6>
                 {autoEquipTooltipContent.split('\n').map((line, index) => {
                     const parts = line.split(':');
                     const statName = parts[0];
                     const valueStr = parts[1]?.trim();
                     let value = NaN;
                     let colorClass = 'text-gray-300'; // Default color class

                     if (valueStr !== undefined) {
                         value = parseInt(valueStr, 10);
                         colorClass = isNaN(value) ? 'text-gray-300' : (value > 0 ? 'text-green-400' : 'text-red-400');
                     } else if (line === 'No changes') {
                         colorClass = 'text-gray-500 italic';
                     }

                     return <div key={index} className={colorClass}>{line}</div>;
                 })}
            </div>
        );
    };

    // Tailwind styled main panel layout - Reverted widths
    return (
        <div className="inventory-panel flex flex-col md:flex-row gap-4 p-2 h-full"> {/* Use full height passed by modal */}
            {/* Left Side: Inventory & Ground Loot - Reverted width */}
            <div className="inventory-main-area flex-grow md:w-2/3 flex flex-col">
                 {renderInventoryGrid()}
                 <div className="flex-shrink-0 mt-auto pt-2"> {/* Push ground loot down, add top padding */}
                    {renderGroundLoot()}
                 </div>
            </div>
             {/* Right Side: Equipment & Auto-Equip - Adjusted flex properties */}
            <div className="equipment-area flex-shrink-0 md:w-1/3 flex flex-col justify-between"> {/* Use justify-between */}
                {renderEquipmentSlots()}
                {/* Removed mt-auto wrapper, added direct margin */}
                <div className="mt-4">
                    {renderAutoEquipPanel()}
                </div>
            </div>
            {renderItemTooltip()}
            {renderAutoEquipTooltip()} {/* Render the new tooltip */}
        </div>
    );
};

export default InventoryPanel;
