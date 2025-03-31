import React, { useState } from 'react';

interface LoginScreenProps {
    onLogin: (username: string, password: string) => void;
    onRegister: (username: string, password: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    const handleLoginClick = () => {
        if (!username || !password) {
            setStatusMessage('Username and password are required.');
            return;
        }
        setStatusMessage('Logging in...');
        onLogin(username, password);
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
    };

    const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleLoginClick();
    };

    // Basic Tailwind styling example
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-200 p-4">
            <div className="mb-8">
                <h1 className="text-5xl font-bold text-yellow-400">LOOT & LEGENDS</h1>
            </div>

            <form className="bg-gray-800 p-6 rounded shadow-md w-full max-w-sm" onSubmit={handleFormSubmit}>
                <div className="mb-4">
                    <label htmlFor="username" className="block text-sm font-bold mb-2">Username:</label>
                    <input
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-300"
                        type="text"
                        id="username"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                    />
                </div>
                <div className="mb-6">
                    <label htmlFor="password" className="block text-sm font-bold mb-2">Password:</label>
                    <input
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline bg-gray-300"
                        type="password"
                        id="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                </div>
                <div className="flex items-center justify-between mb-4 space-x-2"> {/* Allow wrapping */}
                    <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">Login</button>
                    <button type="button" className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" onClick={handleRegisterClick}>Register</button>
                    {/* Skip Login Button Removed */}
                </div>
                <p className={`text-center text-sm h-4 ${statusMessage.includes('failed') || statusMessage.includes('required') || statusMessage.includes('must be') ? 'text-red-400' : 'text-gray-400'}`}>
                    {statusMessage || '\u00A0'} {/* Use non-breaking space to maintain height */}
                </p>
            </form>
        </div>
    );
};

export default LoginScreen;
