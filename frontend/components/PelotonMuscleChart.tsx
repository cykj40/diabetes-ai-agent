'use client';

import React, { useEffect, useState } from 'react';
import { FiInfo } from 'react-icons/fi';
import dynamic from 'next/dynamic';

// Create a NoSSR wrapper
const NoSSR: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

// Use dynamic import with ssr disabled for NoSSR
const DynamicNoSSR = dynamic(() => Promise.resolve(NoSSR), {
    ssr: false
});

// Import the chart component with SSR disabled
const RadarChartComponent = dynamic(() => import('./PelotonMuscleChartCore'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center">
            <div className="animate-pulse h-40 w-40 rounded-full bg-blue-100"></div>
        </div>
    )
});

interface MuscleGroupData {
    [muscle: string]: number;
}

interface PelotonMuscleChartProps {
    period?: '7_days' | '30_days';
}

const PelotonMuscleChart: React.FC<PelotonMuscleChartProps> = ({ period = '7_days' }) => {
    const [muscleData, setMuscleData] = useState<{ muscle: string; percentage: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const fetchMuscleActivityData = async () => {
            try {
                setLoading(true);

                import('../lib/api').then(async ({ api }) => {
                    try {
                        const data = await api.peloton.getMuscleActivity(period) as {
                            success: boolean;
                            muscleActivityData?: Record<string, number>;
                            message?: string;
                        };

                        if (!data.success || !data.muscleActivityData) {
                            throw new Error(data.message || 'No muscle activity data available');
                        }

                        // Format data for the chart
                        const chartData = Object.entries(data.muscleActivityData).map(([muscle, percentage]) => ({
                            muscle,
                            percentage: percentage as number,
                        }));

                        setMuscleData(chartData);
                    } catch (err: any) {
                        console.error('Error fetching muscle activity data:', err);
                        setError(err.message || 'Failed to load muscle activity data');
                    } finally {
                        setLoading(false);
                    }
                }).catch(err => {
                    console.error('Error importing API module:', err);
                    setError('Failed to load API utilities');
                    setLoading(false);
                });
            } catch (err: any) {
                console.error('Error in muscle activity data fetching:', err);
                setError(err.message || 'Failed to load muscle activity data');
                setLoading(false);
            }
        };

        fetchMuscleActivityData();
    }, [period]);

    if (loading) {
        return (
            <div className="h-full flex justify-center items-center p-4">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
                    <div className="h-64 w-full bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error || muscleData.length === 0) {
        return (
            <div className="h-full flex justify-center items-center p-4">
                <div className="text-center">
                    <p className="text-red-500 mb-2">
                        {error || 'No muscle activity data available'}
                    </p>
                    <p className="text-sm text-gray-500">
                        Connect your Peloton account to see muscle activity data
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-800">Peloton Muscle Activity</h3>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {period === '7_days' ? 'Last 7 Days' : 'Last 30 Days'}
                    </span>
                    <div className="relative">
                        <button
                            className="text-gray-500 hover:text-blue-600"
                            onMouseEnter={() => setShowInfo(true)}
                            onMouseLeave={() => setShowInfo(false)}
                        >
                            <FiInfo size={18} />
                        </button>

                        {showInfo && (
                            <div className="absolute right-0 z-10 w-64 p-3 bg-white text-sm rounded-md shadow-md border border-gray-200">
                                This chart shows which muscle groups have been most worked in your recent Peloton workouts, shown as a percentage of total muscle engagement.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full h-64 md:h-80">
                <DynamicNoSSR>
                    <RadarChartComponent data={muscleData} />
                </DynamicNoSSR>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {muscleData.map(({ muscle, percentage }) => (
                    <div key={muscle} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                        <span className="text-sm font-medium text-gray-700">{muscle}</span>
                        <span className="text-sm text-blue-600 font-semibold">{percentage}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PelotonMuscleChart; 