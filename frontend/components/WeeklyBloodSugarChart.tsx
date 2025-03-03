import { useEffect, useState } from 'react';
import BloodSugarCharts from './BloodSugarCharts';
import { FiRefreshCw } from 'react-icons/fi';

interface WeeklyBloodSugarData {
    labels: string[];
    values: number[];
    trends: string[];
    insights: string[];
}

export default function WeeklyBloodSugarChart() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<WeeklyBloodSugarData | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchWeeklyData();
    }, []);

    const fetchWeeklyData = async () => {
        try {
            setLoading(true);
            setError(null);
            setRefreshing(true);

            console.log('Fetching weekly blood sugar data...');
            const response = await fetch('http://localhost:3001/api/dexcom/weekly-data', {
                credentials: 'include', // Important for session cookies
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
            console.log('Weekly data received:', weeklyData);
            setData(weeklyData);
        } catch (err) {
            console.error('Error fetching weekly blood sugar data:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
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
                        onClick={fetchWeeklyData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!data || data.labels.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 my-4">
                <div className="text-center text-gray-500">
                    <p>No blood sugar data available for the past week.</p>
                    <button
                        onClick={fetchWeeklyData}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Refresh Data
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm p-6 my-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Weekly Blood Sugar Trends</h2>
                <button
                    onClick={fetchWeeklyData}
                    disabled={refreshing}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                <BloodSugarCharts
                    data={{
                        type: 'line',
                        data: {
                            labels: data.labels,
                            values: data.values,
                            trends: data.trends
                        },
                        title: 'Blood Sugar Levels - Past Week',
                        insights: data.insights
                    }}
                />
            )}
        </div>
    );
} 