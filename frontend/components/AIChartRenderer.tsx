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

type ScaleType = 'linear' | 'logarithmic' | 'category' | 'time' | 'timeseries';

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
            x?: {
                type?: ScaleType;
                title?: { display: boolean; text: string }
            };
            y?: {
                title?: { display: boolean; text: string }
            };
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
        // Use separate ref for different chart types
        const lineChartRef = useRef<ChartJS<"line">>(null);
        const pieChartRef = useRef<ChartJS<"pie">>(null);

        useEffect(() => {
            // Update chart on data change
            if (config.type === 'line' && lineChartRef.current) {
                lineChartRef.current.update();
            } else if (config.type === 'pie' && pieChartRef.current) {
                pieChartRef.current.update();
            }
        }, [chartData, config.type]);

        // Ensure scales.x.type is set to a valid type if provided
        if (config.options?.scales?.x?.type) {
            // Default to 'category' if not a valid scale type
            const xType = config.options.scales.x.type;
            if (!['linear', 'logarithmic', 'category', 'time', 'timeseries'].includes(xType)) {
                config.options.scales.x.type = 'category';
            }
        }

        const commonOptions = {
            ...config.options,
            responsive: true,
            maintainAspectRatio: false,
        };

        return (
            <div className={`w-full h-[400px] ${className}`}>
                {config.type === 'line' ? (
                    <Line
                        ref={lineChartRef}
                        data={config.data}
                        options={commonOptions}
                        className={className}
                    />
                ) : (
                    <Pie
                        ref={pieChartRef}
                        data={config.data}
                        options={commonOptions}
                        className={className}
                    />
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