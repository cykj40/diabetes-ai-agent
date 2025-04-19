import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PelotonClient, getPelotonSessionCookie } from '../tools/peloton/pelotonClient';
import { getMuscleImpactTool } from '../tools/peloton/muscleImpactTool';
import { getFetchPelotonWorkoutDataTool } from '../tools/peloton/fetchPelotonWorkoutDataTool';
import { getTestPelotonConnectionTool } from '../tools/peloton/testConnectionTool';

// Define request query parameter interfaces
interface RecentWorkoutsQuery {
    limit?: string;
}

interface MuscleImpactQuery {
    days?: string;
}

interface MuscleActivityQuery {
    period?: '7_days' | '30_days';
}

// Helper function to get a session cookie (from env or fresh login)
async function getSessionCookie(): Promise<string | null> {
    // First try using the stored cookie
    let sessionCookie = process.env.PELOTON_SESSION_COOKIE;

    if (!sessionCookie) {
        console.log('No stored Peloton session cookie found, attempting to get a fresh one');
        return getPelotonSessionCookie();
    }

    // Test if the stored cookie is valid
    try {
        const client = new PelotonClient(sessionCookie);
        const test = await client.testConnection();

        if (!test.success) {
            console.log('Stored Peloton session cookie is invalid, getting a fresh one');
            const freshCookie = await getPelotonSessionCookie();
            return freshCookie;
        }

        return sessionCookie;
    } catch (error) {
        console.error('Error testing Peloton session cookie:', error);
        return getPelotonSessionCookie();
    }
}

