import {
    fastify,
    FastifyRequest,
    FastifyReply,
    FastifyError,
    FastifyInstance
} from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import fastifyCors from '@fastify/cors';
import fastifySession from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import fastifyOauth2 from '@fastify/oauth2';
import { Type } from '@sinclair/typebox';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { DexcomService } from './services/dexcom.service';

// Extend the Session interface to include our custom properties
declare module '@fastify/session' {
    interface SessionData {
        codeVerifier?: string;
        state?: string;
    }
}

// Configure dotenv
const envPath = path.join(__dirname, '..', '.env');
console.log('Current working directory:', process.cwd());
console.log('.env path:', envPath);
console.log('.env exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    console.log('\nContents of .env file:');
    console.log(fs.readFileSync(envPath, 'utf8'));
}

dotenv.config({ path: envPath });

// Log environment variables
console.log('\nLoaded environment variables:');
Object.entries(process.env).forEach(([key, value]) => {
    if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
        console.log(`${key}: [HIDDEN]`);
    } else {
        console.log(`${key}: ${value}`);
    }
});

// Create Fastify instance with TypeBox
const app: FastifyInstance = fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        },
    },
    ajv: {
        customOptions: {
            removeAdditional: 'all',
            coerceTypes: true,
            useDefaults: true,
        }
    }
}).withTypeProvider<TypeBoxTypeProvider>();

// Register plugins
app.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
});

app.register(fastifyCookie);
app.register(fastifySession, {
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

// Initialize services
const dexcomService = new DexcomService();

// Define route schemas
const StatusResponse = Type.Object({
    isAuthenticated: Type.Boolean(),
    timestamp: Type.String()
});

const ErrorResponse = Type.Object({
    error: Type.String(),
    details: Type.Optional(Type.String())
});

// Add global error handler
app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    app.log.error(error);
    reply.status(500).send({
        error: 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Add 404 handler
app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
        error: 'Not Found',
        details: `Route ${request.method}:${request.url} not found`
    });
});

// Health check endpoint
app.get('/health', {
    schema: {
        response: {
            200: Type.Object({
                status: Type.String(),
                timestamp: Type.String()
            })
        }
    }
}, async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString()
    };
});

// Dexcom OAuth routes
app.get('/auth/dexcom/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        app.log.info('Initiating Dexcom OAuth flow...');
        const { url, codeVerifier, state } = await dexcomService.getAuthUrl();

        // Store PKCE and state in session
        request.session.codeVerifier = codeVerifier;
        request.session.state = state;

        app.log.info({ url }, 'Redirecting to Dexcom authorization URL');
        return reply.redirect(url);
    } catch (error) {
        app.log.error(error, 'Error initiating OAuth flow');
        return reply.status(500).send({ error: 'Failed to initiate OAuth flow' });
    }
});

app.get('/auth/dexcom/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as { code?: string, state?: string };
    app.log.info({ code: code ? (code.substring(0, 8) + '...') : 'missing', state: state || 'missing' }, 'Received callback');

    if (!code || !state) {
        app.log.error('Missing authorization code or state');
        return reply.status(400).send({ error: 'Missing authorization code or state' });
    }

    // Get code verifier from session
    const codeVerifier = request.session.codeVerifier;
    const sessionState = request.session.state;

    app.log.info({
        hasCodeVerifier: !!codeVerifier,
        codeVerifierValue: codeVerifier ? 'present' : 'missing',
        hasSessionState: !!sessionState,
        sessionStateValue: sessionState || 'missing',
        stateMatches: state === sessionState
    }, 'Session data check');

    if (!codeVerifier) {
        app.log.error('Missing code verifier in session');
        return reply.status(400).send({ error: 'Missing code verifier in session' });
    }

    if (!sessionState || state !== sessionState) {
        app.log.error('State mismatch or missing session state');
        return reply.status(400).send({ error: 'State mismatch or missing session state' });
    }

    try {
        app.log.info('Calling dexcomService.handleCallback with code, codeVerifier, and state');
        const success = await dexcomService.handleCallback(
            code,
            codeVerifier,
            state
        );

        if (success) {
            app.log.info('Successfully authenticated with Dexcom');
            // Clear session data
            request.session.codeVerifier = undefined;
            request.session.state = undefined;
            return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?auth=success`);
        } else {
            app.log.error('Failed to authenticate with Dexcom');
            return reply.status(401).send({ error: 'Authentication failed' });
        }
    } catch (error) {
        app.log.error(error, 'Error in Dexcom callback');
        return reply.status(500).send({ error: 'Internal server error during authentication' });
    }
});

app.get('/auth/dexcom/status', {
    schema: {
        response: {
            200: StatusResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        app.log.info('Checking Dexcom auth status...');
        const status = {
            isAuthenticated: dexcomService.isAuthenticated,
            timestamp: new Date().toISOString()
        };
        app.log.info(status, 'Auth status');
        return status;
    } catch (error) {
        app.log.error(error, 'Error checking auth status');
        return reply.status(500).send({
            error: 'Failed to check authentication status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.post('/auth/dexcom/refresh', {
    schema: {
        response: {
            200: Type.Object({
                success: Type.Boolean()
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        app.log.info('Attempting to refresh Dexcom token...');
        const success = await dexcomService.refreshToken();
        if (success) {
            app.log.info('Successfully refreshed token');
            return { success: true };
        } else {
            app.log.error('Failed to refresh token');
            return reply.status(401).send({ error: 'Failed to refresh token' });
        }
    } catch (error) {
        app.log.error(error, 'Error refreshing token');
        return reply.status(500).send({
            error: 'Internal server error while refreshing token',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Dexcom data routes
app.get('/api/dexcom/readings', {
    schema: {
        querystring: Type.Object({
            count: Type.Optional(Type.Number({ default: 48 }))
        }),
        response: {
            200: Type.Array(Type.Object({
                value: Type.Number(),
                trend: Type.String(),
                timestamp: Type.String()
            })),
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Querystring: {
        count?: number;
    }
}>) => {
    const { count } = request.query;
    app.log.info({ count }, 'Fetching glucose readings');
    return dexcomService.getLatestReadings(count);
});

app.get('/api/dexcom/devices', {
    schema: {
        response: {
            200: Type.Array(Type.Object({
                lastUploadDate: Type.String(),
                transmitterId: Type.Optional(Type.String()),
                transmitterGeneration: Type.String(),
                displayDevice: Type.String(),
                displayApp: Type.Optional(Type.String())
            })),
            500: ErrorResponse
        }
    }
}, async () => {
    app.log.info('Fetching Dexcom devices');
    return dexcomService.getDevices();
});

// Start server
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3001');
        const address = await app.listen({ port, host: '0.0.0.0' });
        app.log.info(`Server running at ${address}`);
        app.log.info('\nAvailable routes:');
        app.log.info('Authentication:');
        app.log.info('- GET /auth/dexcom/login');
        app.log.info('- GET /auth/dexcom/callback');
        app.log.info('- GET /auth/dexcom/status');
        app.log.info('- POST /auth/dexcom/refresh');
        app.log.info('\nAPI:');
        app.log.info('- GET /api/dexcom/readings');
        app.log.info('- GET /api/dexcom/devices');
        app.log.info('- GET /health');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start(); 