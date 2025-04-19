'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const DexcomStatus = () => {
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');

    useEffect(() => {
        const checkDexcomStatus = async () => {
            try {
                // Try to fetch the current Dexcom reading as a way to check connection
                await api.dexcom.getCurrentReading();
                setStatus('connected');
            } catch (error) {
                console.error('Error checking Dexcom status:', error);
                setStatus('disconnected');
            }
        };

        checkDexcomStatus();
    }, []);

    if (status === 'loading') {
        return <span className="text-gray-500 text-sm">Loading...</span>;
    }

    return (
        <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500">
                {status === 'connected' ? 'Connected to Dexcom' : 'Dexcom Not Connected'}
            </span>
        </div>
    );
};

export default DexcomStatus; 