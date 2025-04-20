'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RefreshDexcomPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const router = useRouter();

    const checkAuthStatus = async () => {
        setIsLoading(true);
        setStatus('Checking Dexcom authentication status...');

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/auth/dexcom/status`);
            const data = await response.json();

            setStatus(`Authentication status: ${data.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}`);
        } catch (error) {
            console.error('Error checking auth status:', error);
            setStatus('Error checking authentication status');
        } finally {
            setIsLoading(false);
        }
    };

    const refreshAuth = async () => {
        setIsLoading(true);
        setStatus('Refreshing Dexcom authentication...');

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/auth/dexcom/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            setStatus(`Refresh result: ${data.success ? 'Success' : 'Failed'}`);
        } catch (error) {
            console.error('Error refreshing token:', error);
            setStatus('Error refreshing authentication token');
        } finally {
            setIsLoading(false);
        }
    };

    const reauthorize = () => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        window.location.href = `${backendUrl}/auth/dexcom/login`;
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Dexcom Authentication</h1>

            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <div className="flex flex-col gap-4">
                    <button
                        onClick={checkAuthStatus}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
                    >
                        Check Authentication Status
                    </button>

                    <button
                        onClick={refreshAuth}
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
                    >
                        Refresh Authentication Token
                    </button>

                    <button
                        onClick={reauthorize}
                        disabled={isLoading}
                        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-purple-300"
                    >
                        Full Reauthorization
                    </button>
                </div>

                {status && (
                    <div className="mt-4 p-4 border rounded bg-gray-50">
                        <p className="text-sm text-gray-700">{status}</p>
                    </div>
                )}

                <div className="mt-6">
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