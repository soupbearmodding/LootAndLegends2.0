import React from 'react';

interface CharacterSummary {
    id: string;
    name: string;
    class: string;
    level: number;
}

interface CharacterSelectScreenProps {
    characters: CharacterSummary[];
    onSelect: (characterId: string) => void;
    onDelete: (characterId: string) => void;
    onBack: () => void;
}

const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
    characters,
    onSelect,
    onDelete,
    onBack
}) => {

    return (
        <div className="character-select-container">
            <div className="game-title-large">
                <h1>LOAD GAME</h1>
            </div>

            <div id="character-list-section">
                {characters.length > 0 ? (
                    <ul className="character-select-list">
                        {characters.map(c => (
                            <li key={c.id} className="character-list-item">
                                <div className="character-info">
                                    <span className="char-name">{c.name}</span>
                                    <span className="char-details">Lvl {c.level} {c.class}</span>
                                </div>
                                <div className="character-actions">
                                    <button
                                        className="button-primary"
                                        onClick={() => onSelect(c.id)}
                                    >
                                        Load
                                    </button>
                                    <button
                                        className="button-danger"
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


            <div className="navigation-actions">
                <button className="button-secondary" onClick={onBack}>Back</button>
            </div>
        </div>
    );
};

export default CharacterSelectScreen;
