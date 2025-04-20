'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DirectDexcomLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus('Authenticating with Dexcom...');
        setIsError(false);

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
                setStatus('Authentication successful! Redirecting...');
                // Clear form
                setUsername('');
                setPassword('');

                // Redirect after a short delay
                setTimeout(() => {
                    router.push('/dashboard');
                }, 1500);
            } else {
                setIsError(true);
                setStatus(`Authentication failed: ${data.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            setIsError(true);
            setStatus('An error occurred while authenticating. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Direct Dexcom Login</h1>

            <div className="bg-white p-6 rounded-lg shadow max-w-md mx-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                            Dexcom Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Dexcom Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Authenticating...' : 'Login with Dexcom'}
                    </button>
                </form>

                {status && (
                    <div className={`mt-4 p-3 rounded-md ${isError ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                        {status}
                    </div>
                )}

                <div className="mt-6 text-center">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-blue-500 hover:underline"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
} 