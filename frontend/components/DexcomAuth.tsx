'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface DexcomAuthProps {
    onAuthSuccess?: () => void;
}

export default function DexcomAuth({ onAuthSuccess }: DexcomAuthProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Handle the OAuth callback
    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (code && state) {
            handleAuthCallback(code, state);
        }
    }, [searchParams]);

    const handleAuthCallback = async (code: string, state: string) => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/dexcom/auth/callback', {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to authenticate with Dexcom');
            }

            onAuthSuccess?.();
            router.push('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnect = () => {
        window.location.href = '/api/dexcom/auth';
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800">Connect Your Dexcom</h2>

            {error && (
                <div className="w-full p-4 text-red-700 bg-red-100 rounded-md">
                    {error}
                </div>
            )}

            <button
                onClick={handleConnect}
                disabled={isLoading}
                className={`
          px-6 py-2 text-white bg-blue-600 rounded-md
          hover:bg-blue-700 transition-colors
          disabled:bg-blue-300 disabled:cursor-not-allowed
        `}
            >
                {isLoading ? 'Connecting...' : 'Connect to Dexcom'}
            </button>

            <p className="text-sm text-gray-600 text-center">
                By connecting your Dexcom account, you'll be able to view your glucose data directly in our app.
            </p>
        </div>
    );
} 