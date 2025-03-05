'use client';

import { useEffect, useState } from 'react';
import { BsGraphUp } from 'react-icons/bs';

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
}

export default function CurrentGlucoseReading() {
    const [currentReading, setCurrentReading] = useState<GlucoseReading | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<string>('');

    const fetchCurrentReading = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            const timestamp = new Date().toISOString();
            setLastAttempt(timestamp);
            console.log(`[${timestamp}] Fetching current Dexcom reading...`);

            const response = await fetch('http://localhost:3001/api/dexcom/readings?count=1', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            console.log(`[${timestamp}] Response status:`, response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Please connect your Dexcom account to view blood sugar data.');
                } else {
                    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
                }
            }

            const readings: GlucoseReading[] = await response.json();
            console.log(`[${timestamp}] Received glucose readings:`, readings);

            if (readings && readings.length > 0) {
                console.log(`[${timestamp}] Setting current reading:`, readings[0]);
                setCurrentReading(readings[0]);
            } else {
                console.log(`[${timestamp}] No readings available`);
                setError('No recent readings available');
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error fetching current reading:`, err);
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        console.log('CurrentGlucoseReading component mounted, fetching initial data...');
        fetchCurrentReading();
        const interval = setInterval(fetchCurrentReading, 300000); // Refresh every 5 minutes

        return () => {
            console.log('CurrentGlucoseReading component unmounting, clearing interval');
            clearInterval(interval);
        };
    }, []);

    // Helper function to get trend direction text
    const getTrendText = (trend: string): string => {
        // Normalize the trend value to handle both Dexcom API and mock data formats
        const normalizedTrend = trend.toUpperCase();

        // Log the trend value to help with debugging
        console.log('Trend value:', trend, 'Normalized:', normalizedTrend);

        // Handle Dexcom API trend values
        switch (normalizedTrend) {
            case 'DOUBLE_UP':
            case 'RISING RAPIDLY':
                return 'Rising rapidly';

            case 'SINGLE_UP':
            case 'RISING':
                return 'Rising';

            case 'FORTY_FIVE_UP':
            case 'RISING SLOWLY':
                return 'Rising slowly';

            case 'FLAT':
            case 'STABLE':
                return 'Stable';

            case 'FORTY_FIVE_DOWN':
            case 'FALLING SLOWLY':
                return 'Falling slowly';

            case 'SINGLE_DOWN':
            case 'FALLING':
                return 'Falling';

            case 'DOUBLE_DOWN':
            case 'FALLING RAPIDLY':
                return 'Falling rapidly';

            default:
                return `${trend} (unknown trend)`;
        }
    };

    // Helper function to get color based on glucose value
    const getValueColor = (value: number): string => {
        if (value < 70) return 'text-red-600'; // Low
        if (value > 180) return 'text-orange-600'; // High
        return 'text-blue-600'; // In range
    };

    if (loading && !currentReading) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Current Reading</h3>
                    <BsGraphUp className="text-blue-600 text-xl" />
                </div>
                <div className="text-3xl font-bold text-gray-400">Loading...</div>
                <div className="text-sm text-gray-500 mt-2">Fetching data</div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Current Reading</h3>
                    <BsGraphUp className="text-blue-600 text-xl" />
                </div>
                <div className="text-xl font-bold text-red-500">Error</div>
                <div className="text-sm text-red-400 mt-2">{error}</div>
                <div className="text-xs text-gray-400 mt-1">Last attempt: {lastAttempt}</div>
                <button
                    onClick={fetchCurrentReading}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Current Reading</h3>
                <BsGraphUp className="text-blue-600 text-xl" />
            </div>
            {currentReading ? (
                <>
                    <div className={`text-3xl font-bold ${getValueColor(currentReading.value)}`}>
                        {currentReading.value} mg/dL
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                        {getTrendText(currentReading.trend)}
                        {refreshing && <span className="ml-2 text-xs text-blue-500">(refreshing...)</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        Updated: {new Date(currentReading.timestamp).toLocaleTimeString()}
                    </div>
                    <button
                        onClick={fetchCurrentReading}
                        className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                    >
                        Refresh
                    </button>
                </>
            ) : (
                <>
                    <div className="text-3xl font-bold text-gray-400">No data</div>
                    <div className="text-sm text-gray-500 mt-2">No recent readings available</div>
                    <div className="text-xs text-gray-400 mt-1">Last attempt: {lastAttempt}</div>
                    <button
                        onClick={fetchCurrentReading}
                        className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </>
            )}
        </div>
    );
} 