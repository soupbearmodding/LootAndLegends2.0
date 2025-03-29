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
        <div className="auth-container">
            <h2>Login or Register</h2>
            {/* Wrap inputs and login button in a form */}
            <form id="login-form" onSubmit={handleFormSubmit}>
                <label htmlFor="username">Username:</label>
                <input
                    type="text"
                    id="username"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                /><br /><br />
                <label htmlFor="password">Password:</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                /><br /><br />
                {/* Change Login button type to submit */}
                <button type="submit" id="login-button">Login</button>
                {/* Keep Register button as type="button" */}
                <button type="button" id="register-button" onClick={handleRegisterClick}>Register</button>
                {/* Status message display */}
                <p id="auth-status" style={{ color: statusMessage.includes('failed') || statusMessage.includes('required') || statusMessage.includes('must be') ? 'lightcoral' : '#aaa' }}>
                    {statusMessage || '\u00A0'} {/* Use non-breaking space to maintain height */}
                </p>
            </form> {/* Close the form */}
        </div>
    );
};

export default LoginScreen;
