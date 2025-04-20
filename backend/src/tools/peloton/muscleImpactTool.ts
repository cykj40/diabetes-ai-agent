import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { PelotonClient } from './pelotonClient';
import { getUserPelotonSessionCookie } from '../../services/pelotonService';

/**
 * Creates a tool for analyzing muscle impact from Peloton workouts
 * @param userId User ID for accessing Peloton data
 * @returns A tool that can be used by the agent to analyze muscle impact
 */
export function getMuscleImpactTool(userId: string): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "analyze_muscle_impact",
        description: "Analyzes muscle impact from recent Peloton workouts. Provides insights into which muscle groups have been worked, balance of training, and recommendations for future workouts.",
        schema: z.object({
            days: z.number().optional().describe("Number of days to analyze, defaults to 7"),
        }),
        func: async ({ days = 7 }) => {
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

                // Calculate date range
                const now = new Date();
                const startDate = new Date(now);
                startDate.setDate(now.getDate() - days);

                // Get workouts
                const workouts = await pelotonClient.getRecentWorkouts(30); // Get more to filter by date

                // Filter to workouts in the date range
                const filteredWorkouts = workouts.filter(workout => {
                    const workoutDate = new Date(workout.created_at * 1000);
                    return workoutDate >= startDate && workoutDate <= now;
                });

                if (filteredWorkouts.length === 0) {
                    return `No Peloton workouts found in the last ${days} days.`;
                }

                // Analyze muscle impact
                const muscleGroups: Record<string, { score: number, workouts: number }> = {};

                filteredWorkouts.forEach(workout => {
                    const workoutMuscles = getMuscleGroupsByDiscipline(
                        workout.fitness_discipline,
                        workout.name
                    );

                    // Calculate workout duration in minutes
                    const durationMinutes = workout.duration / 60;

                    // Factor to normalize intensity (higher for longer workouts)
                    const intensityFactor = Math.min(1, durationMinutes / 30);

                    // Add muscle impact to accumulated totals
                    Object.entries(workoutMuscles).forEach(([muscle, intensity]) => {
                        if (!muscleGroups[muscle]) {
                            muscleGroups[muscle] = { score: 0, workouts: 0 };
                        }

                        // Add intensity score weighted by duration factor
                        muscleGroups[muscle].score += intensity * intensityFactor;
                        muscleGroups[muscle].workouts += 1;
                    });
                });

                // Categorize muscle groups by focus level
                const highFocus: string[] = [];
                const mediumFocus: string[] = [];
                const lowFocus: string[] = [];
                const neglected: string[] = [];

                // Define standard full-body muscle list
                const standardMuscles = [
                    'quadriceps', 'hamstrings', 'calves', 'glutes',
                    'core', 'chest', 'back', 'shoulders',
                    'biceps', 'triceps', 'forearms'
                ];

                // Check for neglected muscles
                standardMuscles.forEach(muscle => {
                    if (!muscleGroups[muscle]) {
                        neglected.push(muscle);
                    }
                });

                // Categorize worked muscles by intensity
                Object.entries(muscleGroups).forEach(([muscle, data]) => {
                    const normalizedScore = data.score / data.workouts;

                    if (normalizedScore > 7) {
                        highFocus.push(muscle);
                    } else if (normalizedScore > 4) {
                        mediumFocus.push(muscle);
                    } else {
                        lowFocus.push(muscle);
                    }
                });

                // Format the response
                let response = `# Muscle Impact Analysis\n\n`;
                response += `Analysis based on ${filteredWorkouts.length} workouts over the past ${days} days:\n\n`;

                response += `## High Focus Areas\n`;
                if (highFocus.length > 0) {
                    highFocus.forEach(muscle => {
                        const data = muscleGroups[muscle];
                        response += `- **${capitalize(muscle)}**: Worked in ${data.workouts} workouts with high intensity\n`;
                    });
                } else {
                    response += `- No muscle groups have received high-intensity focus\n`;
                }

                response += `\n## Medium Focus Areas\n`;
                if (mediumFocus.length > 0) {
                    mediumFocus.forEach(muscle => {
                        const data = muscleGroups[muscle];
                        response += `- **${capitalize(muscle)}**: Worked in ${data.workouts} workouts with moderate intensity\n`;
                    });
                } else {
                    response += `- No muscle groups have received medium-intensity focus\n`;
                }

                response += `\n## Low Focus Areas\n`;
                if (lowFocus.length > 0) {
                    lowFocus.forEach(muscle => {
                        const data = muscleGroups[muscle];
                        response += `- **${capitalize(muscle)}**: Worked in ${data.workouts} workouts with low intensity\n`;
                    });
                } else {
                    response += `- No muscle groups have received low-intensity focus\n`;
                }

                if (neglected.length > 0) {
                    response += `\n## Neglected Muscle Groups\n`;
                    neglected.forEach(muscle => {
                        response += `- **${capitalize(muscle)}**: Not targeted in any recent workouts\n`;
                    });
                }

                // Add recommendations
                response += `\n## Training Balance\n`;

                // Check upper vs lower body balance
                const upperBodyMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'];
                const lowerBodyMuscles = ['quadriceps', 'hamstrings', 'calves', 'glutes'];

                const upperBodyScore = upperBodyMuscles.reduce((total, muscle) =>
                    total + (muscleGroups[muscle]?.score || 0), 0);

                const lowerBodyScore = lowerBodyMuscles.reduce((total, muscle) =>
                    total + (muscleGroups[muscle]?.score || 0), 0);

                const totalScore = upperBodyScore + lowerBodyScore;

                if (totalScore > 0) {
                    const upperBodyPercentage = Math.round((upperBodyScore / totalScore) * 100);
                    const lowerBodyPercentage = Math.round((lowerBodyScore / totalScore) * 100);

                    response += `- **Upper Body**: ${upperBodyPercentage}% of training focus\n`;
                    response += `- **Lower Body**: ${lowerBodyPercentage}% of training focus\n\n`;

                    if (upperBodyPercentage > 70) {
                        response += `Your training has been heavily focused on upper body. Consider adding more lower body workouts for better balance.\n\n`;
                    } else if (lowerBodyPercentage > 70) {
                        response += `Your training has been heavily focused on lower body. Consider adding more upper body workouts for better balance.\n\n`;
                    } else {
                        response += `Your training shows a good balance between upper and lower body.\n\n`;
                    }
                }

                response += `## Recommendations\n`;

                if (neglected.length > 0) {
                    response += `- Consider adding workouts that target your neglected muscle groups: ${neglected.map(capitalize).join(', ')}\n`;
                }

                if (highFocus.length > 0) {
                    response += `- You've been working your ${highFocus.map(capitalize).join(', ')} intensely. Consider giving these muscle groups adequate recovery time.\n`;
                }

                // Add workout type recommendations
                const workoutTypeCount = filteredWorkouts.reduce((acc, workout) => {
                    const type = workout.fitness_discipline;
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                // Check if they're doing cardio
                if (!workoutTypeCount['cycling'] && !workoutTypeCount['running'] && !workoutTypeCount['cardio']) {
                    response += `- Consider adding some cardio workouts for heart health and improved glucose management.\n`;
                }

                // Check if they're doing strength
                if (!workoutTypeCount['strength']) {
                    response += `- Adding strength training can help improve insulin sensitivity and metabolic health.\n`;
                }

                // Check if they're doing flexibility/recovery
                if (!workoutTypeCount['stretching'] && !workoutTypeCount['yoga']) {
                    response += `- Adding flexibility workouts like yoga or stretching can improve recovery and prevent injuries.\n`;
                }

                return response;
            } catch (error: any) {
                console.error('Error analyzing muscle impact:', error);
                return `Error analyzing muscle impact: ${error.message || 'Unknown error'}`;
            }
        },
    });
}

