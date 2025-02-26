'use client';

import { useEffect, useState } from 'react';
import { FiActivity } from 'react-icons/fi';

export default function DexcomStatus() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check Dexcom authentication status
        console.log('Checking Dexcom auth status...');
        fetch('http://localhost:3001/auth/dexcom/status', {
            credentials: 'include', // Important for session cookies
            headers: {
                'Accept': 'application/json'
            }
        })
            .then(res => {
                console.log('Status response:', res.status);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log('Auth status data:', data);
                setIsAuthenticated(data.isAuthenticated);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error checking Dexcom auth status:', err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const handleDexcomLogin = () => {
        window.location.href = 'http://localhost:3001/auth/dexcom/login';
    };

    if (loading) {
        return (
            <div className="flex items-center space-x-2">
                <FiActivity className="animate-spin" />
                <span>Checking connection...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center space-x-2 text-red-600">
                <span>Error: {error}</span>
                <button
                    onClick={() => window.location.reload()}
                    className="text-blue-600 hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                    {isAuthenticated ? 'Dexcom Connected' : 'Dexcom Disconnected'}
                </span>
            </div>
            {!isAuthenticated && (
                <button
                    onClick={handleDexcomLogin}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Connect Dexcom
                </button>
            )}
        </div>
    );
} 