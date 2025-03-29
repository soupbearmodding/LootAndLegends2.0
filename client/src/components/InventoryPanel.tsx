import React, { useState } from 'react'; // Ensure React is imported

// TODO: Refactor types into a shared location (e.g., ../../server/src/types)
// --- Duplicated Types (Temporary) ---
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

// Correct type definition matching server/src/types.ts
type EquipmentSlots = {
    [key in EquipmentSlot]?: Item; // Optional because a slot might be empty
};

interface CharacterData {
    inventory: Item[];
    equipment: EquipmentSlots;
    stats: ItemStats; // Assuming base character stats structure
    // Add other relevant character fields if needed for comparison
}
// --- End Duplicated Types ---


interface InventoryPanelProps {
    character: CharacterData | null;
    onEquipItem: (itemId: string) => void; // Function to call when equipping
    onUnequipItem: (slot: EquipmentSlot) => void; // Function to call when unequipping
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ character, onEquipItem, onUnequipItem }) => {
    const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    if (!character) {
        return <p>Loading character data...</p>;
    }

    const handleMouseEnter = (item: Item, event: React.MouseEvent) => {
        setHoveredItem(item);
        setTooltipPosition({ x: event.clientX + 15, y: event.clientY + 15 }); // Position tooltip slightly offset from cursor
    };

    const handleMouseLeave = () => {
        setHoveredItem(null);
    };

    const renderInventoryGrid = () => {
        // Simple list for now, grid layout later
        return (
            <div className="inventory-grid">
                <h4>Inventory</h4>
                <ul>
                    {character.inventory.map(item => (
                        <li
                            key={item.id}
                            onMouseEnter={(e) => handleMouseEnter(item, e)}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => item.equipmentSlot && onEquipItem(item.id)} // Equip on click if equippable
                            style={{ cursor: item.equipmentSlot ? 'pointer' : 'default' }} // Change cursor if equippable
                            title={item.equipmentSlot ? 'Click to equip' : 'Cannot equip'}
                        >
                            {item.name} {item.quantity && item.quantity > 1 ? `(${item.quantity})` : ''}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderEquipmentSlots = () => {
        const slots: EquipmentSlot[] = ['head', 'chest', 'legs', 'feet', 'mainHand', 'offHand', 'amulet', 'ring1', 'ring2'];
        return (
            <div className="equipment-slots">
                <h4>Equipped</h4>
                <ul>
                    {slots.map(slot => {
                        const item = character.equipment[slot];
                        return (
                            <li
                                key={slot}
                                onMouseEnter={(e) => item ? handleMouseEnter(item, e) : undefined}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => item && onUnequipItem(slot)} // Unequip on click if item exists
                                style={{ cursor: item ? 'pointer' : 'default' }} // Change cursor if item exists
                                title={item ? 'Click to unequip' : 'Slot empty'}
                            >
                                <strong>{slot}:</strong> {item ? item.name : '(Empty)'}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    const renderTooltip = () => {
        if (!hoveredItem) return null;

        const isInventoryItem = character.inventory.some(invItem => invItem.id === hoveredItem.id);
        const isEquippable = !!hoveredItem.equipmentSlot;
        let comparisonElements: (React.ReactNode | null)[] = [];

        // --- Stat Comparison Logic ---
        if (isInventoryItem && isEquippable && hoveredItem.equipmentSlot) {
            const currentItem = character.equipment[hoveredItem.equipmentSlot];
            const hoveredStats = hoveredItem.stats || {};
            const currentStats = currentItem?.stats || {};
            const allStatKeys = new Set([...Object.keys(hoveredStats), ...Object.keys(currentStats)]) as Set<keyof ItemStats>;

            comparisonElements = Array.from(allStatKeys).map(stat => {
                const hoveredValue = hoveredStats[stat] || 0;
                const currentValue = currentStats[stat] || 0;
                const diff = hoveredValue - currentValue;

                if (diff !== 0) {
                    const sign = diff > 0 ? '+' : '';
                    const color = diff > 0 ? 'lightgreen' : 'salmon';
                    return <li key={stat} style={{ color }}>{stat}: {sign}{diff}</li>;
                }
                return null; // Don't show stats with no difference
            }); // Keep the map, filter happens implicitly when rendering or can be done later if needed
            // Filter nulls before rendering
            const validComparisonElements = comparisonElements.filter(el => el !== null);
        }
        // --- End Stat Comparison Logic ---


        return (
            <div
                className="item-tooltip"
                style={{ position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y, border: '1px solid #ccc', background: '#333', color: '#fff', padding: '10px', borderRadius: '4px', zIndex: 1000 }}
            >
                <h5>{hoveredItem.name}</h5>
                <p><em>{hoveredItem.type}{hoveredItem.equipmentSlot ? ` (${hoveredItem.equipmentSlot})` : ''}</em></p>
                <p>{hoveredItem.description}</p>
                {hoveredItem.stats && Object.keys(hoveredItem.stats).length > 0 && (
                    <>
                        <hr />
                        <h6>Stats:</h6>
                        <ul>
                            {Object.entries(hoveredItem.stats).map(([stat, value]) => (
                                <li key={stat}>{stat}: +{value}</li>
                            ))}
                        </ul>
                    </>
                )}
                 {/* TODO: Add stat comparison display */}
                 {isInventoryItem && isEquippable && (
                    <>
                        <hr />
                         <h6>Comparison vs Equipped:</h6>
                         {comparisonElements.filter(el => el !== null).length > 0 ? ( // Filter nulls here for the check and render
                             <ul>{comparisonElements.filter(el => el !== null)}</ul>
                         ) : (
                             <p>(No stat changes or slot empty)</p>
                         )}
                     </>
                 )}
            </div>
        );
    };

    return (
        <div className="inventory-panel">
            {renderEquipmentSlots()}
            {renderInventoryGrid()}
            {renderTooltip()}
        </div>
    );
};

export default InventoryPanel;
