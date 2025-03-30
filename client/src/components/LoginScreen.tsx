import React, { useState } from 'react';

interface LoginScreenProps {
    onLogin: (username: string, password: string) => void;
    onRegister: (username: string, password: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [statusMessage, setStatusMessage] = useState(''); // For displaying errors or info

    const handleLoginClick = () => {
        if (!username || !password) {
            setStatusMessage('Username and password are required.');
            return;
        }
        setStatusMessage('Logging in...');
        onLogin(username, password);
        // Status message will be updated by App component based on server response
    };

    const handleRegisterClick = () => {
        if (!username || !password) {
            setStatusMessage('Username and password are required.');
            return;
        }
        if (password.length < 6) {
            setStatusMessage('Password must be at least 6 characters.');
            return;
        }
        setStatusMessage('Registering...');
        onRegister(username, password);
        // Status message will be updated by App component based on server response
    };

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); // Prevent default page reload
        handleLoginClick(); // Call the existing login logic
    };

    return (
        <div className="login-container"> {/* New top-level class */}
            <div className="game-title-large">
                <h1>LOOT & LEGENDS</h1>
            </div>

            <form className="login-form" onSubmit={handleFormSubmit}> {/* Class for form styling */}
                {/* Removed h2 title */}
                <div className="form-group"> {/* Group label and input */}
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                </div>
                <div className="form-actions"> {/* Group buttons */}
                    <button type="submit" className="button-primary">Login</button>
                    <button type="button" className="button-secondary" onClick={handleRegisterClick}>Register</button>
                </div>
                {/* Status message display */}
                <p className="auth-status" style={{ color: statusMessage.includes('failed') || statusMessage.includes('required') || statusMessage.includes('must be') ? 'lightcoral' : '#aaa' }}>
                    {statusMessage || '\u00A0'} {/* Use non-breaking space to maintain height */}
                </p>
            </form>
        </div>
    );
};

export default LoginScreen;
