import React, { useState } from 'react';

interface CharacterSelectScreenProps {
    username: string | null;
    characters: any[]; // Consider defining a proper Character type later
    onSelect: (characterId: string) => void;
    onCreate: (name: string, classId: string) => void;
    onLogout: () => void;
}

const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
    username,
    characters,
    onSelect,
    onCreate,
    onLogout
}) => {
    const [charName, setCharName] = useState('');
    const [charClass, setCharClass] = useState('warrior'); // Default class
    const [createStatus, setCreateStatus] = useState('');

    const handleCreateClick = () => {
        const name = charName.trim();
        if (!name || name.length < 3 || name.length > 16) {
            setCreateStatus('Invalid character name (3-16 chars).');
            return;
        }
        if (!charClass) {
            setCreateStatus('Please select a class.');
            return;
        }
        setCreateStatus('Creating character...');
        onCreate(name, charClass);
        // Status will be updated by App component based on server response
        // Optionally clear form fields here or on success message from App
        // setCharName('');
        // setCharClass('warrior');
    };

    return (
        <div className="auth-container"> {/* Reusing auth-container styling */}
            <div id="character-screen">
                <h2>Welcome, {username || 'Player'}!</h2>

                <div id="character-list">
                    <h3>Select Character</h3>
                    {characters.length > 0 ? (
                        <ul>
                            {characters.map(c => {
                                const className = c.class?.name || 'Unknown Class';
                                const level = c.level || 1;
                                return (
                                    <li key={c.id}>
                                        <span>{c.name} ({className}) - Lvl {level}</span>
                                        <button
                                            data-char-id={c.id}
                                            className="select-char-button"
                                            onClick={() => onSelect(c.id)}
                                        >
                                            Select
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p>No characters found.</p>
                    )}
                </div>

                <hr />

                <div id="create-char-form">
                    <h3>Create New Character</h3>
                    <div>
                        <label htmlFor="char-name">Name:</label>
                        <input
                            type="text"
                            id="char-name"
                            name="char-name"
                            value={charName}
                            onChange={(e) => setCharName(e.target.value)}
                            required
                            minLength={3}
                            maxLength={16}
                        />
                    </div>
                    <div>
                        <label htmlFor="char-class">Class:</label>
                        <select
                            id="char-class"
                            name="char-class"
                            value={charClass}
                            onChange={(e) => setCharClass(e.target.value)}
                        >
                            {/* TODO: Fetch class list from game data instead of hardcoding */}
                            <option value="warrior">Warrior</option>
                            <option value="rogue">Rogue</option>
                            <option value="sorcerer">Sorcerer</option>
                            <option value="monk">Monk</option>
                            <option value="barbarian">Barbarian</option>
                        </select>
                    </div>
                    <div>
                        <button id="create-char-button" onClick={handleCreateClick}>
                            Create Character
                        </button>
                    </div>
                    <p id="create-char-status" style={{ color: createStatus.includes('Invalid') || createStatus.includes('Please select') ? 'lightcoral' : '#aaa' }}>
                        {createStatus || '\u00A0'}
                    </p>
                </div>

                <button id="logout-button" onClick={onLogout}>Logout</button>
            </div>
        </div>
    );
};

export default CharacterSelectScreen;
