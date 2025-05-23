import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DexcomService } from "../../services/dexcom.service";

// Chart data interfaces
export interface ChartDataPoint {
    timestamp: string;
    value: number;
}

export interface ChartConfig {
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

const chartSchema = z.object({
    chartType: z.enum(['line', 'pie']).describe('Type of chart to create: line (for trends over time) or pie (for distribution)'),
    timeRange: z.enum(['day', 'week', 'month']).describe('Time range for the data'),
    title: z.string().optional().describe('Optional title for the chart'),
    showTargetRange: z.boolean().optional().describe('For line charts, whether to show the target blood sugar range'),
    metric: z.enum(['readings', 'time_in_range', 'daily_average']).describe('What metric to visualize')
});

export function getChartTool(userId: string) {
    const dexcomService = new DexcomService();

    return new DynamicStructuredTool({
        name: "create_chart",
        description: "Create a chart visualization of blood sugar data. Returns chart configuration that can be rendered by Chart.js.",
        schema: chartSchema as any,
        func: async ({ chartType, timeRange, title, showTargetRange, metric }) => {
            try {
                const now = new Date();
                let startDate = new Date();

                // Calculate start date based on time range
                switch (timeRange) {
                    case 'day':
                        startDate.setDate(now.getDate() - 1);
                        break;
                    case 'week':
                        startDate.setDate(now.getDate() - 7);
                        break;
                    case 'month':
                        startDate.setMonth(now.getMonth() - 1);
                        break;
                }

                // Fetch readings from Dexcom
                const readings = await dexcomService.getReadings(userId, startDate, now);

                let chartData: ChartConfig;
                let summary = '';

                if (chartType === 'line') {
                    // Format data for line chart
                    const sortedReadings = readings.sort((a, b) =>
                        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );

                    chartData = {
                        type: 'line',
                        data: {
                            labels: sortedReadings.map(r => new Date(r.timestamp).toLocaleString()),
                            datasets: [{
                                label: 'Blood Sugar',
                                data: sortedReadings.map(r => r.value),
                                borderColor: '#3b82f6',
                                fill: false
                            }]
                        },
                        options: {
                            title: {
                                display: true,
                                text: title || `Blood Sugar Trends - Past ${timeRange}`
                            },
                            scales: {
                                x: { type: 'time', title: { display: true, text: 'Time' } },
                                y: { title: { display: true, text: 'Blood Sugar (mg/dL)' } }
                            }
                        }
                    };

                    // Add target range if requested
                    if (showTargetRange) {
                        chartData.data.datasets.push(
                            {
                                label: 'Target Range Min',
                                data: sortedReadings.map(() => 70),
                                borderColor: '#10b981',
                                fill: false
                            },
                            {
                                label: 'Target Range Max',
                                data: sortedReadings.map(() => 180),
                                borderColor: '#10b981',
                                fill: false
                            }
                        );
                    }

                    summary = `Here's a line chart showing your blood sugar trends over the past ${timeRange}:\n\n`;
                    summary += `This chart shows your blood sugar values over time${showTargetRange ? ', with the target range indicated by green lines' : ''}. You can see patterns and trends in your readings, which can help identify times when your blood sugar tends to rise or fall. If you need help interpreting the trends or have questions, feel free to ask!\n\n`;
                } else {
                    // Calculate time in range distribution for pie chart
                    const inRange = readings.filter(r => r.value >= 70 && r.value <= 180).length;
                    const low = readings.filter(r => r.value < 70).length;
                    const high = readings.filter(r => r.value > 180).length;
                    const total = readings.length;

                    const inRangePercent = (inRange / total) * 100;
                    const lowPercent = (low / total) * 100;
                    const highPercent = (high / total) * 100;

                    chartData = {
                        type: 'pie',
                        data: {
                            labels: ['In Range', 'Low', 'High'],
                            datasets: [{
                                label: 'Time in Range Distribution',
                                data: [inRangePercent, lowPercent, highPercent],
                                backgroundColor: ['#10b981', '#3b82f6', '#ef4444']
                            }]
                        },
                        options: {
                            title: {
                                display: true,
                                text: title || `Time in Range - Past ${timeRange}`
                            }
                        }
                    };

                    summary = `Here's a pie chart showing your time in range distribution for the past ${timeRange}:\n\n`;
                    summary += `In Range: ${inRangePercent.toFixed(2)}%\n`;
                    summary += `Low: ${lowPercent.toFixed(2)}%\n`;
                    summary += `High: ${highPercent.toFixed(2)}%\n\n`;
                    summary += `This visualization helps you understand how often your blood sugar levels were within the target range, as well as the frequency of low and high readings. If you need further insights or have any questions, feel free to ask!\n\n`;
                }

                // Always wrap the chart data in a code block
                return `${summary}\`\`\`json\n${JSON.stringify(chartData, null, 2)}\n\`\`\``;
            } catch (error) {
                console.error('Error creating chart:', error);
                throw new Error('Failed to create chart visualization');
            }
        }
    });
} 