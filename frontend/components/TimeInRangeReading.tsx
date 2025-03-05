'use client';

import { useEffect, useState } from 'react';
import { RiPulseLine } from 'react-icons/ri';

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
}

export default function TimeInRangeReading() {
    const [timeInRange, setTimeInRange] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<string>('');

    // Define the target range (70-180 mg/dL is standard)
    const lowerBound = 70;
    const upperBound = 180;

    const fetchTimeInRange = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            const timestamp = new Date().toISOString();
            setLastAttempt(timestamp);
            console.log(`[${timestamp}] Fetching Dexcom readings for time in range...`);

            // Get readings for the last 24 hours (288 readings at 5-minute intervals)
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
            console.log(`[${timestamp}] Received ${readings.length} glucose readings for time in range`);

            if (readings && readings.length > 0) {
                // Calculate time in range
                const inRangeCount = readings.filter(
                    reading => reading.value >= lowerBound && reading.value <= upperBound
                ).length;

                const percentage = Math.round((inRangeCount / readings.length) * 100);
                console.log(`[${timestamp}] Calculated time in range: ${percentage}%`);
                setTimeInRange(percentage);
            } else {
                console.log(`[${timestamp}] No readings available for time in range`);
                setError('No readings available for time in range');
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error fetching time in range:`, err);
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        console.log('TimeInRangeReading component mounted, fetching initial data...');
        fetchTimeInRange();
        const interval = setInterval(fetchTimeInRange, 3600000); // Refresh every hour

        return () => {
            console.log('TimeInRangeReading component unmounting, clearing interval');
            clearInterval(interval);
        };
    }, []);

    // Helper function to get color based on time in range
    const getValueColor = (percentage: number): string => {
        if (percentage < 50) return 'text-red-600'; // Poor control
        if (percentage < 70) return 'text-orange-600'; // Fair control
        return 'text-purple-600'; // Good control
    };

    if (loading && timeInRange === null) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Time in Range</h3>
                    <RiPulseLine className="text-purple-600 text-xl" />
                </div>
                <div className="text-3xl font-bold text-gray-400">Loading...</div>
                <div className="text-sm text-gray-500 mt-2">Calculating</div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Time in Range</h3>
                    <RiPulseLine className="text-purple-600 text-xl" />
                </div>
                <div className="text-xl font-bold text-red-500">Error</div>
                <div className="text-sm text-red-400 mt-2">{error}</div>
                <div className="text-xs text-gray-400 mt-1">Last attempt: {lastAttempt}</div>
                <button
                    onClick={fetchTimeInRange}
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
                <h3 className="text-lg font-semibold text-gray-800">Time in Range</h3>
                <RiPulseLine className="text-purple-600 text-xl" />
            </div>
            {timeInRange !== null ? (
                <>
                    <div className={`text-3xl font-bold ${getValueColor(timeInRange)}`}>
                        {timeInRange}%
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                        Target: {lowerBound}-{upperBound} mg/dL
                        {refreshing && <span className="ml-2 text-xs text-blue-500">(refreshing...)</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        Updated: {new Date(lastAttempt).toLocaleTimeString()}
                    </div>
                    <button
                        onClick={fetchTimeInRange}
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
                        onClick={fetchTimeInRange}
                        className="mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </>
            )}
        </div>
    );
} 