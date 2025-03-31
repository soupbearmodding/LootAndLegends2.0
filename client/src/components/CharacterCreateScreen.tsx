import React, { useState, useEffect } from 'react';
import { CharacterClass } from '../types'; // Corrected import path

// Local interfaces CharacterStats and CharacterClass removed

interface CharacterCreateScreenProps {
    characterClasses: Map<string, CharacterClass>; // Uses imported CharacterClass
    onCreateCharacter: (name: string, classId: string) => void;
    onBack: () => void; 
}

const CharacterCreateScreen: React.FC<CharacterCreateScreenProps> = ({
    characterClasses,
    onCreateCharacter,
    onBack
}) => {
    const [characterName, setCharacterName] = useState('');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [classesArray, setClassesArray] = useState<[string, CharacterClass][]>([]);

    
    useEffect(() => {
        setClassesArray(Array.from(characterClasses.entries()));
    }, [characterClasses]);

    const handleCreateCharacter = () => {
        if (characterName.trim() && selectedClassId) {
            onCreateCharacter(characterName.trim(), selectedClassId);
        }
    };

    const isCreateDisabled = !characterName.trim() || !selectedClassId;

    // Basic Tailwind styling example
    const buttonBase = "py-2 px-4 rounded focus:outline-none focus:shadow-outline text-white font-bold";
    const buttonPrimary = `${buttonBase} bg-green-600 hover:bg-green-700`;
    const buttonSecondary = `${buttonBase} bg-gray-600 hover:bg-gray-700`;
    const buttonDisabled = `${buttonBase} bg-gray-400 cursor-not-allowed`;

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-gray-200 p-4 pt-12"> {/* Added padding-top */}
            <div className="mb-8">
                <h1 className="text-5xl font-bold text-yellow-400">CHOOSE YOUR CLASS</h1>
            </div>

            <div className="w-full max-w-4xl mb-6"> {/* Wider container */}
                <div className="mb-6 text-center"> {/* Center name input */}
                    <label htmlFor="characterName" className="block text-lg font-bold mb-2">Character Name:</label>
                    <input
                        className="shadow appearance-none border rounded w-full max-w-xs py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-300 mx-auto" // Centered input
                        type="text"
                        id="characterName"
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        placeholder="Enter name..."
                        maxLength={20}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"> {/* Responsive grid */}
                    {classesArray.map(([classId, charClass]) => (
                        <div
                            key={classId}
                            className={`bg-gray-800 p-4 rounded shadow-md cursor-pointer border-2 ${selectedClassId === classId ? 'border-yellow-400' : 'border-gray-700 hover:border-gray-600'}`}
                            onClick={() => setSelectedClassId(classId)}
                        >
                            <h4 className="text-xl font-semibold mb-2 text-center">{charClass.name}</h4>
                            <p className="text-sm text-gray-400 mb-3 text-center">{charClass.description}</p>
                            <div className="text-xs text-gray-300 grid grid-cols-2 gap-x-4"> {/* Smaller text, grid for stats */}
                                <p>STR: {charClass.baseStats.strength}</p>
                                <p>DEX: {charClass.baseStats.dexterity}</p>
                                <p>VIT: {charClass.baseStats.vitality}</p>
                                <p>ENE: {charClass.baseStats.energy}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-center space-x-4"> {/* Centered buttons */}
                    <button className={buttonSecondary} onClick={onBack}>Back</button>
                    <button
                        className={isCreateDisabled ? buttonDisabled : buttonPrimary}
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
