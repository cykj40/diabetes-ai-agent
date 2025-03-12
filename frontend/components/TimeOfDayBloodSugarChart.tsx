'use client';

import { useEffect, useState } from 'react';
import BloodSugarCharts from './BloodSugarCharts';
import { FiRefreshCw } from 'react-icons/fi';

interface TimeOfDayData {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
}

export default function TimeOfDayBloodSugarChart() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<TimeOfDayData | null>(null);
    const [insights, setInsights] = useState<string[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchTimeOfDayData();
    }, []);

    const fetchTimeOfDayData = async () => {
        try {
            setLoading(true);
            setError(null);
            setRefreshing(true);

            console.log('Fetching time of day blood sugar data...');
            // Fetch weekly data first
            const response = await fetch('http://localhost:3001/api/dexcom/weekly-data', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setError('Please connect your Dexcom account to view blood sugar data.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return;
            }

            const weeklyData = await response.json();
            console.log('Weekly data received for time of day analysis:', weeklyData);

            // Extract time of day insights
            const timeInsights = weeklyData.insights.filter((insight: string) =>
                insight.includes('Morning') ||
                insight.includes('Afternoon') ||
                insight.includes('Evening') ||
                insight.includes('Night')
            );

            setInsights(timeInsights);
            console.log('Time of day insights:', timeInsights);

            // Extract time of day averages from insights
            const morningAvg = extractAverage(timeInsights, 'Morning');
            const afternoonAvg = extractAverage(timeInsights, 'Afternoon');
            const eveningAvg = extractAverage(timeInsights, 'Evening');
            const nightAvg = extractAverage(timeInsights, 'Night');

            console.log('Time of day averages:', { morningAvg, afternoonAvg, eveningAvg, nightAvg });

            setData({
                morning: morningAvg,
                afternoon: afternoonAvg,
                evening: eveningAvg,
                night: nightAvg
            });
        } catch (err) {
            console.error('Error fetching time of day data:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Helper function to extract average from insight string
    const extractAverage = (insights: string[], timeOfDay: string): number => {
        const insight = insights.find((i: string) => i.includes(timeOfDay));
        if (!insight) return 0;

        const match = insight.match(/(\d+)\s*mg\/dL/);
        return match ? parseInt(match[1]) : 0;
    };

    if (loading && !refreshing) {
        return (
            <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow-sm p-6 my-4">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
                    <div className="h-32 w-full bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 my-4">
                <div className="text-center text-red-500">
                    <p>{error}</p>
                    <button
                        onClick={fetchTimeOfDayData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!data || (data.morning === 0 && data.afternoon === 0 && data.evening === 0 && data.night === 0)) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 my-4">
                <div className="text-center text-gray-500">
                    <p>No time of day blood sugar data available.</p>
                    <button
                        onClick={fetchTimeOfDayData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Refresh Data
                    </button>
                </div>
            </div>
        );
    }

    // Create chart data
    const chartData = {
        type: 'timeOfDay' as const,
        data: {
            labels: ['Morning', 'Afternoon', 'Evening', 'Night'],
            values: [data.morning, data.afternoon, data.evening, data.night],
        },
        title: 'Blood Sugar by Time of Day',
        insights: insights
    };

    return (
        <div className="relative">
            <div className="absolute top-0 right-0 z-10">
                <button
                    onClick={fetchTimeOfDayData}
                    disabled={refreshing}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 m-2"
                >
                    <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>

            {refreshing ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-pulse flex flex-col items-center">
                        <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
                        <div className="h-32 w-full bg-gray-200 rounded"></div>
                    </div>
                </div>
            ) : (
                <BloodSugarCharts data={chartData} />
            )}
        </div>
    );
} 