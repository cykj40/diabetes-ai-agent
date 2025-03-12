import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DexcomService } from "../../services/dexcom.service";

/**
 * Creates a tool for fetching weekly blood sugar data from Dexcom
 * @param userId User ID for accessing Dexcom data
 * @returns A tool that can be used by the agent to get weekly blood sugar data
 */
export function getWeeklyBloodSugarDataTool(userId: string): DynamicStructuredTool {
    const dexcomService = new DexcomService();

    return new DynamicStructuredTool({
        name: "get_weekly_blood_sugar_data",
        description: "Get comprehensive blood sugar data for the past week with statistics, trends, and insights",
        schema: z.object({
            includeChartData: z.boolean().optional().describe("Whether to include data for charting (labels, values, trends)"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ includeChartData = true }) => {
            try {
                // Get the weekly blood sugar data
                const weeklyData = await dexcomService.getWeeklyBloodSugarData();

                if (!weeklyData.values || weeklyData.values.length === 0) {
                    return "No blood sugar data available for the past week.";
                }

                // Format the response
                let response = `Weekly blood sugar analysis (past 7 days):\n\n`;

                // Calculate statistics
                const values = weeklyData.values;
                const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                const min = Math.min(...values);
                const max = Math.max(...values);

                // Calculate time in range
                const inRange = values.filter(v => v >= 70 && v <= 180).length;
                const aboveRange = values.filter(v => v > 180).length;
                const belowRange = values.filter(v => v < 70).length;

                const timeInRange = Math.round((inRange / values.length) * 100);
                const timeAboveRange = Math.round((aboveRange / values.length) * 100);
                const timeBelowRange = Math.round((belowRange / values.length) * 100);

                response += `**Statistics**\n`;
                response += `- Total readings: ${values.length}\n`;
                response += `- Average: ${Math.round(average)} mg/dL\n`;
                response += `- Minimum: ${min} mg/dL\n`;
                response += `- Maximum: ${max} mg/dL\n`;
                response += `- Time in range (70-180 mg/dL): ${timeInRange}%\n`;
                response += `- Time above range (>180 mg/dL): ${timeAboveRange}%\n`;
                response += `- Time below range (<70 mg/dL): ${timeBelowRange}%\n\n`;

                // Add insights
                if (weeklyData.insights && weeklyData.insights.length > 0) {
                    response += `**Insights**\n`;
                    weeklyData.insights.forEach(insight => {
                        response += `- ${insight}\n`;
                    });
                    response += `\n`;
                }

                // Include chart data if requested
                if (includeChartData) {
                    // Just mention that chart data is available
                    response += `Chart data is available with ${weeklyData.labels.length} data points.\n`;
                }

                // Add interpretation
                response += `\n**Interpretation**\n`;
                if (timeInRange >= 70) {
                    response += `- Good time in range (${timeInRange}% > 70%)\n`;
                } else if (timeInRange >= 50) {
                    response += `- Moderate time in range (${timeInRange}%)\n`;
                } else {
                    response += `- Low time in range (${timeInRange}% < 50%)\n`;
                }

                if (timeAboveRange > 30) {
                    response += `- High percentage of time above range (${timeAboveRange}%)\n`;
                }

                if (timeBelowRange > 4) {
                    response += `- High percentage of time below range (${timeBelowRange}%)\n`;
                }

                return response;
            } catch (error) {
                console.error("Error fetching weekly blood sugar data:", error);
                return "Failed to fetch weekly blood sugar data. Please try again later.";
            }
        },
    });
} 