'use client';

import { useEffect, useState } from 'react';
import { BsGraphUp } from 'react-icons/bs';
import ClientOnly from './ClientOnly';
import { format } from 'date-fns';

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
    isDelayed?: boolean; // Flag to indicate if the reading is significantly delayed
    source?: 'api' | 'share' | 'mock'; // Source of the reading
}

// Trend Arrow Component
function TrendArrow({ trend }: { trend: string }) {
    const getArrow = (trend: string) => {
        switch (trend.toLowerCase()) {
            case 'rising rapidly':
            case 'doubleup':
                return '↑↑';
            case 'rising':
            case 'singleup':
                return '↑';
            case 'rising slightly':
            case 'fortyFiveUp':
            case 'fortyfiveup':
                return '↗';
            case 'flat':
                return '→';
            case 'falling slightly':
            case 'fortyFiveDown':
            case 'fortyfivedown':
                return '↘';
            case 'falling':
            case 'singledown':
                return '↓';
            case 'falling rapidly':
            case 'doubledown':
                return '↓↓';
            default:
                return '?';
        }
    };

    return (
        <span className="text-xl font-bold">{getArrow(trend)}</span>
    );
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
                return 'Rising Rapidly';
            case 'rising':
            case 'singleup':
                return 'Rising';
            case 'rising slightly':
            case 'fortyFiveUp':
            case 'fortyfiveup':
                return 'Rising Slightly';
            case 'flat':
                return 'Stable';
            case 'falling slightly':
            case 'fortyFiveDown':
            case 'fortyfivedown':
                return 'Falling Slightly';
            case 'falling':
            case 'singledown':
                return 'Falling';
            case 'falling rapidly':
            case 'doubledown':
                return 'Falling Rapidly';
            case 'none':
            case 'notcomputable':
            case 'rateoutofrange':
                return 'Unknown';
            default:
                return 'Unknown Trend';
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
            <div className="relative">
                {refreshing && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                        <span className="text-blue-500">Refreshing...</span>
                    </div>
                )}

                <div className="flex flex-col items-center p-4">
                    <div className="flex justify-between w-full">
                        <h2 className="text-lg font-semibold flex items-center">
                            <BsGraphUp className="w-5 h-5 mr-2" /> Current Glucose
                        </h2>
                        <button
                            onClick={fetchCurrentReading}
                            className="text-xs text-blue-500 hover:text-blue-700"
                            aria-label="Refresh glucose reading"
                        >
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : error ? (
                        <div className="p-4 mt-4 text-red-700 bg-red-100 rounded-md">
                            <p>{error}</p>
                            <button
                                onClick={fetchCurrentReading}
                                className="mt-2 px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : currentReading ? (
                        <div className="flex flex-col items-center mt-4">
                            <div className="text-5xl font-bold text-blue-600">
                                {currentReading.value}
                                <span className="text-xl ml-1 text-gray-500">mg/dL</span>
                            </div>

                            <div className="mt-2 flex items-center">
                                <TrendArrow trend={currentReading.trend} />
                                <span className="ml-2 text-sm text-gray-600">{getTrendText(currentReading.trend)}</span>
                            </div>

                            {/* Data source indicator */}
                            <div className="mt-2 text-xs text-gray-500 flex items-center">
                                <span className={`w-2 h-2 rounded-full mr-1 ${currentReading.source === 'share' ? 'bg-green-500' : currentReading.source === 'api' ? 'bg-blue-500' : 'bg-gray-500'}`}></span>
                                {currentReading.source === 'share'
                                    ? 'Dexcom Share (Real-time)'
                                    : currentReading.source === 'api'
                                        ? 'Dexcom Clarity API'
                                        : currentReading.source === 'mock'
                                            ? 'Demo Data'
                                            : 'Unknown Source'}
                            </div>

                            <div className="text-sm text-gray-500 mt-1">
                                {format(new Date(currentReading.timestamp), 'h:mm a')}
                                {dataAge !== null && dataAge > 5 && (
                                    <span className={`ml-2 ${dataAge > 20 ? 'text-red-500' : 'text-amber-500'}`}>
                                        ({dataAge} min old)
                                    </span>
                                )}
                            </div>

                            {currentReading.isDelayed && (
                                <div className="mt-1 text-xs text-amber-500">
                                    * Data may be delayed up to 3 hours
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 mt-4 text-amber-700 bg-amber-50 rounded-md">
                            No current reading available.
                        </div>
                    )}
                </div>
            </div>
        </ClientOnly>
    );
} 