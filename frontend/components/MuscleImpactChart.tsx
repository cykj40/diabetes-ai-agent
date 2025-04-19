'use client';

import React, { useEffect, useState } from 'react';
import { FiInfo } from 'react-icons/fi';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ClientOnly from './ClientOnly';
import { api } from '../lib/api';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface MuscleImpactChartProps {
    days?: number;
}

interface MuscleData {
    muscleGroups: Record<string, { score: number; workouts: number }>;
    totalWorkouts: number;
    startDate: string;
    endDate: string;
}

const MuscleImpactChart: React.FC<MuscleImpactChartProps> = ({ days = 7 }) => {
    const [data, setData] = useState<MuscleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        const fetchMuscleImpactData = async () => {
            try {
                setLoading(true);

                const response = await api.peloton.getMuscleImpact(days) as any;

                if (!response.muscleGroups) {
                    throw new Error('No muscle impact data available');
                }

                setData(response as MuscleData);
            } catch (err: any) {
                console.error('Error fetching muscle impact data:', err);
                setError(err.message || 'Failed to load muscle impact data');
            } finally {
                setLoading(false);
            }
        };

        fetchMuscleImpactData();
    }, [days]);

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

    if (error || !data) {
        return (
            <div className="h-full flex justify-center items-center p-4">
                <div className="text-center">
                    <p className="text-red-500 mb-2">
                        {error || 'No muscle impact data available'}
                    </p>
                    <p className="text-sm text-gray-500">
                        Connect your Peloton account to see muscle impact data
                    </p>
                </div>
            </div>
        );
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: false,
                text: 'Muscle Impact',
            },
        },
        scales: {
            y: {
                title: {
                    display: true,
                    text: 'Impact Score',
                },
                suggestedMin: 0,
            },
            x: {
                title: {
                    display: true,
                    text: 'Muscle Group',
                },
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };

    // Prepare chart data
    const chartData = {
        labels: Object.keys(data.muscleGroups).map(muscle =>
            muscle.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        ),
        datasets: [
            {
                label: 'Impact Score',
                data: Object.values(data.muscleGroups).map(m => Math.round(m.score * 10) / 10),
                backgroundColor: 'rgba(59, 130, 246, 0.6)',
            },
            {
                label: 'Workouts',
                data: Object.values(data.muscleGroups).map(m => m.workouts),
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
            },
        ],
    };

    return (
        <div className="h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-800">Muscle Impact Analysis</h3>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                        {`Last ${days} Days`}
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
                                This chart shows both the impact score (intensity × duration) and number of workouts
                                per muscle group from your recent Peloton workouts.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full h-64 md:h-80">
                <Bar options={options} data={chartData} />
            </div>

            <div className="mt-4 text-sm text-gray-500">
                <p>Total workouts: {data.totalWorkouts}</p>
                <p>Period: {new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}</p>
            </div>
        </div>
    );
};

export default MuscleImpactChart; 