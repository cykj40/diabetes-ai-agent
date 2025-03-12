import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ChartService } from "../../services/chart.service";
import { DexcomService } from "../../services/dexcom.service";

/**
 * Creates a tool for generating line charts of blood sugar data
 * @param userId User ID for accessing blood sugar data
 * @returns A tool that can be used by the agent to generate line charts
 */
export function getLineChartTool(userId: string): DynamicStructuredTool {
    const chartService = new ChartService();
    const dexcomService = new DexcomService();

    return new DynamicStructuredTool({
        name: "generate_blood_sugar_line_chart",
        description: "Generate a line chart visualization of blood sugar readings over time",
        schema: z.object({
            timeRange: z.enum(["day", "week", "month"]).describe("Time range for the chart (day, week, or month)"),
            title: z.string().optional().describe("Optional title for the chart"),
            includeTargetRange: z.boolean().optional().describe("Whether to include the target blood sugar range on the chart"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ timeRange, title, includeTargetRange = true }) => {
            try {
                // Get blood sugar readings based on time range
                let readings;
                const now = new Date();
                let startDate;

                switch (timeRange) {
                    case "day":
                        startDate = new Date(now);
                        startDate.setDate(now.getDate() - 1);
                        readings = await dexcomService.getReadings(userId, startDate, now);
                        break;
                    case "week":
                        startDate = new Date(now);
                        startDate.setDate(now.getDate() - 7);
                        readings = await dexcomService.getReadings(userId, startDate, now);
                        break;
                    case "month":
                        startDate = new Date(now);
                        startDate.setMonth(now.getMonth() - 1);
                        readings = await dexcomService.getReadings(userId, startDate, now);
                        break;
                    default:
                        return "Invalid time range specified.";
                }

                if (!readings || readings.length === 0) {
                    return "No blood sugar readings available for the specified time range.";
                }

                // Generate chart
                const chartTitle = title || `Blood Sugar Readings (${timeRange})`;
                const chartUrl = await chartService.generateLineChart(
                    readings,
                    chartTitle,
                    "Time",
                    "Blood Sugar (mg/dL)",
                    includeTargetRange
                );

                return `![Blood Sugar Chart](${chartUrl})`;
            } catch (error) {
                console.error("Error generating blood sugar line chart:", error);
                return "Failed to generate blood sugar line chart. Please try again later.";
            }
        },
    });
} 