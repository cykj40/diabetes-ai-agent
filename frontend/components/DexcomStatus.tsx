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

        checkDexcomStatus();
    }, []);

    const handleRefreshDexcom = () => {
        setIsRedirecting(true);
        // Use the existing API route that properly handles OAuth flow
        window.location.href = '/api/dexcom/auth';
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
            <button
                onClick={handleRefreshDexcom}
                disabled={isRedirecting}
                className={`mt-2 px-2 py-1 text-xs ${isRedirecting ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded transition-colors`}
            >
                {isRedirecting ? 'Redirecting...' : 'Reconnect Dexcom'}
            </button>
        </div>
    );
};

export default DexcomStatus; 