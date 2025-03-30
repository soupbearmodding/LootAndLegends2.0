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
    return (
        <div className="main-menu-container">
            <div className="game-title-large">
                <h1>LOOT & LEGENDS</h1>
            </div>
            <div className="menu-buttons">
                <button onClick={onNewGame}>New Game</button>
                <button onClick={onLoadGame}>Load Game</button>
                <button onClick={onOptions} disabled>Options</button>
                <button onClick={onLogout}>Logout</button>
                <button onClick={onExitGame} disabled>Exit Game</button>
            </div>
        </div>
    );
};

export default MainMenuScreen;
