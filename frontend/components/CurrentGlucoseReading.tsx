'use client';

import { useEffect, useState } from 'react';
import { BsGraphUp } from 'react-icons/bs';
import ClientOnly from './ClientOnly';

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
    isDelayed?: boolean; // Flag to indicate if the reading is significantly delayed
    source?: 'api' | 'share' | 'mock'; // Source of the reading
}

export default function CurrentGlucoseReading() {
    const [currentReading, setCurrentReading] = useState<GlucoseReading | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<string>('');
    const [dataAge, setDataAge] = useState<number | null>(null); // Age of data in minutes

    const fetchCurrentReading = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            const timestamp = new Date().toISOString();
            setLastAttempt(timestamp);
            console.log(`[${timestamp}] Fetching current Dexcom reading...`);

            // Use our API utility to fetch the reading
            import('../lib/api').then(async ({ api }) => {
                try {
                    const data = await api.dexcom.getCurrentReading() as {
                        value: number;
                        trend: string;
                        timestamp: string;
                        source?: 'api' | 'share' | 'mock';
                    };

                    console.log(`[${timestamp}] Current reading:`, data);

                    // Validate the reading data
                    if (!data || typeof data.value !== 'number' || !data.trend || !data.timestamp) {
                        console.error('Invalid reading data:', data);
                        setError('Received invalid glucose reading data');
                        setCurrentReading(null);
                        return;
                    }

                    // Calculate how old the data is
                    const readingTime = new Date(data.timestamp).getTime();
                    const currentTime = new Date().getTime();
                    const ageInMinutes = Math.round((currentTime - readingTime) / (60 * 1000));
                    setDataAge(ageInMinutes);

                    // Flag as delayed if more than 15 minutes old (Dexcom API has a delay)
                    const isDelayed = ageInMinutes > 15;

                    // Format the reading data
                    const reading: GlucoseReading = {
                        value: data.value,
                        trend: data.trend,
                        timestamp: data.timestamp,
                        isDelayed,
                        source: data.source
                    };

                    // Update the current reading
                    setCurrentReading(reading);
                } catch (apiError) {
                    console.error('Error fetching current reading:', apiError);
                    setError(apiError instanceof Error ? apiError.message : 'An unknown error occurred');
                } finally {
                    setLoading(false);
                    setRefreshing(false);
                }
            }).catch(importError => {
                console.error('Error importing API module:', importError);
                setError('Failed to load API utilities');
                setLoading(false);
                setRefreshing(false);
            });
        } catch (error) {
            console.error('Error fetching current reading:', error);
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchCurrentReading();

        // Set up auto-refresh every 5 minutes (Dexcom readings are taken every 5 minutes)
        const intervalId = setInterval(fetchCurrentReading, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, []);

    // Helper functions for trend and color
    function getTrendText(trend: string): string {
        switch (trend.toLowerCase()) {
            case 'rising rapidly':
            case 'doubleup':
                return '↑↑ Rising Rapidly';
            case 'rising':
            case 'singleup':
                return '↑ Rising';
            case 'rising slightly':
            case 'fortyFiveUp':
            case 'fortyfiveup':
                return '↗ Rising Slightly';
            case 'flat':
                return '→ Stable';
            case 'falling slightly':
            case 'fortyFiveDown':
            case 'fortyfivedown':
                return '↘ Falling Slightly';
            case 'falling':
            case 'singledown':
                return '↓ Falling';
            case 'falling rapidly':
            case 'doubledown':
                return '↓↓ Falling Rapidly';
            case 'none':
            case 'notcomputable':
            case 'rateoutofrange':
                return '? Unknown';
            default:
                return '→ Unknown Trend';
        }
    }

    // Helper function to get color based on glucose value
    const getValueColor = (value: number): string => {
        if (value < 70) return 'text-red-600'; // Low
        if (value > 180) return 'text-orange-600'; // High
        return 'text-blue-600'; // In range
    };

    return (
        <ClientOnly fallback={<div className="p-4 bg-white rounded-lg shadow-md animate-pulse h-32"></div>}>
            <div className="p-4 bg-white rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold flex items-center">
                        <BsGraphUp className="mr-2" /> Current Glucose
                    </h2>
                    <button
                        onClick={() => fetchCurrentReading()}
                        disabled={refreshing}
                        className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-400"
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-16">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-center py-2">{error}</div>
                ) : currentReading ? (
                    <div className="flex flex-col items-center">
                        <div className="flex items-baseline">
                            <span className={`text-3xl font-bold ${getValueColor(currentReading.value)}`}>
                                {currentReading.value}
                            </span>
                            <span className="ml-1 text-gray-500">mg/dL</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {getTrendText(currentReading.trend)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            {new Date(currentReading.timestamp).toLocaleTimeString()}
                        </div>
                        {dataAge !== null && (
                            <div className={`text-xs mt-1 ${dataAge > 15 ? 'text-amber-500' : 'text-gray-500'}`}>
                                {dataAge > 60 ? `${Math.floor(dataAge / 60)}h ${dataAge % 60}m old` : `${dataAge}m old`}
                                {currentReading.isDelayed && ' (delayed)'}
                            </div>
                        )}
                        {currentReading.source && (
                            <div className="text-xs text-gray-400 mt-1">
                                Source: {currentReading.source === 'share' ? 'Dexcom Share (real-time)' :
                                    currentReading.source === 'api' ? 'Dexcom API' :
                                        'Mock data'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-gray-500 text-center py-2">No data available</div>
                )}

                {lastAttempt && (
                    <div className="text-xs text-gray-400 mt-2 text-right">
                        Last updated: {new Date(lastAttempt).toLocaleTimeString()}
                    </div>
                )}
            </div>
        </ClientOnly>
    );
} 