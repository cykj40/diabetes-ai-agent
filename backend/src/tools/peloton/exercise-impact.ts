import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient } from "./pelotonClient";
import { DexcomService } from "../../services/dexcom.service";

/**
 * Creates a tool for analyzing how Peloton workouts impact blood sugar levels
 * @param userId User ID for accessing Peloton and Dexcom data
 * @returns A tool that can be used by the agent to analyze workout impact on glucose
 */
export function getExerciseImpactTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "analyze_exercise_impact",
        description: "Analyze how Peloton workouts impact blood sugar levels. This tool correlates exercise data with glucose readings to provide insights into how different types of workouts affect the user's diabetes management.",
        schema: z.object({
            days: z.number().optional().describe("Number of days to analyze, defaults to 7"),
            workoutType: z.string().optional().describe("Type of workout to analyze (e.g., cycling, running)"),
        }) as any,
        func: async ({ days = 7, workoutType }) => {
            try {
                // Initialize services
                const pelotonClient = new PelotonClient(process.env.PELOTON_SESSION_COOKIE || "");
                const dexcomService = new DexcomService();

                // Get recent workouts
                const workouts = await pelotonClient.getRecentWorkouts(10);

                if (!workouts || workouts.length === 0) {
                    return "No recent Peloton workouts found to analyze.";
                }

                // Filter workouts by type if specified
                const filteredWorkouts = workoutType
                    ? workouts.filter((w: any) => w.fitness_discipline.toLowerCase() === workoutType.toLowerCase())
                    : workouts;

                if (filteredWorkouts.length === 0) {
                    return `No ${workoutType} workouts found in your recent history.`;
                }

                // Calculate date range for blood sugar data
                const now = new Date();
                const startDate = new Date(now);
                startDate.setDate(now.getDate() - days);

                // Get blood sugar readings for this time period
                const bloodSugarReadings = await dexcomService.getReadings(
                    userId,
                    startDate,
                    now
                );

                if (!bloodSugarReadings || bloodSugarReadings.length === 0) {
                    return "No blood sugar readings available for the specified time period.";
                }

                // Analyze workout impact on blood sugar
                let response = "## Exercise Impact Analysis\n\n";
                response += `Based on ${filteredWorkouts.length} workouts over the past ${days} days, here's how your exercise affects your blood glucose:\n\n`;

                // Calculate average blood sugar before and after workouts
                let preWorkoutReadings: number[] = [];
                let duringWorkoutReadings: number[] = [];
                let postWorkoutReadings: number[] = [];

                filteredWorkouts.forEach((workout: any) => {
                    const workoutTime = workout.start_time * 1000; // Convert to milliseconds
                    const workoutEndTime = workout.end_time * 1000;

                    // Find readings 1 hour before workout
                    const beforeReadings = bloodSugarReadings.filter((r: any) => {
                        const readingTime = new Date(r.timestamp).getTime();
                        return readingTime >= (workoutTime - 3600000) && readingTime <= workoutTime;
                    });

                    // Find readings during workout
                    const duringReadings = bloodSugarReadings.filter((r: any) => {
                        const readingTime = new Date(r.timestamp).getTime();
                        return readingTime >= workoutTime && readingTime <= workoutEndTime;
                    });

                    // Find readings 2 hours after workout
                    const afterReadings = bloodSugarReadings.filter((r: any) => {
                        const readingTime = new Date(r.timestamp).getTime();
                        return readingTime >= workoutEndTime && readingTime <= (workoutEndTime + 7200000);
                    });

                    // Add to aggregated readings
                    preWorkoutReadings = preWorkoutReadings.concat(beforeReadings.map((r: any) => r.value));
                    duringWorkoutReadings = duringWorkoutReadings.concat(duringReadings.map((r: any) => r.value));
                    postWorkoutReadings = postWorkoutReadings.concat(afterReadings.map((r: any) => r.value));
                });

                // Calculate averages
                const avgPreWorkout = preWorkoutReadings.length > 0
                    ? Math.round(preWorkoutReadings.reduce((sum, val) => sum + val, 0) / preWorkoutReadings.length)
                    : null;

                const avgDuringWorkout = duringWorkoutReadings.length > 0
                    ? Math.round(duringWorkoutReadings.reduce((sum, val) => sum + val, 0) / duringWorkoutReadings.length)
                    : null;

                const avgPostWorkout = postWorkoutReadings.length > 0
                    ? Math.round(postWorkoutReadings.reduce((sum, val) => sum + val, 0) / postWorkoutReadings.length)
                    : null;

                // Add analysis to response
                if (avgPreWorkout && avgDuringWorkout && avgPostWorkout) {
                    response += `### Blood Glucose Patterns\n`;
                    response += `- Before Exercise: Average ${avgPreWorkout} mg/dL\n`;
                    response += `- During Exercise: Average ${avgDuringWorkout} mg/dL\n`;
                    response += `- After Exercise: Average ${avgPostWorkout} mg/dL\n\n`;

                    // Analyze the changes
                    const duringChange = avgDuringWorkout - avgPreWorkout;
                    const postChange = avgPostWorkout - avgPreWorkout;

                    response += `### Impact Analysis\n`;

                    if (duringChange < 0) {
                        response += `- Your blood sugar tends to drop by about ${Math.abs(duringChange)} mg/dL during your workouts.\n`;
                    } else if (duringChange > 0) {
                        response += `- Your blood sugar tends to rise by about ${duringChange} mg/dL during your workouts.\n`;
                    } else {
                        response += `- Your blood sugar remains relatively stable during your workouts.\n`;
                    }

                    if (postChange < 0) {
                        response += `- After exercise, your blood sugar is typically ${Math.abs(postChange)} mg/dL lower than before you started.\n`;
                    } else if (postChange > 0) {
                        response += `- After exercise, your blood sugar is typically ${postChange} mg/dL higher than before you started.\n`;
                    } else {
                        response += `- After exercise, your blood sugar typically returns to your pre-exercise levels.\n`;
                    }

                    // Add recommendations
                    response += `\n### Recommendations\n`;
                    if (duringChange < -30) {
                        response += `- Consider having a small carbohydrate snack before exercise to prevent significant drops in blood sugar.\n`;
                    }

                    if (duringChange > 30) {
                        response += `- Monitor your blood sugar closely during intense workouts as they tend to raise your glucose levels.\n`;
                    }

                    if (postChange < -20) {
                        response += `- Be aware of potential delayed hypoglycemia after exercise and consider reducing insulin or having a post-workout snack.\n`;
                    }
                } else {
                    response += "Not enough data available to provide a comprehensive analysis of exercise impact. Continue tracking your workouts and blood sugar to gather more insights.\n";
                }

                return response;
            } catch (error) {
                console.error("Error analyzing exercise impact:", error);
                return "Failed to analyze exercise impact on blood sugar. Please check that both your Peloton and Dexcom accounts are connected.";
            }
        },
    });
} 