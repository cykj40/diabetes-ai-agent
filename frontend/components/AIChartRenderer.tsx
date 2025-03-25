'use client';

import { useEffect, useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    TimeScale
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    TimeScale
);

interface ChartConfig {
    type: 'line' | 'pie';
    data: {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            backgroundColor?: string[];
            borderColor?: string;
            fill?: boolean;
        }[];
    };
    options?: {
        title?: {
            display: boolean;
            text: string;
        };
        scales?: {
            x?: { type: string; title?: { display: boolean; text: string } };
            y?: { title?: { display: boolean; text: string } };
        };
    };
}

interface AIChartRendererProps {
    chartData: string;
    className?: string;
}

export default function AIChartRenderer({ chartData, className = '' }: AIChartRendererProps) {
    try {
        const config: ChartConfig = JSON.parse(chartData);
        const chartRef = useRef<ChartJS>(null);

        useEffect(() => {
            // Update chart on data change
            if (chartRef.current) {
                chartRef.current.update();
            }
        }, [chartData]);

        const commonProps = {
            className,
            ref: chartRef,
            options: {
                ...config.options,
                responsive: true,
                maintainAspectRatio: false,
            },
        };

        return (
            <div className={`w-full h-[400px] ${className}`}>
                {config.type === 'line' ? (
                    <Line {...commonProps} data={config.data} />
                ) : (
                    <Pie {...commonProps} data={config.data} />
                )}
            </div>
        );
    } catch (error) {
        console.error('Error rendering chart:', error);
        return (
            <div className="text-red-500 p-4">
                Failed to render chart. Please try again.
            </div>
        );
    }
} 