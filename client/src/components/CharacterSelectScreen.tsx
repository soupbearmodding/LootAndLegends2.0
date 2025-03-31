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
    // Basic Tailwind styling example
    const buttonBase = "py-1 px-3 rounded focus:outline-none focus:shadow-outline text-white font-bold text-sm";
    const buttonPrimary = `${buttonBase} bg-blue-500 hover:bg-blue-700`;
    const buttonDanger = `${buttonBase} bg-red-600 hover:bg-red-700`;
    const buttonSecondary = `${buttonBase} bg-gray-600 hover:bg-gray-700`;

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-gray-200 p-4 pt-12"> {/* Added padding-top */}
            <div className="mb-8">
                <h1 className="text-5xl font-bold text-yellow-400">LOAD GAME</h1>
            </div>

            <div className="w-full max-w-md mb-6"> {/* Container for the list */}
                {characters.length > 0 ? (
                    <ul className="bg-gray-800 rounded shadow-md overflow-hidden">
                        {characters.map(c => (
                            <li key={c.id} className="flex items-center justify-between p-3 border-b border-gray-700 last:border-b-0">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-lg">{c.name}</span>
                                    <span className="text-sm text-gray-400">Lvl {c.level} {c.class}</span>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        className={buttonPrimary}
                                        onClick={() => onSelect(c.id)}
                                    >
                                        Load
                                    </button>
                                    <button
                                        className={buttonDanger}
                                        onClick={() => onDelete(c.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-400 mt-6">No characters found. Go back to create one!</p>
                )}
            </div>

            <div className="mt-auto pb-4"> {/* Push button to bottom */}
                <button className={buttonSecondary} onClick={onBack}>Back</button>
            </div>
        </div>
    );
};

export default CharacterSelectScreen;
