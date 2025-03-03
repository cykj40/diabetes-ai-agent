import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartData,
    ChartOptions
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface BloodSugarData {
    type: 'line' | 'bar' | 'timeOfDay';
    data: {
        labels: string[];
        values: number[];
        trends?: string[];
    };
    title: string;
    insights?: string[];
}

interface Props {
    data: BloodSugarData;
}

export default function BloodSugarCharts({ data }: Props) {
    const chartOptions: ChartOptions<'line' | 'bar'> = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: data.title,
                font: {
                    size: 16,
                    weight: 'bold'
                }
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y;
                        const trend = data.data.trends?.[context.dataIndex];
                        return trend ? `${value} mg/dL - ${trend}` : `${value} mg/dL`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                title: {
                    display: true,
                    text: 'Blood Sugar (mg/dL)'
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            },
            x: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            }
        }
    };

    // Create separate chart data objects for line and bar charts
    const lineChartData: ChartData<'line'> = {
        labels: data.data.labels,
        datasets: [
            {
                label: 'Blood Sugar',
                data: data.data.values,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                tension: 0.3,
                fill: true
            }
        ]
    };

    const barChartData: ChartData<'bar'> = {
        labels: data.data.labels,
        datasets: [
            {
                label: 'Blood Sugar',
                data: data.data.values,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)'
            }
        ]
    };

    const renderChart = () => {
        switch (data.type) {
            case 'line':
                return <Line options={chartOptions as ChartOptions<'line'>} data={lineChartData} />;
            case 'bar':
                return <Bar options={chartOptions as ChartOptions<'bar'>} data={barChartData} />;
            case 'timeOfDay':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Bar options={chartOptions as ChartOptions<'bar'>} data={barChartData} />
                        <div className="bg-white p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-3">Time of Day Insights</h3>
                            <ul className="space-y-2">
                                {data.insights?.map((insight, index) => (
                                    <li key={index} className="flex items-start space-x-2">
                                        <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></span>
                                        <span className="text-gray-700">{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-6 my-4">
            {renderChart()}
            {data.insights && data.type !== 'timeOfDay' && (
                <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">Key Insights</h3>
                    <ul className="space-y-2">
                        {data.insights.map((insight, index) => (
                            <li key={index} className="flex items-start space-x-2">
                                <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></span>
                                <span className="text-gray-700">{insight}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
} 