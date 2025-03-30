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
    const getRarityClass = (rarity?: string): string => {
        switch (rarity) {
            case 'magic': return 'rarity-magic';
            case 'rare': return 'rarity-rare';
            case 'unique': return 'rarity-unique';
            case 'legendary': return 'rarity-legendary';
            case 'common': default: return 'rarity-common';
        }
    };
    const getRarityColor = (rarity?: string): string => {
        switch (rarity) {
            case 'magic': return '#6888ff';
            case 'rare': return '#ffff00';
            case 'unique': return '#a5694f';
            case 'legendary': return '#af00ff';
            case 'common': default: return '#ffffff';
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
        const gridSize = 150;
        const gridItems: (Item | null)[] = Array(gridSize).fill(null);
        const itemsToDisplay = character?.inventory.filter(item => item.baseId !== 'gold_coins') || [];
        itemsToDisplay.forEach((item, index) => {
            if (index < gridSize) { gridItems[index] = item; }
        });
        const goldAmount = character?.gold ?? 0;

        return (
            <div className="inventory-grid-container">
                <div className="inventory-header">
                    <h4>Inventory</h4>
                    <div className="gold-display">Gold: {goldAmount}</div>
                </div>
                <div className="inventory-grid">
                    {gridItems.map((item, index) => (
                        <div
                            key={item ? item.id : `empty-${index}`}
                            className={`inventory-grid-item ${item ? getRarityClass(item.rarity) : ''}`}
                            onMouseEnter={(e) => item && handleItemMouseEnter(item, e)}
                            onMouseLeave={handleItemMouseLeave}
                            onClick={() => item && item.equipmentSlot && onEquipItem(item.id)}
                            onContextMenu={(e) => {
                                if (item) {
                                    e.preventDefault();
                                    setHoveredItem(null);
                                    onSellItem(item.id);
                                }
                            }}
                            style={{ cursor: item ? 'pointer' : 'default' }}
                        >
                            {item ? getItemShorthand(item.baseName || item.name) : ''}
                            {item && item.quantity && item.quantity > 1 && (
                                <span className="item-quantity">{item.quantity}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
     };

    const renderGroundLoot = () => {
        const groundItems = character?.groundLoot ?? [];
        return (
            <div className="ground-loot-container">
                <h4>Ground Loot (Last 10)</h4>
                <ul className="ground-loot-list">
                    {groundItems.length === 0 && <li className="ground-loot-empty">Nothing on the ground.</li>}
                    {groundItems.map(item => (
                        <li
                            key={item.id}
                            className="ground-loot-item"
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
        return (
            <div className="equipment-slots-container">
                <h4>Equipped</h4>
                <ul>
                    {slots.map(slot => {
                        const item = Object.prototype.hasOwnProperty.call(character.equipment, slot)
                            ? character.equipment[slot]
                            : undefined;
                        return (
                            <li
                                key={slot}
                                onMouseEnter={(e) => item && handleItemMouseEnter(item, e)}
                                onMouseLeave={handleItemMouseLeave}
                                onClick={() => item && onUnequipItem(slot)}
                                style={{ cursor: item ? 'pointer' : 'default' }}
                                title={item ? `Unequip ${item.name}` : 'Slot empty'}
                            >
                                <strong>{slot}:</strong> {item ? <span style={{ color: getRarityColor(item.rarity) }}>{item.name}</span> : '(Empty)'}
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

        return (
            <div className="auto-equip-container panel-section"> {/* Reuse panel-section style */}
                <h4>Auto Equip Best Stats</h4>
                <div className="auto-equip-buttons">
                    {statsToEquip.map(stat => (
                        <button
                            key={stat}
                            className="button-secondary auto-equip-button"
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

        const rarityColor = getRarityColor(itemToShow.rarity);

        return (
            <div className="item-tooltip" style={{ position: 'fixed', left: itemTooltipPosition.x, top: itemTooltipPosition.y, border: `2px solid ${rarityColor}`, background: '#333', color: rarityColor, padding: '10px', borderRadius: '4px', zIndex: 1000, minWidth: '200px', pointerEvents: 'none' }}>
                <h5 style={{ color: rarityColor, margin: '0 0 5px 0', borderBottom: `1px solid ${rarityColor}` }}>{itemToShow.name}</h5>
                <p style={{ color: '#fff', margin: '5px 0' }}><em>{itemToShow.type}{itemToShow.equipmentSlot ? ` (${itemToShow.equipmentSlot})` : ''}</em></p>
                <p style={{ color: '#fff', margin: '5px 0' }}>{itemToShow.description}</p>
                {itemToShow.stats && Object.keys(itemToShow.stats).length > 0 && (
                    <> <hr style={{ borderColor: rarityColor, opacity: 0.5 }}/> <h6 style={{ color: '#fff', margin: '5px 0' }}>Stats:</h6> <ul style={{ color: '#fff', listStyle: 'none', paddingLeft: '10px', margin: '5px 0' }}> {Object.entries(itemToShow.stats).map(([stat, value]) => ( <li key={stat} style={{ color: '#68c7ff' }}>{stat}: +{value}</li> ))} </ul> </>
                )}
                {isInventoryItem && isEquippable && (
                    <> <hr style={{ borderColor: rarityColor, opacity: 0.5 }}/> <h6 style={{ color: '#fff', margin: '5px 0' }}>Comparison vs Equipped:</h6> {comparisonElements.length > 0 ? ( <ul style={{ listStyle: 'none', paddingLeft: '10px', margin: '5px 0' }}>{comparisonElements}</ul> ) : ( <p style={{ color: '#aaa', margin: '5px 0' }}>(No stat changes or slot empty)</p> )} </>
                )}
            </div>
        );
     };

    // --- Render Auto-Equip Tooltip ---
    const renderAutoEquipTooltip = () => {
        if (!hoveredAutoEquipStat) return null;

        // Simple text display using pre-wrap to handle newlines
        return (
            <div className="auto-equip-tooltip" style={{ position: 'fixed', left: autoEquipTooltipPosition.x, top: autoEquipTooltipPosition.y, background: '#333', color: '#fff', border: '1px solid #ccc', padding: '10px', borderRadius: '4px', zIndex: 1000, whiteSpace: 'pre-wrap', pointerEvents: 'none' }}>
                <h6 style={{ margin: '0 0 5px 0', borderBottom: '1px solid #ccc' }}>Net Stat Changes:</h6>
                 {autoEquipTooltipContent.split('\n').map((line, index) => {
                     const parts = line.split(':');
                     const statName = parts[0];
                     const valueStr = parts[1] ? parts[1].trim() : undefined; // Check if parts[1] exists
                     let value = NaN;
                     let color = '#fff'; // Default color

                     if (valueStr !== undefined) {
                         value = parseInt(valueStr, 10);
                         color = isNaN(value) ? '#fff' : (value > 0 ? 'lightgreen' : 'salmon');
                     } else if (line === 'No changes') {
                         color = '#aaa'; // Grey out "No changes"
                     }

                     return <div key={index} style={{ color }}>{line}</div>;
                 })}
            </div>
        );
    };


    return (
        <div className="inventory-panel">
            <div className="inventory-main-area">
                 {renderInventoryGrid()}
                 {renderGroundLoot()}
            </div>
            <div className="equipment-area">
                {renderEquipmentSlots()}
                {/* Replace potion slots with auto-equip panel */}
                {renderAutoEquipPanel()}
            </div>
            {renderItemTooltip()}
            {renderAutoEquipTooltip()} {/* Render the new tooltip */}
        </div>
    );
};

export default InventoryPanel;
