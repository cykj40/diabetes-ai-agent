import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import * as schema from './schema';
import { User, Session, HealthData } from '../types/database';

// Load environment variables
dotenv.config();

// Initialize Neon connection
const sql = neon(process.env.DATABASE_URL!);

// Create Drizzle client
export const db = drizzle(sql, { schema });

// Export all schema tables and relations
export * from './schema';

// User-related queries
export const userQueries = {
  // Get user by ID
  getUserById: async (userId: string): Promise<User | null> => {
    try {
      const result = await db.query.user.findFirst({
        where: eq(schema.user.id, userId),
      });
      return result || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  },

  // Get user by email
  getUserByEmail: async (email: string): Promise<User | null> => {
    try {
      const result = await db.query.user.findFirst({
        where: eq(schema.user.email, email),
      });
      return result || null;
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
      const [user] = await db.insert(schema.user).values(userData).returning();
      return user || null;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },
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
      const [session] = await db.insert(schema.session).values(sessionData).returning();
      return session || null;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  },

  // Delete a session
  deleteSession: async (sessionId: string): Promise<boolean> => {
    try {
      await db.delete(schema.session).where(eq(schema.session.id, sessionId));
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  },

  // Get session by ID
  getSessionById: async (sessionId: string): Promise<Session | null> => {
    try {
      const result = await db.query.session.findFirst({
        where: eq(schema.session.id, sessionId),
      });
      return result || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },
};

// Health data queries (placeholder)
export const healthDataQueries = {
  createHealthData: async (userId: string, dataType: string, value: any): Promise<HealthData | null> => {
    console.warn('healthDataQueries.createHealthData: Not implemented');
    return null;
  },

  getUserHealthData: async (userId: string, dataType?: string): Promise<HealthData[]> => {
    console.warn('healthDataQueries.getUserHealthData: Not implemented');
    return [];
  },
};

// Export all database functionality
export default {
  db,
  userQueries,
  sessionQueries,
  healthDataQueries,
};
