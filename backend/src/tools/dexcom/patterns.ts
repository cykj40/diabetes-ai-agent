import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PatternAnalysisService } from "../../services/pattern-analysis.service";

/**
 * Creates a tool for analyzing blood sugar patterns
 * @param userId User ID for accessing and analyzing blood sugar data
 * @returns A tool that can be used by the agent to analyze blood sugar patterns
 */
export function getPatternsTool(userId: string): DynamicStructuredTool {
    const patternAnalysisService = new PatternAnalysisService();

    return new DynamicStructuredTool({
        name: "analyze_blood_sugar_patterns",
        description: "Analyze blood sugar patterns to identify trends, recurring issues, and potential improvements",
        schema: z.object({
            timeRange: z.enum(["day", "week", "month"]).describe("Time range for pattern analysis"),
            patternType: z.enum(["time_of_day", "day_of_week", "meal_impact", "all"]).optional().describe("Type of patterns to analyze"),
        }) as any, // Type assertion to avoid TypeScript errors
        func: async ({ timeRange, patternType = "all" }) => {
            try {
                // Convert timeRange to days
                const days = timeRange === "day" ? 1 : timeRange === "week" ? 7 : 30;

                let response = `Analysis of blood sugar patterns over the past ${days} day(s):\n\n`;

                // Get time-of-day patterns if requested
                if (patternType === "time_of_day" || patternType === "all") {
                    const timeOfDay = await patternAnalysisService.getTimeOfDayAnalysis(userId, days);

                    response += "**Time of Day Patterns**\n";
                    for (const [period, value] of Object.entries(timeOfDay)) {
                        response += `- ${period}: ${Math.round(value as number)} mg/dL average\n`;
                    }
                    response += "\n";
                }

                // Get day-of-week patterns if requested
                if (patternType === "day_of_week" || patternType === "all") {
                    const weeklyPatterns = await patternAnalysisService.getWeeklyPatterns(userId);

                    response += "**Day of Week Patterns**\n";
                    for (const [day, data] of Object.entries(weeklyPatterns.averageByDay)) {
                        response += `- ${day}: ${Math.round(data as number)} mg/dL average\n`;
                    }
                    response += "\n";
                }

                // Get common patterns and insights
                if (patternType === "all") {
                    const patterns = await patternAnalysisService.identifyPatterns(userId);

                    if (patterns.highRiskTimes.length > 0) {
                        response += "**High Risk Times**\n";
                        patterns.highRiskTimes.forEach(time => {
                            response += `- ${time}\n`;
                        });
                        response += "\n";
                    }

                    if (patterns.stablePeriods.length > 0) {
                        response += "**Stable Periods**\n";
                        patterns.stablePeriods.forEach(period => {
                            response += `- ${period}\n`;
                        });
                        response += "\n";
                    }

                    if (patterns.improvement.length > 0) {
                        response += "**Areas of Improvement**\n";
                        patterns.improvement.forEach(item => {
                            response += `- ${item}\n`;
                        });
                        response += "\n";
                    }

                    if (patterns.concerns.length > 0) {
                        response += "**Concerns**\n";
                        patterns.concerns.forEach(concern => {
                            response += `- ${concern}\n`;
                        });
                    }
                }

                return response;
            } catch (error) {
                console.error("Error analyzing blood sugar patterns:", error);
                return "Failed to analyze blood sugar patterns. Please try again later.";
            }
        },
    });
} 