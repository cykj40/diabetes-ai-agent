import axios from 'axios';

const PELOTON_API_URL = 'https://api.onepeloton.com';

export interface PelotonWorkout {
    id: string;
    name: string;
    duration: number; // in seconds
    created_at: number; // Unix timestamp
    calories: number;
    fitness_discipline: string;
    instructor?: {
        name: string;
        id: string;
    };
}

export interface MuscleGroupData {
    [muscle: string]: number;
}

export class PelotonClient {
    private sessionCookie: string;

    constructor(sessionCookie: string) {
        this.sessionCookie = sessionCookie;
    }

    async getRecentWorkouts(limit: number = 10): Promise<PelotonWorkout[]> {
        try {
            console.log(`Fetching ${limit} recent Peloton workouts`);

            const response = await axios.get(`${PELOTON_API_URL}/api/user/me/workouts`, {
                params: {
                    limit,
                    joins: 'ride,instructor',
                    page: 0,
                    sort_by: '-created'
                },
                headers: {
                    Cookie: `peloton_session_id=${this.sessionCookie}`,
                    'User-Agent': 'DiabetesAgentAI/1.0',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
            });

            if (!response.data || !response.data.data) {
                throw new Error('Unexpected response format from Peloton API');
            }

            console.log(`Successfully fetched ${response.data.data.length} workouts`);

            return response.data.data.map((workout: any) => ({
                id: workout.id,
                name: workout.ride?.title || 'Unknown Workout',
                duration: workout.ride?.duration || 0,
                created_at: workout.created_at,
                calories: workout.total_work || 0,
                fitness_discipline: workout.fitness_discipline,
                instructor: workout.ride?.instructor ? {
                    name: workout.ride.instructor.name,
                    id: workout.ride.instructor.id
                } : undefined
            }));
        } catch (error) {
            console.error('Error fetching Peloton workouts:', error);
            throw new Error('Failed to fetch Peloton workouts');
        }
    }

    /**
     * Get muscle activity data from Peloton API
     * @param period Period to fetch data for (7_days or 30_days)
     * @returns Object with muscle groups and their activity percentages
     */
    async getMuscleActivityData(period: '7_days' | '30_days' = '7_days'): Promise<MuscleGroupData> {
        try {
            console.log(`Fetching muscle activity data for period: ${period}`);

            // Peloton's API doesn't directly provide this as a simple endpoint
            // Instead, we'll use our existing implementation to calculate muscle impact

            // Determine the number of days based on the period
            const days = period === '7_days' ? 7 : 30;

            // Calculate date range
            const now = new Date();
            const startDate = new Date(now);
            startDate.setDate(now.getDate() - days);

            // Get workouts for the period
            const workouts = await this.getRecentWorkouts(30); // Get more to filter by date

            // Filter to workouts in the date range
            const filteredWorkouts = workouts.filter(workout => {
                const workoutDate = new Date(workout.created_at * 1000);
                return workoutDate >= startDate && workoutDate <= now;
            });

            if (filteredWorkouts.length === 0) {
                console.log(`No workouts found for the ${period} period`);
                return {};
            }

            // Calculate muscle impact for each workout and aggregate
            const muscleGroups: Record<string, { score: number, workouts: number }> = {};

            filteredWorkouts.forEach(workout => {
                const workoutMuscles = this.getMuscleGroupsByDiscipline(
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

            // Convert the detailed data to the format expected by the chart
            // (just percentages for each muscle group)
            const muscleGroupPercentages: MuscleGroupData = {};

            // Get the total score to calculate percentages
            const totalScore = Object.values(muscleGroups).reduce((sum, group) => sum + group.score, 0);

            // Calculate percentage for each muscle group
            Object.entries(muscleGroups).forEach(([muscle, data]) => {
                // Skip non-visual muscles like "heart" and "mind" for the chart
                if (!['heart', 'mind', 'lungs', 'full_body'].includes(muscle)) {
                    muscleGroupPercentages[this.formatMuscleName(muscle)] = Math.round((data.score / totalScore) * 100);
                }
            });

            console.log(`Successfully calculated muscle activity for ${Object.keys(muscleGroupPercentages).length} muscle groups`);

            return muscleGroupPercentages;
        } catch (error) {
            console.error('Error fetching muscle activity data:', error);
            throw new Error('Failed to fetch muscle activity data');
        }
    }

    /**
     * Format muscle name for display
     * @param name Muscle name
     * @returns Formatted muscle name
     */
    private formatMuscleName(name: string): string {
        return name
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Get muscle groups worked by fitness discipline
     * @param discipline Peloton fitness discipline
     * @param title Workout title for more specific analysis
     * @returns Object mapping muscle groups to intensity (0-10)
     */
    private getMuscleGroupsByDiscipline(discipline: string, title: string = ''): Record<string, number> {
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
     * Test the connection to the Peloton API
     * @returns Object indicating success status and details
     */
    async testConnection(): Promise<{ success: boolean; details: string }> {
        try {
            const response = await axios.get(`${PELOTON_API_URL}/api/user/me`, {
                headers: {
                    Cookie: `peloton_session_id=${this.sessionCookie}`,
                    'User-Agent': 'DiabetesAgentAI/1.0',
                    'Accept': 'application/json'
                }
            });

            if (response.status === 200 && response.data) {
                const username = response.data.username || 'unknown';
                return {
                    success: true,
                    details: `Successfully connected to Peloton API as user: ${username}`
                };
            } else {
                return {
                    success: false,
                    details: `User profile API call returned status: ${response.status}`
                };
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            return {
                success: false,
                details: `Failed to connect to Peloton: ${errorMessage}`
            };
        }
    }
}

/**
 * Get a fresh Peloton session cookie by authenticating with username and password
 * @returns The session cookie string or null if authentication fails
 */
export async function getPelotonSessionCookie(): Promise<string | null> {
    try {
        console.log('Getting fresh Peloton session cookie...');
        const username = process.env.PELOTON_USERNAME;
        const password = process.env.PELOTON_PASSWORD;

        if (!username || !password) {
            console.error('Peloton credentials not configured in environment variables');
            return null;
        }

        const response = await axios.post(`${PELOTON_API_URL}/auth/login`, {
            username_or_email: username,
            password: password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DiabetesAgentAI/1.0'
            }
        });

        if (!response.data || !response.data.session_id) {
            console.error('Failed to get session ID from Peloton response');
            return null;
        }

        const sessionId = response.data.session_id;
        console.log('Successfully retrieved new Peloton session cookie');
        return sessionId;
    } catch (error) {
        console.error('Error authenticating with Peloton:', error);
        return null;
    }
} 