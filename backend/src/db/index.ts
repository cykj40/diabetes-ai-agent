import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { HealthData } from '../types/database';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
    try {
        return await sql(text, params) as T[];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

export const healthDataQueries = {
    createHealthData: async (clerkUserId: string, dataType: string, value: any): Promise<HealthData> => {
        const text = 'INSERT INTO health_data(clerk_user_id, data_type, value) VALUES($1, $2, $3) RETURNING *';
        const result = await query<HealthData>(text, [clerkUserId, dataType, value]);
        if (!result[0]) throw new Error('Failed to create health data');
        return result[0];
    },

    getUserHealthData: async (clerkUserId: string, dataType?: string): Promise<HealthData[]> => {
        const text = dataType
            ? 'SELECT * FROM health_data WHERE clerk_user_id = $1 AND data_type = $2 ORDER BY timestamp DESC'
            : 'SELECT * FROM health_data WHERE clerk_user_id = $1 ORDER BY timestamp DESC';
        return query<HealthData>(text, dataType ? [clerkUserId, dataType] : [clerkUserId]);
    }
}; 