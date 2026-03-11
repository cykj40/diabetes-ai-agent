import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient, PelotonWorkout } from './pelotonClient';
import { getUserPelotonSessionCookie } from '../../services/pelotonService';

/**
 * Creates a tool for fetching recent Peloton workout data
 * @param userId User ID for accessing Peloton data
 * @returns A tool that can be used by the agent to fetch workout data
 */
export function getFetchPelotonWorkoutDataTool(userId: string): DynamicStructuredTool {
    const schema = z.object({
        limit: z.number().optional().describe("Number of workouts to fetch, defaults to 10"),
    });

    return new DynamicStructuredTool({
        name: "fetch_peloton_workout_data",
        description: "Fetches recent workout data from Peloton, including duration, type, calories burned, and timestamps. Use this to get exercise information that can be correlated with blood sugar patterns.",
        schema: schema as any,
        func: async ({ limit = 10 }: any) => {
            try {
                const sessionCookie = await getUserPelotonSessionCookie(userId);
                console.log(`Using Peloton session cookie: ${sessionCookie ? sessionCookie.substring(0, 10) + '...' : 'undefined'}`);

                if (!sessionCookie) {
                    return "Peloton session cookie not configured. Please connect your Peloton account in settings.";
                }

                const pelotonClient = new PelotonClient(sessionCookie);

                // Test the connection first
                const connectionTest = await pelotonClient.testConnection();
                console.log(`Connection test result: ${JSON.stringify(connectionTest)}`);

                if (!connectionTest.success) {
                    return `Unable to connect to Peloton: ${connectionTest.details}`;
                }

                try {
                    // Fetch the workouts
                    console.log(`Fetching ${limit} recent Peloton workouts...`);
                    const workouts = await pelotonClient.getRecentWorkouts(limit);
                    console.log(`Successfully fetched ${workouts.length} Peloton workouts`);

                    if (!workouts || workouts.length === 0) {
                        return "No recent Peloton workouts found.";
                    }

                    // Format the response for the agent
                    let response = `# Recent Peloton Workouts\n\n`;
                    response += `Found ${workouts.length} recent workouts:\n\n`;

                    workouts.forEach((workout, index) => {
                        const date = new Date(workout.created_at * 1000).toLocaleDateString();
                        const time = new Date(workout.created_at * 1000).toLocaleTimeString();
                        const durationMinutes = Math.floor(workout.duration / 60);

                        response += `## Workout ${index + 1}: ${workout.name}\n`;
                        response += `- **Date**: ${date} at ${time}\n`;
                        response += `- **Type**: ${workout.fitness_discipline}\n`;
                        response += `- **Duration**: ${durationMinutes} minutes\n`;
                        response += `- **Calories**: ${workout.calories}\n`;

                        if (workout.instructor) {
                            response += `- **Instructor**: ${workout.instructor.name}\n`;
                        }

                        response += '\n';
                    });

                    // Add summary of workout types
                    const workoutTypes = workouts.reduce((acc, workout) => {
                        const type = workout.fitness_discipline;
                        acc[type] = (acc[type] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    response += `## Workout Summary\n`;
                    response += `Workout types in the last ${workouts.length} sessions:\n`;

                    Object.entries(workoutTypes).forEach(([type, count]) => {
                        response += `- ${type}: ${count} workouts\n`;
                    });

                    response += `\nThis data can be correlated with blood sugar trends to understand how exercise affects glucose levels.`;

                    return response;
                } catch (error: any) {
                    console.error('Error in fetchPelotonWorkoutData:', error);
                    console.error('Error details:', error.message);
                    if (error.response) {
                        console.error('Error response:', error.response.data);
                        console.error('Error status:', error.response.status);
                    }
                    return `Error fetching Peloton workout data: ${error.message || 'Unknown error'}`;
                }
            } catch (error: any) {
                console.error('Error in fetchPelotonWorkoutData outer try/catch:', error);
                return `Error fetching Peloton workout data: ${error.message || 'Unknown error'}`;
            }
        },
    });
} 