export default async function pelotonRoutes(fastify: FastifyInstance) {
    // Test Peloton connection
    fastify.get('/test-connection', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const testTool = getTestPelotonConnectionTool(userId);
            const result = await testTool.invoke({});

            // Parse result from tool
            if (result.includes('successful')) {
                return { success: true, message: result };
            } else {
                return { success: false, message: result };
            }
        } catch (error: any) {
            console.error('Error testing Peloton connection:', error);
            return reply.code(500).send({
                success: false,
                message: `Error testing Peloton connection: ${error.message}`
            });
        }
    });

    // Get recent workouts
    fastify.get<{ Querystring: RecentWorkoutsQuery }>('/recent-workouts', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { limit = '10' } = request.query;

            // Convert limit to number
            const limitNum = parseInt(limit, 10);

            const workoutsTool = getFetchPelotonWorkoutDataTool(userId);
            const result = await workoutsTool.invoke({ limit: limitNum });

            // If the result is a string (error message), return it as an error
            if (typeof result === 'string' && !result.startsWith('#')) {
                return reply.code(400).send({
                    success: false,
                    message: result
                });
            }

            return {
                success: true,
                result
            };
        } catch (error: any) {
            console.error('Error fetching Peloton workouts:', error);
            return reply.code(500).send({
                success: false,
                message: `Error fetching Peloton workouts: ${error.message}`
            });
        }
    });

    // Get muscle impact analysis
    fastify.get<{ Querystring: MuscleImpactQuery }>('/muscle-impact', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { days = '7' } = request.query;

            // Convert days to number
            const daysNum = parseInt(days, 10);

            // We want to directly get the raw data without the formatted text
            const sessionCookie = await getSessionCookie();

            if (!sessionCookie) {
                return reply.code(400).send({
                    success: false,
                    message: "Peloton session cookie not configured"
                });
            }

            const pelotonClient = new PelotonClient(sessionCookie);

            // Test the connection first
            const connectionTest = await pelotonClient.testConnection();
            if (!connectionTest.success) {
                return reply.code(401).send({
                    success: false,
                    message: `Unable to connect to Peloton: ${connectionTest.details}`
                });
            }

            // Calculate date range
            const now = new Date();
            const startDate = new Date(now);
            startDate.setDate(now.getDate() - daysNum);

            // Get workouts
            const workouts = await pelotonClient.getRecentWorkouts(30); // Get more to filter by date

            // Filter to workouts in the date range
            const filteredWorkouts = workouts.filter(workout => {
                const workoutDate = new Date(workout.created_at * 1000);
                return workoutDate >= startDate && workoutDate <= now;
            });

            if (filteredWorkouts.length === 0) {
                return reply.code(200).send({
                    muscleGroups: {},
                    totalWorkouts: 0,
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: now.toISOString().split('T')[0]
                });
            }

            // Import muscle analysis function from the tool
            const muscleImpactTool = getMuscleImpactTool(userId);

            // Invoke the tool and get the raw muscle data
            const result = await muscleImpactTool.invoke({ days: daysNum });

            // Since we want the raw data not the formatted text, we need to extract muscle data
            // This is a temporary solution - ideally we'd refactor the tool to expose the raw data
            // or create a separate function to get the data directly

            if (typeof result === 'string' && !result.startsWith('#')) {
                // Error message
                return reply.code(400).send({
                    success: false,
                    message: result
                });
            }

            // For now, we'll analyze the workouts in this route handler as well
            // Similar to what the tool does internally

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

            return {
                muscleGroups,
                totalWorkouts: filteredWorkouts.length,
                startDate: startDate.toISOString().split('T')[0],
                endDate: now.toISOString().split('T')[0]
            };
        } catch (error: any) {
            console.error('Error analyzing muscle impact:', error);
            return reply.code(500).send({
                success: false,
                message: `Error analyzing muscle impact: ${error.message}`
            });
        }
    });

    // Get muscle activity data for chart
    fastify.get<{ Querystring: MuscleActivityQuery }>('/muscle-activity', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { period = '7_days' } = request.query;

            const sessionCookie = await getSessionCookie();

            if (!sessionCookie) {
                return reply.code(400).send({
                    success: false,
                    message: "Peloton session cookie not configured"
                });
            }

            const pelotonClient = new PelotonClient(sessionCookie);

            // Test the connection first
            const connectionTest = await pelotonClient.testConnection();
            if (!connectionTest.success) {
                return reply.code(401).send({
                    success: false,
                    message: `Unable to connect to Peloton: ${connectionTest.details}`
                });
            }

            // Get muscle activity data
            const muscleActivityData = await pelotonClient.getMuscleActivityData(period);

            return {
                success: true,
                muscleActivityData
            };
        } catch (error: any) {
            console.error('Error fetching muscle activity data:', error);
            return reply.code(500).send({
                success: false,
                message: `Error fetching muscle activity data: ${error.message}`
            });
        }
    });

    // Get muscle chart data
    fastify.get<{ Querystring: MuscleActivityQuery }>('/muscle-chart', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { period = '7_days' } = request.query;
            const days = period === '7_days' ? 7 : 30;

            const sessionCookie = await getSessionCookie();

            if (!sessionCookie) {
                return reply.code(400).send({
                    success: false,
                    error: "Peloton session cookie not configured"
                });
            }

            const pelotonClient = new PelotonClient(sessionCookie);

            // Test the connection first
            const connectionTest = await pelotonClient.testConnection();
            if (!connectionTest.success) {
                return reply.code(401).send({
                    success: false,
                    error: `Unable to connect to Peloton: ${connectionTest.details}`
                });
            }

            // Get muscle activity data
            const muscleActivityData = await pelotonClient.getMuscleActivityData(period);

            if (Object.keys(muscleActivityData).length === 0) {
                return {
                    success: true,
                    data: [],
                    error: `No workout data found for the last ${days} days`
                };
            }

            // Transform data into the expected format for the chart
            const chartData = Object.entries(muscleActivityData).map(([muscle, percentage]) => ({
                muscle,
                percentage: percentage as number
            }));

            // Sort by percentage descending
            chartData.sort((a, b) => b.percentage - a.percentage);

            return {
                success: true,
                data: chartData
            };
        } catch (error: any) {
            console.error('Error fetching muscle chart data:', error);
            return reply.code(500).send({
                success: false,
                error: `Error fetching muscle chart data: ${error.message}`
            });
        }
    });
}

/**
 * Get muscle groups worked by fitness discipline
 * Helper function for the route handler
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