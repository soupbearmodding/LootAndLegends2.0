import React, { useState, useEffect, useMemo } from 'react';
import { CharacterDataForClient, Item, EquipmentSlot, Affix, ItemQuality } from '../types'; // Import needed types

// Define structure for recipe data received from server (align with server/src/craftingData.ts)
// Make sure this matches the CraftingRecipe interface in server/src/craftingData.ts
interface CraftingRecipeClient {
    id: string;
    name: string;
    description: string;
    cost: {
        gold?: number;
        monsterEssence?: number;
        scrapMetal?: number;
    };
    result: {
        type: 'item' | 'upgrade_random_affix'; // Use correct type from server
        baseId?: string;
        quantity?: number;
        // message?: string; // Not used by client directly for upgrade_random_affix
    };
    requiredLevel?: number;
    appliesToSlotType?: EquipmentSlot[]; // Added for upgrade recipes
}

interface CraftingPanelProps {
    character: CharacterDataForClient | null;
    availableRecipes: CraftingRecipeClient[]; // Recipes passed down from App state
    sendWsMessage: (type: string, payload: any) => void;
    requestRecipes: () => void; // Function to trigger recipe fetch in App
}

// Helper to get rarity color (duplicate from InventoryPanel, consider moving to utils)
const getRarityColor = (rarity?: string): string => {
    switch (rarity) {
        case 'magic': return '#6888ff';
        case 'rare': return '#ffff00';
        case 'unique': return '#a5694f';
        case 'legendary': return '#af00ff';
        case 'common': default: return '#ffffff';
    }
};


