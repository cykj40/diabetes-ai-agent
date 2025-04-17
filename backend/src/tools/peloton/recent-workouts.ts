import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient } from "./pelotonClient";

/**
 * Creates a tool for fetching recent workouts from Peloton
 * @param userId User ID for accessing Peloton data
 * @returns A tool that can be used by the agent to get recent workouts
 */
export function getRecentWorkoutsTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "get_recent_peloton_workouts",
        description: "Get the most recent workouts from Peloton. Useful when the user asks about their recent exercise, workout history, or Peloton activities.",
        schema: z.object({
            limit: z.number().optional().describe("Number of workouts to fetch, defaults to 5"),
        }),
        func: async ({ limit = 5 }) => {
            try {
                // In a real implementation, you would fetch the user's session cookie from a database
                // For now, we'll use a placeholder and handle the error gracefully
                const pelotonClient = new PelotonClient(process.env.PELOTON_SESSION_COOKIE || "");

                const workouts = await pelotonClient.getRecentWorkouts(limit);

                if (!workouts || workouts.length === 0) {
                    return "No recent Peloton workouts found.";
                }

                let response = `Here are your ${workouts.length} most recent Peloton workouts:\n\n`;

                workouts.forEach((workout: any, index: number) => {
                    const workoutDate = new Date(workout.created_at * 1000).toLocaleDateString();
                    const duration = Math.round(workout.ride.duration / 60); // Convert seconds to minutes

                    response += `${index + 1}. ${workout.ride.title} with ${workout.ride.instructor.name} (${workoutDate})\n`;
                    response += `   Duration: ${duration} minutes\n`;
                    response += `   Output: ${workout.total_work} kJ\n\n`;
                });

                return response;
            } catch (error) {
                console.error("Error fetching recent Peloton workouts:", error);
                return "Failed to fetch recent Peloton workouts. Please make sure your Peloton account is connected.";
            }
        },
    });
} 