'use client';

import { useEffect, useState } from 'react';

interface PatternInsight {
    color: string;
    text: string;
}

export default function WeeklyPatterns() {
    const [insights, setInsights] = useState<PatternInsight[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<string>('');

    const fetchWeeklyPatterns = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            const timestamp = new Date().toISOString();
            setLastAttempt(timestamp);
            console.log(`[${timestamp}] Fetching weekly blood sugar patterns...`);

            const response = await fetch('http://localhost:3001/api/dexcom/weekly-data', {
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

            const data = await response.json();
            console.log(`[${timestamp}] Received weekly data:`, data);

            if (data && data.insights && data.insights.length > 0) {
                // Map insights to our format with colors
                const colorMap = ['bg-green-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500'];

                const formattedInsights = data.insights.slice(0, 5).map((text: string, index: number) => ({
                    color: colorMap[index % colorMap.length],
                    text
                }));

                setInsights(formattedInsights);
            } else {
                // If no insights are available, create some default ones based on common patterns
                setInsights([
                    { color: 'bg-gray-400', text: 'Not enough data to generate insights' }
                ]);
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error fetching weekly patterns:`, err);
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        console.log('WeeklyPatterns component mounted, fetching initial data...');
        fetchWeeklyPatterns();
        const interval = setInterval(fetchWeeklyPatterns, 86400000); // Refresh every 24 hours

        return () => {
            console.log('WeeklyPatterns component unmounting, clearing interval');
            clearInterval(interval);
        };
    }, []);

    if (loading && insights.length === 0) {
        return (
            <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Weekly Patterns</h2>
                <div className="flex items-center justify-center h-32">
                    <div className="text-gray-400">Loading patterns...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Weekly Patterns</h2>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <div className="text-red-800 font-medium">Error loading patterns</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                    <button
                        onClick={fetchWeeklyPatterns}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Weekly Patterns</h2>
                {refreshing && <span className="text-xs text-blue-500">Refreshing...</span>}
            </div>

            <div className="space-y-4">
                {insights.map((insight, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${insight.color}`}></div>
                        <span className="text-gray-600">{insight.text}</span>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                <span>Updated: {new Date(lastAttempt).toLocaleString()}</span>
                <button
                    onClick={fetchWeeklyPatterns}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
} 