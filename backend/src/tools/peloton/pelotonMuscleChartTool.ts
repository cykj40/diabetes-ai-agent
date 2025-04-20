import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient } from './pelotonClient';
import { getUserPelotonSessionCookie } from '../../services/pelotonService';

/**
 * Creates a tool for fetching Peloton muscle activity chart data
 * @param userId User ID for accessing Peloton data
 * @returns A tool that can be used by the agent to fetch muscle activity data
 */
export function getPelotonMuscleChartTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "fetch_peloton_muscle_chart",
        description: "Fetches muscle activity data from Peloton to generate a visual representation of muscle groups engaged over a specified period. Use this to visualize which muscle groups have been worked most in recent workouts.",
        schema: z.object({
            period: z.enum(['7_days', '30_days']).optional().describe("Period to analyze, either '7_days' or '30_days'. Defaults to '7_days'"),
        }),
        func: async ({ period = '7_days' }) => {
            try {
                const sessionCookie = await getUserPelotonSessionCookie(userId);

                if (!sessionCookie) {
                    return "Peloton session cookie not configured. Please connect your Peloton account in settings.";
                }

                const pelotonClient = new PelotonClient(sessionCookie);

                // Test the connection first
                const connectionTest = await pelotonClient.testConnection();
                if (!connectionTest.success) {
                    return `Unable to connect to Peloton: ${connectionTest.details}`;
                }

                // Get muscle activity data
                const muscleActivityData = await pelotonClient.getMuscleActivityData(period);

                // Format response for the agent
                const periodText = period === '7_days' ? '7 days' : '30 days';

                if (Object.keys(muscleActivityData).length === 0) {
                    return `No Peloton workout data found for the last ${periodText}. Try a different time period or complete some workouts first.`;
                }

                // Create a markdown response with the data
                let response = `# Peloton Muscle Activity Analysis\n\n`;
                response += `Here's a breakdown of your muscle engagement over the last ${periodText}:\n\n`;

                // Sort muscles by percentage (descending)
                const sortedMuscles = Object.entries(muscleActivityData)
                    .sort(([, a], [, b]) => b - a)
                    .map(([muscle, percentage]) => ({ muscle, percentage }));

                // Top worked muscles
                const topMuscles = sortedMuscles.slice(0, 3);
                response += `## Most Engaged Muscle Groups\n`;
                topMuscles.forEach(({ muscle, percentage }) => {
                    response += `- **${muscle}**: ${percentage}% of total engagement\n`;
                });

                // Visualize with ASCII chart (simple representation)
                response += `\n## Muscle Engagement Distribution\n\`\`\`\n`;
                sortedMuscles.forEach(({ muscle, percentage }) => {
                    const barLength = Math.round((percentage / 100) * 30);
                    const bar = '█'.repeat(barLength);
                    response += `${muscle.padEnd(15)}: ${bar} ${percentage}%\n`;
                });
                response += `\`\`\`\n\n`;

                // Add recommendation
                if (sortedMuscles.length > 4) {
                    const leastWorkedMuscles = sortedMuscles.slice(-2).map(m => m.muscle).join(' and ');
                    response += `Based on this data, consider incorporating workouts that target your ${leastWorkedMuscles} to achieve a more balanced training routine.`;
                }

                return response;
            } catch (error: any) {
                console.error('Error fetching Peloton muscle activity data:', error);
                return `Error fetching muscle activity data: ${error.message || 'Unknown error'}`;
            }
        },
    });
} 