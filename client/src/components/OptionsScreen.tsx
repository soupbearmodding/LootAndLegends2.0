import React, { useState } from 'react';
import { CharacterDataForClient } from '../types';

interface OptionsScreenProps {
    isOpen: boolean;
    onClose: () => void;
    character: CharacterDataForClient | null;
    sendWsMessage: (type: string, payload: any) => Promise<any>;
    onReturnToCharacterSelect: () => void;
    onLogout: () => void;
}

type ActiveTab = 'options' | 'saveLoad';

const OptionsScreen: React.FC<OptionsScreenProps> = ({
    isOpen,
    onClose,
    character,
    sendWsMessage,
    onReturnToCharacterSelect,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('saveLoad');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const showStatus = (message: string) => {
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(null), 4000); // Clear after 4 seconds
    };

    // --- Handlers for Save/Load ---
    const handleSaveDb = async () => {
        if (!character) return;
        showStatus('Saving to DB...');
        const result = await sendWsMessage('saveCharacter', { characterData: character });
        showStatus(result.success ? 'Character Saved (DB)' : `DB Save Failed: ${result.message || 'Unknown error'}`);
    };

    const handleLoadDb = () => {
        // Placeholder - A real DB load might involve re-selecting the character
        // or fetching the latest state if the server doesn't push updates automatically.
        console.log("Load (DB) clicked - Placeholder");
        showStatus('Load (DB) - Not Implemented');
    };


    // --- Render Logic ---
    const renderSaveLoadTab = () => {
        // Placeholder for save slots - for now, just show current character
        const saveSlot = character ? {
            id: character.id,
            name: character.name,
            level: character.level,
            // class: character.class, // Removed class reference as it's not in CharacterDataForClient
            saveTime: new Date().toLocaleString() // Placeholder time
        } : null;

        // Tailwind styled Save/Load tab
        const buttonBase = "py-2 px-4 rounded focus:outline-none focus:shadow-outline text-white font-bold text-sm";
        const buttonPrimary = `${buttonBase} bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`;
        const buttonSecondary = `${buttonBase} bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`;
        const buttonDanger = `${buttonBase} bg-red-600 hover:bg-red-700`;

        return (
            <div className="save-load-content space-y-4">
                <h4 className="text-lg font-semibold text-yellow-400">Save Slots</h4>
                {saveSlot ? (
                    <div className="bg-gray-700 p-3 rounded flex justify-between items-center">
                        <div className="save-info">
                            <span className="font-semibold block">{saveSlot.name} (Lvl {saveSlot.level})</span>
                            <span className="text-xs text-gray-400">Current Session</span>
                        </div>
                        <div className="save-actions space-x-2">
                            <button className={buttonPrimary} onClick={handleSaveDb} disabled={!!statusMessage}>Save (DB)</button>
                            <button className={buttonSecondary} onClick={handleLoadDb} disabled={true || !!statusMessage}>Load (DB)</button> {/* Load disabled for now */}
                        </div>
                    </div>
                ) : (
                    <p className="text-gray-400 italic">No character data available.</p>
                )}
                {/* Add logic here later to list multiple save files if needed */}
                <hr className="border-gray-600 my-4"/>
                <div className="options-general-actions flex justify-center space-x-4">
                     <button className={buttonSecondary} onClick={onReturnToCharacterSelect}>Return to Character Select</button>
                     <button className={buttonDanger} onClick={onLogout}>Logout</button>
                </div>
            </div>
        );
    };

    const renderOptionsTab = () => {
        // Tailwind styled Options tab
        return (
            <div className="options-content space-y-4">
                <h4 className="text-lg font-semibold text-yellow-400">Game Options</h4>
                <p className="text-gray-400 italic">Options settings (e.g., sound, graphics) not implemented yet.</p>
                {/* Add actual options controls here later */}
            </div>
        );
    };

    if (!isOpen) {
        return null;
    }

    // Tailwind styled Options Modal
    const tabBaseStyle = "flex-1 py-2 px-4 text-center text-gray-400 bg-gray-800 border-b-2 border-transparent hover:bg-gray-700 hover:text-gray-200 transition duration-150 ease-in-out focus:outline-none";
    const tabActiveStyle = "text-white font-semibold border-yellow-400 bg-gray-900";

    return (
        // Use Tailwind for overlay and modal container
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded shadow-xl p-4 max-w-lg w-full text-gray-200 relative flex flex-col" onClick={e => e.stopPropagation()}>
                <button className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl font-bold" onClick={onClose}>&times;</button>
                <div className="mb-4 text-center border-b border-gray-700 pb-2">
                    <h3 className="text-xl font-bold text-yellow-400">Game Menu</h3>
                </div>
                <div className="flex flex-shrink-0 border-b border-gray-700 mb-4"> {/* Tab buttons container */}
                    <button
                        className={`${tabBaseStyle} ${activeTab === 'saveLoad' ? tabActiveStyle : ''}`}
                        onClick={() => setActiveTab('saveLoad')}
                    >
                        Save / Load
                    </button>
                    <button
                        className={`${tabBaseStyle} ${activeTab === 'options' ? tabActiveStyle : ''}`}
                        onClick={() => setActiveTab('options')}
                    >
                        Options
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto mb-4"> {/* Tab content area */}
                    {activeTab === 'saveLoad' && renderSaveLoadTab()}
                    {activeTab === 'options' && renderOptionsTab()}
                </div>
                 {/* Status message styling */}
                 {statusMessage && <p className="text-center text-sm text-yellow-300 mt-auto h-4">{statusMessage}</p>}
            </div>
        </div>
    );
};

export default OptionsScreen;
