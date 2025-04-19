import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthUser {
    id: string;
    email: string;
}

/**
 * Middleware to verify JWT token from Authorization header
 * Sets request.user if token is valid
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
        // Get Authorization header
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // For development, allow requests without a token
            if (process.env.NODE_ENV === 'development') {
                // Add default user to request for development
                (request as any).user = { id: 'default-user', email: 'dev@example.com' };
                return;
            }

            return reply.code(401).send({ error: 'Unauthorized - Missing or invalid Authorization header' });
        }

        // Extract token
        const token = authHeader.split(' ')[1];

        if (!token) {
            return reply.code(401).send({ error: 'Unauthorized - No token provided' });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as AuthUser;

            // Add user data to request
            (request as any).user = decoded;
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError);

            // For development, allow requests with invalid tokens
            if (process.env.NODE_ENV === 'development') {
                console.log('Development mode: Using default user despite invalid token');
                (request as any).user = { id: 'default-user', email: 'dev@example.com' };
                return;
            }

            return reply.code(401).send({ error: 'Unauthorized - Invalid token' });
        }
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return reply.code(500).send({ error: 'Internal server error' });
    }
} 