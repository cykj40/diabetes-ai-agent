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
import { AIService } from './services/ai.service';
import { DiabetesAgent } from './services/diabetes-agent';

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
const aiService = new AIService();
const diabetesAgent = new DiabetesAgent();

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

app.get('/api/dexcom/weekly-data', {
    schema: {
        response: {
            200: Type.Object({
                labels: Type.Array(Type.String()),
                values: Type.Array(Type.Number()),
                trends: Type.Array(Type.String()),
                insights: Type.Array(Type.String())
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request, reply) => {
    try {
        app.log.info('Fetching weekly blood sugar data');

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        const weeklyData = await dexcomService.getWeeklyBloodSugarData();
        return weeklyData;
    } catch (error) {
        app.log.error('Error fetching weekly blood sugar data:', error);
        return reply.code(500).send({
            error: 'Failed to fetch weekly blood sugar data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get Dexcom device data and readings
app.get('/api/dexcom/device-data', {
    schema: {
        response: {
            200: Type.Object({
                devices: Type.Array(Type.Object({
                    lastUploadDate: Type.String(),
                    transmitterId: Type.Optional(Type.String()),
                    transmitterGeneration: Type.String(),
                    displayDevice: Type.String(),
                    displayApp: Type.Optional(Type.String())
                })),
                readings: Type.Array(Type.Object({
                    value: Type.Number(),
                    trend: Type.String(),
                    timestamp: Type.String()
                }))
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request, reply) => {
    try {
        app.log.info('Fetching Dexcom device data with readings');

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        const [devices, readings] = await Promise.all([
            dexcomService.getDevices(),
            dexcomService.getLatestReadings(48)
        ]);

        return {
            devices,
            readings
        };
    } catch (error) {
        app.log.error('Error fetching Dexcom device data:', error);
        return reply.code(500).send({
            error: 'Failed to fetch Dexcom device data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get Dexcom data range
app.get('/api/dexcom/data-range', {
    schema: {
        querystring: Type.Object({
            lastSyncTime: Type.Optional(Type.String())
        }),
        response: {
            200: Type.Object({
                recordType: Type.String(),
                recordVersion: Type.String(),
                userId: Type.String(),
                calibrations: Type.Optional(Type.Object({
                    start: Type.Object({
                        systemTime: Type.String(),
                        displayTime: Type.String()
                    }),
                    end: Type.Object({
                        systemTime: Type.String(),
                        displayTime: Type.String()
                    })
                })),
                egvs: Type.Optional(Type.Object({
                    start: Type.Object({
                        systemTime: Type.String(),
                        displayTime: Type.String()
                    }),
                    end: Type.Object({
                        systemTime: Type.String(),
                        displayTime: Type.String()
                    })
                })),
                events: Type.Optional(Type.Object({
                    start: Type.Object({
                        systemTime: Type.String(),
                        displayTime: Type.String()
                    }),
                    end: Type.Object({
                        systemTime: Type.String(),
                        displayTime: Type.String()
                    })
                }))
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Querystring: {
        lastSyncTime?: string;
    }
}>, reply: FastifyReply) => {
    try {
        app.log.info('Fetching Dexcom data range');

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        let lastSyncTime: Date | undefined;

        // Parse lastSyncTime query parameter if provided
        if (request.query.lastSyncTime) {
            lastSyncTime = new Date(request.query.lastSyncTime);
            app.log.info(`Using lastSyncTime: ${lastSyncTime.toISOString()}`);
        }

        const dataRange = await dexcomService.getDataRange(lastSyncTime);
        app.log.info('Successfully fetched data range');

        return dataRange;
    } catch (error) {
        app.log.error('Error fetching data range:', error);
        return reply.code(500).send({
            error: 'Failed to fetch data range',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get Dexcom events
app.get('/api/dexcom/events', {
    schema: {
        querystring: Type.Object({
            days: Type.Optional(Type.Number({ default: 7 }))
        }),
        response: {
            200: Type.Array(Type.Object({
                systemTime: Type.String(),
                displayTime: Type.String(),
                recordId: Type.String(),
                eventStatus: Type.String(),
                eventType: Type.String(),
                eventSubType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
                value: Type.String(),
                unit: Type.Optional(Type.Union([Type.String(), Type.Null()])),
                transmitterId: Type.String(),
                transmitterGeneration: Type.String(),
                displayDevice: Type.String()
            })),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Querystring: {
        days?: number;
    }
}>, reply: FastifyReply) => {
    try {
        const days = request.query.days || 7;
        app.log.info(`Fetching Dexcom events for the last ${days} days`);

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        const events = await dexcomService.getLatestEvents(days);
        app.log.info(`Successfully fetched ${events.length} events`);

        return events;
    } catch (error) {
        app.log.error('Error fetching events:', error);
        return reply.code(500).send({
            error: 'Failed to fetch events',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get nutrition data
app.get('/api/dexcom/nutrition', {
    schema: {
        querystring: Type.Object({
            days: Type.Optional(Type.Number({ default: 7 }))
        }),
        response: {
            200: Type.Object({
                dates: Type.Array(Type.String()),
                carbs: Type.Array(Type.Number())
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Querystring: {
        days?: number;
    }
}>, reply: FastifyReply) => {
    try {
        const days = request.query.days || 7;
        app.log.info(`Fetching nutrition data for the last ${days} days`);

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        const nutritionData = await dexcomService.getNutritionData(days);
        app.log.info(`Successfully fetched nutrition data for ${nutritionData.dates.length} days`);

        return nutritionData;
    } catch (error) {
        app.log.error('Error fetching nutrition data:', error);
        return reply.code(500).send({
            error: 'Failed to fetch nutrition data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get insulin data
app.get('/api/dexcom/insulin', {
    schema: {
        querystring: Type.Object({
            days: Type.Optional(Type.Number({ default: 7 }))
        }),
        response: {
            200: Type.Object({
                dates: Type.Array(Type.String()),
                fastActing: Type.Array(Type.Number()),
                longActing: Type.Array(Type.Number())
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Querystring: {
        days?: number;
    }
}>, reply: FastifyReply) => {
    try {
        const days = request.query.days || 7;
        app.log.info(`Fetching insulin data for the last ${days} days`);

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        const insulinData = await dexcomService.getInsulinData(days);
        app.log.info(`Successfully fetched insulin data for ${insulinData.dates.length} days`);

        return insulinData;
    } catch (error) {
        app.log.error('Error fetching insulin data:', error);
        return reply.code(500).send({
            error: 'Failed to fetch insulin data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// AI analysis endpoint
app.post('/api/ai/analyze-blood-sugar', {
    schema: {
        body: Type.Object({
            content: Type.String()
        }),
        response: {
            200: Type.Object({
                glucoseTrend: Type.String(),
                anomalyDetected: Type.Boolean(),
                anomalyDescription: Type.Optional(Type.String()),
                recommendations: Type.String(),
                summary: Type.String(),
                riskLevel: Type.Number()
            }),
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Body: {
        content: string;
    }
}>, reply: FastifyReply) => {
    try {
        app.log.info('Analyzing blood sugar data with AI');
        const result = await aiService.analyzeBloodSugar(request.body);
        return result;
    } catch (error) {
        app.log.error(error, 'Error analyzing blood sugar data');
        return reply.status(500).send({
            error: 'Failed to analyze blood sugar data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// AI Q&A endpoint
app.post('/api/ai/qa', {
    schema: {
        body: Type.Object({
            question: Type.String(),
            entries: Type.Array(Type.Object({
                id: Type.String(),
                content: Type.String(),
                createdAt: Type.String()
            }))
        }),
        response: {
            200: Type.Object({
                answer: Type.String()
            }),
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Body: {
        question: string;
        entries: Array<{ id: string; content: string; createdAt: string }>;
    }
}>, reply: FastifyReply) => {
    try {
        app.log.info('Processing Q&A with AI');

        // Convert string dates to Date objects
        const entries = request.body.entries.map(entry => ({
            ...entry,
            createdAt: new Date(entry.createdAt)
        }));

        const answer = await aiService.qa(request.body.question, entries);
        return { answer };
    } catch (error) {
        app.log.error(error, 'Error processing Q&A');
        return reply.status(500).send({
            error: 'Failed to process Q&A',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// AI Chat endpoint
app.post('/api/chat', {
    schema: {
        body: Type.Object({
            message: Type.String(),
            sessionId: Type.Optional(Type.String({ default: 'default' }))
        }),
        response: {
            200: Type.Object({
                response: Type.String(),
                sessionId: Type.String()
            }),
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Body: {
        message: string;
        sessionId?: string;
    }
}>, reply: FastifyReply) => {
    try {
        const { message, sessionId = 'default' } = request.body;
        app.log.info({ sessionId }, 'Processing chat message with AI');

        const result = await diabetesAgent.ask(message, sessionId);

        return {
            response: result.output,
            sessionId
        };
    } catch (error) {
        app.log.error(error, 'Error processing chat message');
        return reply.status(500).send({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
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
        app.log.info('- GET /api/dexcom/weekly-data');
        app.log.info('- GET /api/dexcom/device-data');
        app.log.info('- GET /api/dexcom/data-range');
        app.log.info('- GET /api/dexcom/events');
        app.log.info('- GET /api/dexcom/nutrition');
        app.log.info('- GET /api/dexcom/insulin');
        app.log.info('- POST /api/ai/analyze-blood-sugar');
        app.log.info('- POST /api/ai/qa');
        app.log.info('- POST /api/chat');
        app.log.info('- GET /health');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start(); 