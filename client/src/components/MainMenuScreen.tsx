import React from 'react';

interface MainMenuScreenProps {
    onNewGame: () => void;
    onLoadGame: () => void;
    onOptions: () => void;
    onLogout: () => void;
    onExitGame: () => void;
}

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
    onNewGame,
    onLoadGame,
    onOptions,
    onLogout,
    onExitGame
}) => {
    // Basic Tailwind styling example
    const buttonBase = "w-full py-2 px-4 rounded focus:outline-none focus:shadow-outline text-white font-bold";
    const buttonPrimary = `${buttonBase} bg-blue-500 hover:bg-blue-700`;
    const buttonSecondary = `${buttonBase} bg-gray-600 hover:bg-gray-700`;
    const buttonDisabled = `${buttonBase} bg-gray-400 cursor-not-allowed`;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-200 p-4">
            <div className="mb-12">
                <h1 className="text-6xl font-bold text-yellow-400">LOOT & LEGENDS</h1>
            </div>
            <div className="flex flex-col space-y-4 w-full max-w-xs">
                <button className={buttonPrimary} onClick={onNewGame}>New Game</button>
                <button className={buttonPrimary} onClick={onLoadGame}>Load Game</button>
                <button className={buttonDisabled} onClick={onOptions} disabled>Options</button>
                <button className={buttonSecondary} onClick={onLogout}>Logout</button>
                <button className={buttonDisabled} onClick={onExitGame} disabled>Exit Game</button>
            </div>
        </div>
    );
};

export default MainMenuScreen;
