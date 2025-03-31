import React, { useState } from 'react';
import { CharacterDataForClient } from '../types'; // Import character type

interface OptionsScreenProps {
    isOpen: boolean;
    onClose: () => void;
    character: CharacterDataForClient | null;
    sendWsMessage: (type: string, payload: any) => Promise<any>;
    onReturnToCharacterSelect: () => void;
    onLogout: () => void;
    // Removed onCharacterDataLoaded prop
}

type ActiveTab = 'options' | 'saveLoad';

const OptionsScreen: React.FC<OptionsScreenProps> = ({
    isOpen,
    onClose,
    character,
    sendWsMessage,
    onReturnToCharacterSelect,
    onLogout
    // Removed onCharacterDataLoaded from destructuring
}) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('saveLoad'); // Defaulting to saveLoad for now
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

    // Removed handleSaveJson and handleLoadJson functions

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

        return (
            <div className="save-load-content">
                <h4>Save Slots</h4>
                {saveSlot ? (
                    <div className="save-slot current">
                        <div className="save-info">
                            {/* Removed class display */}
                            <span className="save-name">{saveSlot.name} (Lvl {saveSlot.level})</span>
                            <span className="save-time">Current Session</span>
                            {/* <span className="save-time">Saved: {saveSlot.saveTime}</span> */}
                        </div>
                        <div className="save-actions">
                            <button onClick={handleSaveDb} disabled={!!statusMessage}>Save (DB)</button>
                            <button onClick={handleLoadDb} disabled={!!statusMessage}>Load (DB)</button>
                            {/* Removed JSON buttons */}
                        </div>
                    </div>
                ) : (
                    <p>No character data available.</p>
                )}
                {/* Add logic here later to list multiple save files if needed */}
                <hr />
                <div className="options-general-actions">
                     <button onClick={onReturnToCharacterSelect}>Return to Character Select</button>
                     <button onClick={onLogout}>Logout</button>
                </div>
            </div>
        );
    };

    const renderOptionsTab = () => {
        return (
            <div className="options-content">
                <h4>Game Options</h4>
                <p>Options settings (e.g., sound, graphics) not implemented yet.</p>
                {/* Add actual options controls here later */}
            </div>
        );
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content options-screen-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose}>&times;</button>
                <div className="options-screen-header">
                    <h3>Game Menu</h3>
                </div>
                <div className="options-screen-tabs">
                    <button
                        className={`tab-button ${activeTab === 'saveLoad' ? 'active' : ''}`}
                        onClick={() => setActiveTab('saveLoad')}
                    >
                        Save / Load
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'options' ? 'active' : ''}`}
                        onClick={() => setActiveTab('options')}
                    >
                        Options
                    </button>
                </div>
                <div className="options-screen-content">
                    {activeTab === 'saveLoad' && renderSaveLoadTab()}
                    {activeTab === 'options' && renderOptionsTab()}
                </div>
                 {statusMessage && <p className="options-status-message">{statusMessage}</p>}
            </div>
        </div>
    );
};

export default OptionsScreen;
