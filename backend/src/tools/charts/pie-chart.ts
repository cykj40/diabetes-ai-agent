import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChartService } from "../../services/chart.service";
import { DexcomService } from "../../services/dexcom.service";
import { PatternAnalysisService } from "../../services/pattern-analysis.service";

/**
 * Creates a tool for generating pie charts
 * @param userId User ID for accessing data for chart generation
 * @returns A tool that can be used by the agent to generate pie charts
 */
export function getPieChartTool(userId: string): DynamicStructuredTool {
    const chartService = new ChartService();
    const dexcomService = new DexcomService();
    const patternAnalysisService = new PatternAnalysisService();

    return new DynamicStructuredTool({
        name: "generate_pie_chart",
        description: "Generate a pie chart visualization for blood sugar time-in-range or other categorical data",
        schema: z.object({
            chartType: z.enum(["time_in_range", "meal_distribution", "custom"]).describe("Type of pie chart to generate"),
            timeRange: z.enum(["day", "week", "month"]).optional().describe("Time range for the data, defaults to 'week'"),
            title: z.string().optional().describe("Optional title for the chart"),
            customData: z.array(z.object({
                label: z.string(),
                value: z.number(),
                color: z.string().optional()
            })).optional().describe("Custom data for the chart if chartType is 'custom'"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ chartType, timeRange = "week", title, customData }) => {
            try {
                // Convert timeRange to days
                const days = timeRange === "day" ? 1 : timeRange === "week" ? 7 : 30;

                // Prepare data for the chart based on chartType
                let data: Array<{ label: string; value: number; color?: string }> = [];
                let chartTitle = title || `Blood Sugar ${chartType.replace('_', ' ')} - ${timeRange}`;

                if (chartType === "time_in_range") {
                    // Get readings for the specified time range
                    const now = new Date();
                    const startDate = new Date(now);
                    startDate.setDate(now.getDate() - days);

                    const readings = await dexcomService.getReadings(userId, startDate, now);

                    if (readings.length === 0) {
                        return "No blood sugar readings available for the specified time range.";
                    }

                    // Calculate time in range percentages
                    const inRange = readings.filter(r => r.value >= 70 && r.value <= 180).length;
                    const aboveRange = readings.filter(r => r.value > 180).length;
                    const belowRange = readings.filter(r => r.value < 70).length;

                    const timeInRange = Math.round((inRange / readings.length) * 100);
                    const timeAboveRange = Math.round((aboveRange / readings.length) * 100);
                    const timeBelowRange = Math.round((belowRange / readings.length) * 100);

                    data = [
                        { label: "In Range (70-180 mg/dL)", value: timeInRange, color: "#4CAF50" },
                        { label: "Above Range (>180 mg/dL)", value: timeAboveRange, color: "#F44336" },
                        { label: "Below Range (<70 mg/dL)", value: timeBelowRange, color: "#FFC107" }
                    ];
                } else if (chartType === "meal_distribution") {
                    // Get meal distribution data from pattern analysis
                    // This is a simplified example - in a real implementation, you would get actual meal data
                    data = [
                        { label: "Breakfast", value: 25, color: "#2196F3" },
                        { label: "Lunch", value: 30, color: "#9C27B0" },
                        { label: "Dinner", value: 35, color: "#FF9800" },
                        { label: "Snacks", value: 10, color: "#607D8B" }
                    ];
                } else if (chartType === "custom" && customData && customData.length > 0) {
                    // Use custom data provided by the user
                    data = customData;
                } else {
                    return "Invalid chart type or missing custom data for custom chart type.";
                }

                // Generate the pie chart
                const chartUrl = await chartService.generatePieChart(data, chartTitle);

                return `![${chartTitle}](${chartUrl})`;
            } catch (error) {
                console.error("Error generating pie chart:", error);
                return "Failed to generate pie chart. Please try again later.";
            }
        },
    });
} 