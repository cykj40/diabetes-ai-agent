import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient } from "./pelotonClient";

/**
 * Creates a tool for fetching workout details from Peloton
 * @param userId User ID for accessing Peloton data
 * @returns A tool that can be used by the agent to get workout details
 */
export function getWorkoutDetailsTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "get_peloton_workout_details",
        description: "Get detailed information about a specific Peloton workout. Useful when the user asks about a particular workout or wants to analyze a specific exercise session.",
        schema: z.object({
            workoutId: z.string().describe("ID of the workout to fetch details for"),
        }),
        func: async ({ workoutId }) => {
            try {
                // In a real implementation, you would fetch the user's session cookie from a database
                // For now, we'll use a placeholder and handle the error gracefully
                const pelotonClient = new PelotonClient(process.env.PELOTON_SESSION_COOKIE || "");

                const workoutDetails = await pelotonClient.getWorkoutDetails(workoutId);

                if (!workoutDetails) {
                    return "Workout details not found.";
                }

                const workoutDate = new Date(workoutDetails.created_at * 1000).toLocaleDateString();
                const startTime = new Date(workoutDetails.start_time * 1000).toLocaleTimeString();
                const endTime = new Date(workoutDetails.end_time * 1000).toLocaleTimeString();
                const duration = Math.round((workoutDetails.end_time - workoutDetails.start_time) / 60); // Minutes

                let response = `Workout Details for ${workoutDetails.ride.title} with ${workoutDetails.ride.instructor.name}\n\n`;
                response += `Date: ${workoutDate}\n`;
                response += `Time: ${startTime} - ${endTime} (${duration} minutes)\n`;
                response += `Discipline: ${workoutDetails.fitness_discipline}\n\n`;

                // Add metrics if available
                if (workoutDetails.metrics) {
                    response += "Performance Metrics:\n";

                    if (workoutDetails.metrics.heart_rate) {
                        response += `- Heart Rate: Avg ${workoutDetails.metrics.heart_rate.average} bpm, Max ${workoutDetails.metrics.heart_rate.max} bpm\n`;
                    }

                    if (workoutDetails.metrics.output) {
                        response += `- Output: Avg ${workoutDetails.metrics.output.average} watts, Max ${workoutDetails.metrics.output.max} watts, Total ${workoutDetails.metrics.output.total} kJ\n`;
                    }

                    if (workoutDetails.metrics.cadence) {
                        response += `- Cadence: Avg ${workoutDetails.metrics.cadence.average} rpm, Max ${workoutDetails.metrics.cadence.max} rpm\n`;
                    }

                    if (workoutDetails.metrics.resistance) {
                        response += `- Resistance: Avg ${Math.round(workoutDetails.metrics.resistance.average)}%, Max ${Math.round(workoutDetails.metrics.resistance.max)}%\n`;
                    }
                }

                // Add achievement summary
                response += `\nTotal Output: ${workoutDetails.total_work} kJ\n`;

                // Add comparison to previous workouts if available
                response += "\nThis data can be used to analyze your performance and track your progress over time. Would you like me to compare this workout to your previous ones?";

                return response;
            } catch (error) {
                console.error("Error fetching Peloton workout details:", error);
                return "Failed to fetch workout details. Please make sure your Peloton account is connected and the workout ID is correct.";
            }
        },
    });
} 