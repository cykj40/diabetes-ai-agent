'use client';

import { useEffect, useState } from 'react';
import { FiActivity } from 'react-icons/fi';

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
}

export default function DailyAverageReading() {
    const [averageValue, setAverageValue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<string>('');

    const fetchDailyAverage = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            const timestamp = new Date().toISOString();
            setLastAttempt(timestamp);
            console.log(`[${timestamp}] Fetching Dexcom readings for daily average...`);

            // Get readings for the last 24 hours
            const response = await fetch('http://localhost:3001/api/dexcom/readings?count=288', {
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
            console.log(`[${timestamp}] Received ${readings.length} glucose readings for daily average`);

            if (readings && readings.length > 0) {
                // Calculate average
                const sum = readings.reduce((acc, reading) => acc + reading.value, 0);
                const avg = Math.round(sum / readings.length);
                console.log(`[${timestamp}] Calculated daily average: ${avg} mg/dL`);
                setAverageValue(avg);
            } else {
                console.log(`[${timestamp}] No readings available for daily average`);
                setError('No readings available for daily average');
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error fetching daily average:`, err);
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        console.log('DailyAverageReading component mounted, fetching initial data...');
        fetchDailyAverage();
        const interval = setInterval(fetchDailyAverage, 3600000); // Refresh every hour

        return () => {
            console.log('DailyAverageReading component unmounting, clearing interval');
            clearInterval(interval);
        };
    }, []);

    // Helper function to get color based on glucose value
    const getValueColor = (value: number): string => {
        if (value < 70) return 'text-red-600'; // Low
        if (value > 180) return 'text-orange-600'; // High
        return 'text-green-600'; // In range
    };

    if (loading && averageValue === null) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Daily Average</h3>
                    <FiActivity className="text-green-600 text-xl" />
                </div>
                <div className="text-3xl font-bold text-gray-400">Loading...</div>
                <div className="text-sm text-gray-500 mt-2">Calculating average</div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Daily Average</h3>
                    <FiActivity className="text-green-600 text-xl" />
                </div>
                <div className="text-xl font-bold text-red-500">Error</div>
                <div className="text-sm text-red-400 mt-2">{error}</div>
                <div className="text-xs text-gray-400 mt-1">Last attempt: {lastAttempt}</div>
                <button
                    onClick={fetchDailyAverage}
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
                <h3 className="text-lg font-semibold text-gray-800">Daily Average</h3>
                <FiActivity className="text-green-600 text-xl" />
            </div>
            {averageValue !== null ? (
                <>
                    <div className={`text-3xl font-bold ${getValueColor(averageValue)}`}>
                        {averageValue} mg/dL
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                        Last 24 hours
                        {refreshing && <span className="ml-2 text-xs text-blue-500">(refreshing...)</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        Updated: {new Date(lastAttempt).toLocaleTimeString()}
                    </div>
                    <button
                        onClick={fetchDailyAverage}
                        className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                    >
                        Refresh
                    </button>
                </>
            ) : (
                <>
                    <div className="text-3xl font-bold text-gray-400">No data</div>
                    <div className="text-sm text-gray-500 mt-2">No readings available</div>
                    <button
                        onClick={fetchDailyAverage}
                        className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </>
            )}
        </div>
    );
} 