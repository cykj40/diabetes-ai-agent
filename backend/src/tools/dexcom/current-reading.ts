import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { DexcomService } from "../../services/dexcom.service";

/**
 * Creates a tool for fetching the current blood sugar reading from Dexcom
 * @param userId User ID for accessing Dexcom data
 * @returns A tool that can be used by the agent to get current blood sugar reading
 */
export function getCurrentReadingTool(userId: string): DynamicStructuredTool {
    const dexcomService = new DexcomService();

    return new DynamicStructuredTool({
        name: "get_current_blood_sugar",
        description: "Get the most recent blood sugar reading from Dexcom",
        schema: z.object({
            timeframe: z.enum(["now", "latest"]).optional().describe("Timeframe for the reading, defaults to 'now'"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ timeframe = "now" }) => {
            try {
                const reading = await dexcomService.getCurrentReading(userId);

                if (!reading) {
                    return "No current blood sugar reading available.";
                }

                const { value, timestamp, trend } = reading;
                const readingTime = new Date(timestamp).toLocaleString();
                const trendDescription = getTrendDescription(trend);

                return `Current blood sugar reading: ${value} mg/dL (${readingTime}). Trend: ${trendDescription}.`;
            } catch (error) {
                console.error("Error fetching current blood sugar reading:", error);
                return "Failed to fetch current blood sugar reading. Please try again later.";
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