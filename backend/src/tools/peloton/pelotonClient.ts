import axios from 'axios';

interface PelotonWorkout {
    id: string;
    created_at: number;
    start_time: number;
    end_time: number;
    total_work: number;
    fitness_discipline: string;
    ride: {
        title: string;
        duration: number;
        instructor: {
            name: string;
            id: string;
        };
    };
    metrics: {
        heart_rate: {
            average: number;
            max: number;
        };
        output: {
            average: number;
            max: number;
            total: number;
        };
        cadence: {
            average: number;
            max: number;
        };
        resistance: {
            average: number;
            max: number;
        };
    };
}

interface WorkoutDetails extends PelotonWorkout {
    metrics_data: {
        heart_rate: {
            values: { time: number; value: number }[];
        };
        output: {
            values: { time: number; value: number }[];
        };
        cadence: {
            values: { time: number; value: number }[];
        };
        resistance: {
            values: { time: number; value: number }[];
        };
    };
}

export class PelotonClient {
    private readonly baseUrl = 'https://api.onepeloton.com';
    private readonly sessionCookie: string;

    constructor(sessionCookie: string) {
        this.sessionCookie = sessionCookie;
    }

    /**
     * Get recent workouts from Peloton
     * @param limit Number of workouts to fetch
     * @returns Array of workout objects
     */
    async getRecentWorkouts(limit: number = 5): Promise<PelotonWorkout[]> {
        // Check if session is valid
        if (!this.sessionCookie) {
            throw new Error('Peloton session cookie is required');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/user/workouts`, {
                params: { limit, joins: 'ride' },
                headers: {
                    'Cookie': `peloton_session=${this.sessionCookie}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch workouts: ${response.statusText}`);
            }

            if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
                throw new Error('Unexpected response format from Peloton API');
            }

            return response.data.data;
        } catch (error) {
            console.error('Error fetching Peloton workouts:', error);
            throw new Error('Failed to fetch Peloton workouts');
        }
    }

    /**
     * Get details for a specific workout
     * @param workoutId ID of the workout to fetch
     * @returns Detailed workout information
     */
    async getWorkoutDetails(workoutId: string): Promise<WorkoutDetails> {
        // Check if session is valid
        if (!this.sessionCookie) {
            throw new Error('Peloton session cookie is required');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/workout/${workoutId}`, {
                params: { joins: 'ride,metrics_data' },
                headers: {
                    'Cookie': `peloton_session=${this.sessionCookie}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status !== 200) {
                throw new Error(`Failed to fetch workout details: ${response.statusText}`);
            }

            if (!response.data) {
                throw new Error('Unexpected response format from Peloton API');
            }

            return response.data;
        } catch (error) {
            console.error('Error fetching Peloton workout details:', error);
            throw new Error('Failed to fetch workout details');
        }
    }
} 