import { FastifyRequest, FastifyReply } from 'fastify';

// Simple in-memory store for rate limiting
interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

const rateLimitStore: RateLimitStore = {};

// Configuration for different endpoints
const endpointLimits: { [path: string]: number } = {
    '/api/peloton/': 10,          // 10 requests per window for all Peloton endpoints
    '/api/peloton/test-connection': 3,  // 3 requests per window for test connection
    '/auth/peloton/refresh': 1,    // 1 request per window for token refresh
};

// Time window in milliseconds (5 minutes)
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Rate limiting middleware for Peloton API requests
 * Limits requests based on the client's IP and the endpoint being accessed
 */
export async function rateLimitPelotonRequests(request: FastifyRequest, reply: FastifyReply) {
    // Skip for non-Peloton routes
    if (!request.url.includes('/peloton')) {
        return;
    }

    // Get client IP, or use a default for local development
    const clientIp = request.ip || request.socket.remoteAddress || 'unknown';

    // Get the appropriate limit based on the endpoint
    let limit = endpointLimits['/api/peloton/']; // Default limit

    // Check for more specific endpoint limits
    Object.keys(endpointLimits).forEach(path => {
        if (request.url.startsWith(path) && path !== '/api/peloton/') {
            limit = endpointLimits[path];
        }
    });

    // Create a unique key for this client and endpoint
    const path = request.url.split('?')[0]; // Remove query parameters
    const key = `${clientIp}:${path}`;

    const now = Date.now();

    // Initialize or reset if window has expired
    if (!rateLimitStore[key] || now > rateLimitStore[key].resetTime) {
        rateLimitStore[key] = {
            count: 1,
            resetTime: now + WINDOW_MS
        };
        return;
    }

    // Increment request count
    rateLimitStore[key].count++;

    // Check if limit exceeded
    if (rateLimitStore[key].count > limit) {
        const resetTime = new Date(rateLimitStore[key].resetTime);

        // Set rate limit headers
        reply.header('X-RateLimit-Limit', limit);
        reply.header('X-RateLimit-Remaining', 0);
        reply.header('X-RateLimit-Reset', Math.floor(rateLimitStore[key].resetTime / 1000));
        reply.header('Retry-After', Math.ceil((rateLimitStore[key].resetTime - now) / 1000));

        return reply.code(429).send({
            success: false,
            message: `Rate limit exceeded. Try again after ${resetTime.toLocaleTimeString()}`,
            retryAfter: Math.ceil((rateLimitStore[key].resetTime - now) / 1000)
        });
    }

    // Set rate limit headers for successful requests
    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', limit - rateLimitStore[key].count);
    reply.header('X-RateLimit-Reset', Math.floor(rateLimitStore[key].resetTime / 1000));
}

/**
 * Cleanup function to prevent memory leaks
 * Should be called periodically (e.g., via a cron job)
 */
export function cleanupRateLimitStore() {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach(key => {
        if (now > rateLimitStore[key].resetTime) {
            delete rateLimitStore[key];
        }
    });
}

// Set up automatic cleanup every hour
setInterval(cleanupRateLimitStore, 60 * 60 * 1000); 