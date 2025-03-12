import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DexcomService } from "../../services/dexcom.service";

/**
 * Creates a tool for fetching recent blood sugar readings from Dexcom
 * @param userId User ID for accessing Dexcom data
 * @returns A tool that can be used by the agent to get recent blood sugar readings
 */
export function getRecentReadingsTool(userId: string): DynamicStructuredTool {
    const dexcomService = new DexcomService();

    return new DynamicStructuredTool({
        name: "get_recent_blood_sugar_readings",
        description: "Get recent blood sugar readings from Dexcom with statistics and trends",
        schema: z.object({
            count: z.number().optional().describe("Number of readings to fetch, defaults to 24 (half a day)"),
            includeStats: z.boolean().optional().describe("Whether to include statistics like average, min, max, etc."),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ count = 24, includeStats = true }) => {
            try {
                // Get the readings
                const readings = await dexcomService.getLatestReadings(count);

                if (!readings || readings.length === 0) {
                    return "No blood sugar readings available.";
                }

                // Format the response
                let response = `Recent blood sugar readings (last ${readings.length}):\n\n`;

                // Show the most recent 5 readings
                const recentReadings = readings.slice(0, 5);
                recentReadings.forEach((reading, index) => {
                    const readingTime = new Date(reading.timestamp).toLocaleString();
                    const trendDescription = getTrendDescription(reading.trend);
                    response += `${index + 1}. ${reading.value} mg/dL (${readingTime}) - ${trendDescription}\n`;
                });

                // Include statistics if requested
                if (includeStats) {
                    // Calculate statistics
                    const values = readings.map(r => r.value);
                    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                    const min = Math.min(...values);
                    const max = Math.max(...values);

                    // Calculate time in range
                    const inRange = readings.filter(r => r.value >= 70 && r.value <= 180).length;
                    const aboveRange = readings.filter(r => r.value > 180).length;
                    const belowRange = readings.filter(r => r.value < 70).length;

                    const timeInRange = Math.round((inRange / readings.length) * 100);
                    const timeAboveRange = Math.round((aboveRange / readings.length) * 100);
                    const timeBelowRange = Math.round((belowRange / readings.length) * 100);

                    response += `\n**Statistics**\n`;
                    response += `- Average: ${Math.round(average)} mg/dL\n`;
                    response += `- Minimum: ${min} mg/dL\n`;
                    response += `- Maximum: ${max} mg/dL\n`;
                    response += `- Time in range (70-180 mg/dL): ${timeInRange}%\n`;
                    response += `- Time above range (>180 mg/dL): ${timeAboveRange}%\n`;
                    response += `- Time below range (<70 mg/dL): ${timeBelowRange}%\n`;

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
                }

                return response;
            } catch (error) {
                console.error("Error fetching recent blood sugar readings:", error);
                return "Failed to fetch recent blood sugar readings. Please try again later.";
            }
        },
    });
}

/**
 * Converts Dexcom trend value to a human-readable description
 * @param trend Dexcom trend value
 * @returns Human-readable trend description
 */
function getTrendDescription(trend: string): string {
    const trendMap: Record<string, string> = {
        "DOUBLE_UP": "Rising rapidly",
        "SINGLE_UP": "Rising",
        "FORTY_FIVE_UP": "Rising slowly",
        "FLAT": "Stable",
        "FORTY_FIVE_DOWN": "Falling slowly",
        "SINGLE_DOWN": "Falling",
        "DOUBLE_DOWN": "Falling rapidly",
        "NONE": "No trend data",
    };

    return trendMap[trend] || "Unknown trend";
} 