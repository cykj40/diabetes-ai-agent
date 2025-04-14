import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { User, Session, HealthData } from '../types/database';

// Load environment variables
dotenv.config();

// Create Prisma client
const prisma = new PrismaClient();

// User-related queries
export const userQueries = {
    // Get user by ID
    getUserById: async (userId: string): Promise<User | null> => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });
            return user;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return null;
        }
    },

    // Get user by email
    getUserByEmail: async (email: string): Promise<User | null> => {
        try {
            const user = await prisma.user.findUnique({
                where: { email }
            });
            return user;
        } catch (error) {
            console.error('Error getting user by email:', error);
            return null;
        }
    },

    // Create a new user
    createUser: async (userData: {
        id: string;
        email: string;
        password: string;
    }): Promise<User | null> => {
        try {
            const user = await prisma.user.create({
                data: userData
            });
            return user;
        } catch (error) {
            console.error('Error creating user:', error);
            return null;
        }
    }
};

// Session-related queries
export const sessionQueries = {
    // Create a new session
    createSession: async (sessionData: {
        id: string;
        userId: string;
        expiresAt: Date;
    }): Promise<Session | null> => {
        try {
            const session = await prisma.session.create({
                data: sessionData
            });
            return session;
        } catch (error) {
            console.error('Error creating session:', error);
            return null;
        }
    },

    // Delete a session
    deleteSession: async (sessionId: string): Promise<boolean> => {
        try {
            await prisma.session.delete({
                where: { id: sessionId }
            });
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            return false;
        }
    },

    // Get session by ID
    getSessionById: async (sessionId: string): Promise<Session | null> => {
        try {
            const session = await prisma.session.findUnique({
                where: { id: sessionId }
            });
            return session;
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }
};

// Health data queries (reimplement using Prisma if you have a corresponding model)
export const healthDataQueries = {
    // Implement these if needed based on your Prisma models
    // For now, return empty implementations to maintain compatibility
    createHealthData: async (userId: string, dataType: string, value: any): Promise<HealthData | null> => {
        console.warn('healthDataQueries.createHealthData: Not implemented with Prisma');
        return null;
    },

    getUserHealthData: async (userId: string, dataType?: string): Promise<HealthData[]> => {
        console.warn('healthDataQueries.getUserHealthData: Not implemented with Prisma');
        return [];
    }
};

// Export all database functionality
export default {
    prisma,
    userQueries,
    sessionQueries,
    healthDataQueries
}; 