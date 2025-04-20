'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

type ConnectionStatus = {
    clarity: 'connected' | 'disconnected' | 'loading';
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
        clarity: 'loading',
        share: 'loading'
    });

    useEffect(() => {
        const checkDexcomStatus = async () => {
            try {
                // Fetch current reading - this will check both sources
                const reading = await api.dexcom.getCurrentReading() as GlucoseReading;

                // Check which API source returned the data
                if (reading && reading.source) {
                    if (reading.source === 'share') {
                        setStatus({
                            clarity: 'disconnected',
                            share: 'connected'
                        });
                    } else if (reading.source === 'api') {
                        setStatus({
                            clarity: 'connected',
                            share: 'disconnected'
                        });
                    } else {
                        // If source is 'mock', both are disconnected
                        setStatus({
                            clarity: 'disconnected',
                            share: 'disconnected'
                        });
                    }
                } else if (reading) {
                    // If source is not specified but we have a reading, assume Share is connected
                    setStatus({
                        clarity: 'disconnected',
                        share: 'connected'
                    });
                } else {
                    // No reading available
                    setStatus({
                        clarity: 'disconnected',
                        share: 'disconnected'
                    });
                }
            } catch (error) {
                console.error('Error checking Dexcom status:', error);
                setStatus({
                    clarity: 'disconnected',
                    share: 'disconnected'
                });
            }
        };

        checkDexcomStatus();
    }, []);

    if (status.clarity === 'loading' && status.share === 'loading') {
        return <span className="text-gray-500 text-sm">Loading...</span>;
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${status.clarity === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                    {status.clarity === 'connected' ? 'Dexcom Clarity Connected' : 'Dexcom Clarity Not Connected'}
                </span>
            </div>
            <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${status.share === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-xs text-gray-500">
                    {status.share === 'connected' ? 'Dexcom Share Connected' : 'Dexcom Share Not Connected'}
                </span>
            </div>
        </div>
    );
};

export default DexcomStatus; 