/**
 * Get muscle groups worked by fitness discipline
 * @param discipline Peloton fitness discipline
 * @param title Workout title for more specific analysis
 * @returns Object mapping muscle groups to intensity (0-10)
 */
function getMuscleGroupsByDiscipline(discipline: string, title: string = ''): Record<string, number> {
    const lowerTitle = title.toLowerCase();

    // Base muscle groups by discipline
    switch (discipline.toLowerCase()) {
        case 'cycling':
            return {
                'quadriceps': 9,
                'hamstrings': 7,
                'calves': 8,
                'glutes': 8,
                'core': 5,
                'lower_back': 4,
                'heart': 10
            };
        case 'running':
        case 'walking':
            return {
                'quadriceps': 8,
                'hamstrings': 9,
                'calves': 10,
                'glutes': 7,
                'core': 6,
                'heart': 10
            };
        case 'strength':
            // Default full-body strength
            let strengthMuscles: Record<string, number> = {
                'core': 6,
                'heart': 7
            };

            // Check title for specific focus
            if (lowerTitle.includes('upper body') || lowerTitle.includes('arms') || lowerTitle.includes('chest')) {
                strengthMuscles = {
                    ...strengthMuscles,
                    'chest': 8,
                    'shoulders': 8,
                    'triceps': 9,
                    'biceps': 9,
                    'back': 7
                };
            } else if (lowerTitle.includes('lower body') || lowerTitle.includes('legs')) {
                strengthMuscles = {
                    ...strengthMuscles,
                    'quadriceps': 9,
                    'hamstrings': 9,
                    'glutes': 8,
                    'calves': 6
                };
            } else if (lowerTitle.includes('core') || lowerTitle.includes('abs')) {
                strengthMuscles = {
                    ...strengthMuscles,
                    'core': 10,
                    'lower_back': 6,
                    'obliques': 8
                };
            } else {
                // Full body
                strengthMuscles = {
                    'chest': 6,
                    'back': 6,
                    'shoulders': 6,
                    'biceps': 6,
                    'triceps': 6,
                    'core': 7,
                    'quadriceps': 6,
                    'hamstrings': 6,
                    'glutes': 6,
                    'heart': 7
                };
            }
            return strengthMuscles;
        case 'yoga':
            return {
                'core': 7,
                'lower_back': 6,
                'upper_back': 5,
                'shoulders': 4,
                'hamstrings': 7,
                'glutes': 4,
                'flexibility': 9,
                'balance': 8,
                'heart': 4
            };
        case 'meditation':
            return {
                'mind': 10,
                'heart': 2
            };
        case 'cardio':
            return {
                'heart': 10,
                'lungs': 9,
                'core': 6,
                'quadriceps': 7,
                'hamstrings': 6,
                'calves': 5
            };
        case 'stretching':
            return {
                'flexibility': 10,
                'recovery': 9,
                'hamstrings': 6,
                'calves': 5,
                'shoulders': 5,
                'back': 6
            };
        default:
            return {
                'full_body': 5,
                'heart': 6
            };
    }
}

/**
 * Capitalize the first letter of a string
 * @param str String to capitalize
 * @returns Capitalized string
 */
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.replace('_', ' ').slice(1);
} 