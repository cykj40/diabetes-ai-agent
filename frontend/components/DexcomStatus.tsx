'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

type ConnectionStatus = {
    share: 'connected' | 'disconnected' | 'loading';
};

type GlucoseReading = {
    value: number;
    trend: string;
    timestamp: string;
    source?: 'api' | 'share' | 'mock';
};

const DexcomStatus = () => {
    const [status, setStatus] = useState<ConnectionStatus>({
        share: 'loading'
    });
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showDirectAuth, setShowDirectAuth] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    useEffect(() => {
        const checkDexcomStatus = async () => {
            try {
                // Fetch current reading
                const reading = await api.dexcom.getCurrentReading() as GlucoseReading;

                // Check if we have a valid reading
                if (reading && (reading.source === 'share' || reading.source === 'api' || !reading.source)) {
                    setStatus({
                        share: 'connected'
                    });
                } else {
                    setStatus({
                        share: 'disconnected'
                    });
                }
            } catch (error) {
                console.error('Error checking Dexcom status:', error);
                setStatus({
                    share: 'disconnected'
                });
            }
        };

        // Check immediately
        checkDexcomStatus();
        
        // Poll every 30 seconds to keep status updated
        const interval = setInterval(checkDexcomStatus, 30000);
        
        // Cleanup interval on unmount
        return () => clearInterval(interval);
    }, []);


    const handleDirectAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAuthenticating(true);

        try {
            const response = await fetch('/api/dexcom/direct-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setStatus({ share: 'connected' });
                setShowDirectAuth(false);
                setUsername('');
                setPassword('');
                alert('Successfully connected to Dexcom!');
            } else {
                alert(`Failed to connect: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error during direct authentication:', error);
            alert('An error occurred while connecting to Dexcom. Please try again.');
        } finally {
            setIsAuthenticating(false);
        }
    };

    if (status.share === 'loading') {
        return <span className="text-gray-500 text-sm">Loading...</span>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${status.share === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                    {status.share === 'connected' ? 'Dexcom Connected' : 'Dexcom Not Connected'}
                </span>
            </div>
            
            {status.share !== 'connected' && !showDirectAuth ? (
                <div className="flex gap-1 mt-2">
                    <button
                        onClick={() => {
                            setIsRedirecting(true);
                            // Redirect directly to backend, bypassing frontend proxy
                            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                            window.location.href = `${backendUrl}/auth/dexcom/login`;
                        }}
                        disabled={isRedirecting}
                        className={`px-2 py-1 text-xs ${isRedirecting ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded transition-colors`}
                    >
                        {isRedirecting ? 'Redirecting...' : 'OAuth Login'}
                    </button>
                    <button
                        onClick={() => setShowDirectAuth(true)}
                        className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                    >
                        Direct Login
                    </button>
                </div>
            ) : (
                <form onSubmit={handleDirectAuth} className="mt-2 p-2 bg-gray-50 rounded border">
                    <div className="text-xs font-medium mb-2">Dexcom Share Login</div>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded mb-1"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded mb-2"
                        required
                    />
                    <div className="flex gap-1">
                        <button
                            type="submit"
                            disabled={isAuthenticating}
                            className={`px-2 py-1 text-xs ${isAuthenticating ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'} text-white rounded transition-colors`}
                        >
                            {isAuthenticating ? 'Connecting...' : 'Connect'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDirectAuth(false)}
                            className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default DexcomStatus; 