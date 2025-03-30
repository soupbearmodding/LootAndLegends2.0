import React from 'react';

// Define a basic type for the character list locally
interface CharacterSummary {
    id: string;
    name: string;
    class: string; // Assuming class is just a string ID/name here
    level: number;
}

interface CharacterSelectScreenProps {
    characters: CharacterSummary[];
    onSelect: (characterId: string) => void;
    onDelete: (characterId: string) => void; // Add delete handler prop
    onBack: () => void; // Add back handler prop
}

const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
    characters,
    onSelect,
    onDelete,
    onBack
}) => {

    return (
        <div className="character-select-container"> {/* Use a new specific class */}
            <div className="game-title-large">
                <h1>LOAD GAME</h1> {/* Updated title */}
            </div>

            <div id="character-list-section"> {/* Wrapper for the list */}
                {characters.length > 0 ? (
                    <ul className="character-select-list"> {/* Use a specific class for styling */}
                        {characters.map(c => (
                            <li key={c.id} className="character-list-item">
                                <div className="character-info">
                                    <span className="char-name">{c.name}</span>
                                    <span className="char-details">Lvl {c.level} {c.class}</span> {/* Simplified details */}
                                </div>
                                <div className="character-actions">
                                    <button
                                        className="button-primary" // Style as primary action
                                        onClick={() => onSelect(c.id)}
                                    >
                                        Load
                                    </button>
                                    <button
                                        className="button-danger" // Style for delete action
                                        onClick={() => onDelete(c.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="no-characters-message">No characters found. Go back to create one!</p>
                )}
            </div>

            {/* Removed character creation form */}

            <div className="navigation-actions"> {/* Wrapper for back button */}
                <button className="button-secondary" onClick={onBack}>Back</button> {/* Back button */}
            </div>
        </div>
    );
};

export default CharacterSelectScreen;
