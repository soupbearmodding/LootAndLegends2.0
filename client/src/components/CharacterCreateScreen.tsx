import React, { useState, useEffect } from 'react';

// Define necessary types locally to avoid cross-directory import issues
interface CharacterStats {
    strength: number;
    dexterity: number;
    vitality: number;
    energy: number;
}

interface CharacterClass {
    name: string;
    description: string;
    baseStats: CharacterStats;
}
// End local type definitions

interface CharacterCreateScreenProps {
    characterClasses: Map<string, CharacterClass>; // Use the locally defined type
    onCreateCharacter: (name: string, classId: string) => void;
    onBack: () => void; // Function to go back to the previous screen (e.g., Main Menu)
}

const CharacterCreateScreen: React.FC<CharacterCreateScreenProps> = ({
    characterClasses,
    onCreateCharacter,
    onBack
}) => {
    const [characterName, setCharacterName] = useState('');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [classesArray, setClassesArray] = useState<[string, CharacterClass][]>([]);

    // Convert Map to Array for easier rendering
    useEffect(() => {
        setClassesArray(Array.from(characterClasses.entries()));
    }, [characterClasses]);

    const handleCreateCharacter = () => {
        if (characterName.trim() && selectedClassId) {
            onCreateCharacter(characterName.trim(), selectedClassId);
        }
    };

    const isCreateDisabled = !characterName.trim() || !selectedClassId;

    return (
        <div className="character-create-container">
            <div className="game-title-large">
                <h1>CHOOSE YOUR CLASS</h1>
            </div>

            <div className="creation-form">
                <div className="name-input-section">
                    <label htmlFor="characterName">Character Name:</label>
                    <input
                        type="text"
                        id="characterName"
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        placeholder="Enter name..."
                        maxLength={20} // Example max length
                    />
                </div>

                <div className="class-selection-grid">
                    {classesArray.map(([classId, charClass]) => (
                        <div
                            key={classId}
                            className={`class-card ${selectedClassId === classId ? 'selected' : ''}`}
                            onClick={() => setSelectedClassId(classId)}
                        >
                            <h4>{charClass.name}</h4>
                            <p className="class-description">{charClass.description}</p>
                            <div className="class-stats">
                                <p>Strength: {charClass.baseStats.strength}</p>
                                <p>Dexterity: {charClass.baseStats.dexterity}</p>
                                <p>Vitality: {charClass.baseStats.vitality}</p>
                                <p>Energy: {charClass.baseStats.energy}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="creation-actions">
                    <button className="button-secondary" onClick={onBack}>Back</button>
                    <button
                        className="button-primary"
                        onClick={handleCreateCharacter}
                        disabled={isCreateDisabled}
                    >
                        Create Character
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CharacterCreateScreen;