const CraftingPanel: React.FC<CraftingPanelProps> = ({
    character,
    availableRecipes,
    sendWsMessage,
    requestRecipes
}) => {
    const [activeTab, setActiveTab] = useState<'craft' | 'upgrade'>('craft');
    const [selectedItemForUpgrade, setSelectedItemForUpgrade] = useState<Item | null>(null);
    const [selectedAffixForUpgrade, setSelectedAffixForUpgrade] = useState<Affix | null>(null);
    const [selectedUpgradeRecipe, setSelectedUpgradeRecipe] = useState<CraftingRecipeClient | null>(null);

    // Filter recipes for display
    const itemCraftRecipes = useMemo(() => availableRecipes.filter(r => r.result.type === 'item'), [availableRecipes]);
    const upgradeRecipes = useMemo(() => availableRecipes.filter(r => r.result.type === 'upgrade_random_affix'), [availableRecipes]);

    // Request recipes when the panel mounts or character changes
    useEffect(() => {
        if (character) {
            requestRecipes();
        }
    }, [character, requestRecipes]);

    // Reset selections when tab changes or character data potentially changes
     useEffect(() => {
        setSelectedItemForUpgrade(null);
        setSelectedAffixForUpgrade(null);
        setSelectedUpgradeRecipe(null);
    }, [activeTab, character]);


    const handleCraftClick = (recipeId: string) => {
        console.log(`Attempting to craft recipe: ${recipeId}`);
        sendWsMessage('craft_item', { recipeId });
    };

    const handleUpgradeRecipeSelect = (recipe: CraftingRecipeClient) => {
        setSelectedUpgradeRecipe(recipe);
        setSelectedItemForUpgrade(null); // Clear selected item when recipe changes
        setSelectedAffixForUpgrade(null);
    };

    const handleItemSelectForUpgrade = (item: Item) => {
        setSelectedItemForUpgrade(item);
        setSelectedAffixForUpgrade(null); // Clear selected affix when item changes
    };

    const handleAffixSelectForUpgrade = (affix: Affix) => {
        // Basic check: only allow selecting if item is selected and affix is upgradeable (more checks later)
        if (selectedItemForUpgrade) {
            // TODO: Add client-side check if affix is max tier based on affixTiers data (needs to be available client-side)
            setSelectedAffixForUpgrade(affix);
        }
    };

     const handleUpgradeClick = () => {
        if (!selectedItemForUpgrade || !selectedUpgradeRecipe) return;

        // For Gray/White, affixId is null/undefined
        // For Magic/Rare, affixId must be selected
        const affixId = (selectedItemForUpgrade.quality === 'Green' || selectedItemForUpgrade.quality === 'Blue')
                        ? selectedAffixForUpgrade?.id
                        : null;

        if ((selectedItemForUpgrade.quality === 'Green' || selectedItemForUpgrade.quality === 'Blue') && !affixId) {
            console.warn("No affix selected for Magic/Rare item upgrade.");
            // TODO: Show UI feedback
            return;
        }

        console.log(`Attempting to upgrade item: ${selectedItemForUpgrade.id}, Affix: ${affixId}, Recipe: ${selectedUpgradeRecipe.id}`);
        // Send 'upgrade_item' message type to server
        sendWsMessage('upgrade_item', {
            itemId: selectedItemForUpgrade.id,
            affixId: affixId, // Will be null for Gray/White
            recipeId: selectedUpgradeRecipe.id
        });
    };


    // Helper to format resource costs
    const formatCost = (cost: CraftingRecipeClient['cost']): string => {
        const parts: string[] = [];
        if (cost.gold) parts.push(`${cost.gold} Gold`);
        if (cost.monsterEssence) parts.push(`${cost.monsterEssence} Essence`);
        if (cost.scrapMetal) parts.push(`${cost.scrapMetal} Scrap`);
        return parts.join(', ') || 'Free';
    };

    // Helper to check if character can afford the cost
    const canAfford = (cost: CraftingRecipeClient['cost']): boolean => {
        if (!character) return false;
        if ((cost.gold ?? 0) > (character.gold ?? 0)) return false;
        if ((cost.monsterEssence ?? 0) > (character.monsterEssence ?? 0)) return false;
        if ((cost.scrapMetal ?? 0) > (character.scrapMetal ?? 0)) return false;
        return true;
    };

    // --- Render Functions ---

    const renderCraftTab = () => (
        <>
            {itemCraftRecipes.length === 0 && <p className="text-gray-400 italic">No item crafting recipes available.</p>}
            <ul className="space-y-2"> {/* Use Tailwind for spacing */}
                {itemCraftRecipes.map((recipe) => {
                    const affordable = canAfford(recipe.cost);
                    return (
                        <li key={recipe.id} className={`flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded ${affordable ? '' : 'opacity-60'}`}>
                            <div className="recipe-info mr-4">
                                <strong className="block text-gray-100 mb-1">{recipe.name}</strong>
                                <p className="text-sm text-gray-400 mb-1">{recipe.description}</p>
                                <small className="text-xs text-gray-500">Cost: {formatCost(recipe.cost)}</small>
                            </div>
                            {/* Apply Tailwind classes to Craft button */}
                            <button
                                className={`px-4 py-2 rounded text-sm font-medium transition duration-150 ease-in-out ${affordable ? 'bg-yellow-600 hover:bg-yellow-500 text-black cursor-pointer' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                onClick={() => handleCraftClick(recipe.id)}
                                disabled={!affordable}
                                title={affordable ? `Craft ${recipe.name}` : 'Not enough resources'}
                            >
                                Craft
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );

    const renderUpgradeTab = () => {
        console.log("Rendering Upgrade Tab. Selected Recipe:", selectedUpgradeRecipe); // Log selected recipe
        console.log("Available Upgrade Recipes:", upgradeRecipes); // Log available upgrade recipes

        // Combine inventory and equipped items that are potentially upgradeable
        const allItems = [
            ...(character?.inventory || []),
            ...Object.values(character?.equipment || {}).filter((item): item is Item => !!item)
        ];

        // Filter items based on selected recipe's applicable slots and upgrade potential
        const upgradeableItems = allItems.filter(item => {
            if (!item || !selectedUpgradeRecipe?.appliesToSlotType) return false; // Need a recipe selected
            const maxUpgrades = item.maxUpgrades ?? 0;
            const currentUpgrades = item.upgradeCount ?? 0;
            return selectedUpgradeRecipe.appliesToSlotType.includes(item.equipmentSlot as EquipmentSlot) &&
                    currentUpgrades < maxUpgrades &&
                    (item.quality === 'Gray' || item.quality === 'White' || item.quality === 'Green' || item.quality === 'Blue');
        });
        console.log("Filtered Upgradeable Items (for selected recipe):", upgradeableItems); // Log filter result

        const selectedItemAffixes = selectedItemForUpgrade ? [...(selectedItemForUpgrade.prefixes || []), ...(selectedItemForUpgrade.suffixes || [])] : [];

        // Determine if the upgrade button should be enabled
        const canUpgrade = selectedUpgradeRecipe && selectedItemForUpgrade && canAfford(selectedUpgradeRecipe.cost) &&
                           ( (selectedItemForUpgrade.quality === 'Gray' || selectedItemForUpgrade.quality === 'White') || // Gray/White just need item selected
                             (selectedAffixForUpgrade) ); // Green/Blue need an affix selected

        return (
            <div className="upgrade-tab-content flex flex-col space-y-4"> {/* Use flex column and spacing */}
                {/* Recipe Selection */}
                <div className="upgrade-recipe-selection">
                    <h5 className="text-yellow-400 mb-2">Select Upgrade Recipe:</h5>
                    {upgradeRecipes.length === 0 && <p className="text-gray-400 italic">No upgrade recipes available.</p>}
                    <div className="flex flex-wrap gap-2"> {/* Wrap buttons */}
                        {upgradeRecipes.map(recipe => {
                             const affordable = canAfford(recipe.cost);
                             return (
                                <button
                                    key={recipe.id}
                                    className={`px-3 py-1 rounded text-sm border transition duration-150 ease-in-out ${selectedUpgradeRecipe?.id === recipe.id ? 'bg-yellow-600 border-yellow-500 text-black' : affordable ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500 text-gray-300' : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'}`}
                                    onClick={() => handleUpgradeRecipeSelect(recipe)}
                                    disabled={!affordable}
                                    title={affordable ? recipe.description : `Cannot afford: ${formatCost(recipe.cost)}`}
                                >
                                    {recipe.name}
                                </button>
                             );
                        })}
                    </div>
                </div>

                {/* Item Selection & Details */}
                {selectedUpgradeRecipe && (
                    <div className="upgrade-item-area flex gap-4 border-t border-gray-700 pt-4"> {/* Flex layout */}
                        {/* Item Selection List */}
                        <div className="upgrade-item-list flex-1 max-h-60 overflow-y-auto border border-gray-700 p-2 bg-gray-900 rounded"> {/* Style list */}
                            <h5 className="text-yellow-400 mb-2 text-sm">Select Item to Upgrade:</h5>
                            {upgradeableItems.length === 0 && <p className="text-gray-500 italic text-sm">No items match this recipe or are upgradeable.</p>}
                            <ul className="space-y-1"> {/* Spacing for items */}
                                {upgradeableItems.map(item => (
                                    <li
                                        key={item.id}
                                        onClick={() => handleItemSelectForUpgrade(item)}
                                        className={`p-1 rounded cursor-pointer text-sm truncate ${selectedItemForUpgrade?.id === item.id ? 'bg-gray-600 font-bold' : 'hover:bg-gray-700'}`}
                                        style={{ color: getRarityColor(item.rarity) }}
                                        title={item.name}
                                    >
                                        {item.name} ({item.upgradeCount ?? 0}/{item.maxUpgrades ?? 0})
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Item Details & Affix Selection */}
                        {selectedItemForUpgrade && (
                            <div className="upgrade-item-details flex-1 border border-gray-700 p-3 bg-gray-800 rounded"> {/* Style details */}
                                <h5 className="text-yellow-400 mb-1 text-base">{selectedItemForUpgrade.name} <span className="text-xs text-gray-400">({selectedItemForUpgrade.upgradeCount ?? 0}/{selectedItemForUpgrade.maxUpgrades ?? 0} Upgrades)</span></h5>
                                {/* Affix List */}
                                {(selectedItemForUpgrade.quality === 'Green' || selectedItemForUpgrade.quality === 'Blue') && (
                                    <div className="mt-2">
                                        <h6 className="text-sm text-gray-400 mb-1">Select Affix to Enhance:</h6>
                                        {selectedItemAffixes.length === 0 && <p className="text-xs text-gray-500 italic">(No affixes)</p>}
                                        <ul className="space-y-1 text-xs">
                                            {selectedItemAffixes.map(affix => {
                                                // TODO: Implement client-side check based on affixTiers data if available
                                                const isMaxTier = false;
                                                const isSelectable = !isMaxTier;
                                                return (
                                                    <li
                                                        key={affix.id}
                                                        onClick={() => isSelectable && handleAffixSelectForUpgrade(affix)}
                                                        className={`p-1 rounded ${selectedAffixForUpgrade?.id === affix.id ? 'bg-blue-800 text-white font-semibold' : isSelectable ? 'cursor-pointer hover:bg-gray-700 text-blue-300' : 'text-gray-500 cursor-not-allowed'}`}
                                                        title={isSelectable ? `Select ${affix.name}` : 'Affix cannot be upgraded further'}
                                                    >
                                                        {affix.name} ({affix.type})
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                                {/* Upgrade Button */}
                                <button
                                    className={`w-full mt-4 px-4 py-2 rounded text-sm font-medium transition duration-150 ease-in-out ${canUpgrade ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                    onClick={handleUpgradeClick}
                                    disabled={!canUpgrade}
                                    title={canUpgrade ? `Upgrade Item (Cost: ${formatCost(selectedUpgradeRecipe.cost)})` : 'Select item/affix or cannot afford'}
                                >
                                    {selectedItemForUpgrade.quality === 'Gray' || selectedItemForUpgrade.quality === 'White' ? 'Add Random Affix' : 'Upgrade Selected Affix'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Log activeTab value just before returning JSX
    console.log("CraftingPanel rendering, activeTab:", activeTab);

    // Define base and active styles for tabs using Tailwind
    const tabBaseStyle = "flex-grow py-2 px-4 text-center text-gray-400 bg-gray-800 border-b-2 border-transparent hover:bg-gray-700 hover:text-gray-200 transition duration-150 ease-in-out focus:outline-none";
    const tabActiveStyle = "text-white font-semibold border-yellow-400 bg-gray-900"; // Use slightly darker bg for active tab body

    return (
        // Apply Tailwind classes to the main container and tab structure
        <div className="flex flex-col h-full bg-gray-900 text-gray-300 rounded-lg shadow-lg"> {/* Use flex column, set height and background */}
            <div className="flex flex-shrink-0 border-b border-gray-700"> {/* Tab buttons container */}
                <button onClick={() => setActiveTab('craft')} className={`${tabBaseStyle} ${activeTab === 'craft' ? tabActiveStyle : ''}`}>
                    Craft Items
                </button>
                <button onClick={() => setActiveTab('upgrade')} className={`${tabBaseStyle} ${activeTab === 'upgrade' ? tabActiveStyle : ''}`}>
                    Upgrade Items
                </button>
            </div>
            <div className="flex-grow overflow-y-auto p-4"> {/* Tab content area */}
                {activeTab === 'craft' && renderCraftTab()}
                {activeTab === 'upgrade' && renderUpgradeTab()}
            </div>
        </div>
    );
};

export default CraftingPanel;
