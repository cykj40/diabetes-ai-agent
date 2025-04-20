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
import { BloodSugarEmbeddingService } from './services/blood-sugar-embedding.service';
import { debounce } from 'lodash';
import aiRoutes from './routes/ai.routes';
import axios from 'axios';
import authRoutes from './routes/auth.routes';
import pelotonRoutes from './routes/peloton.routes';
import { authenticate } from './middleware/auth.middleware';
import { rateLimitPelotonRequests } from './middleware/rate-limit.middleware';

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
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5500',
        'http://localhost:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-PINGOTHER'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400
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
const bloodSugarEmbeddingService = new BloodSugarEmbeddingService();

// Initialize the embedding service when the server starts
(async () => {
    try {
        await bloodSugarEmbeddingService.initialize();
        app.log.info('Blood Sugar Embedding Service initialized successfully');
    } catch (error) {
        app.log.error(error, 'Failed to initialize Blood Sugar Embedding Service');
    }
})();

// Register AI routes
app.register(aiRoutes, { prefix: '/api/ai' });

// Register auth routes
app.register(authRoutes, { prefix: '/api/auth' });

// Register Peloton routes
app.register(pelotonRoutes, { prefix: '/api/peloton' });

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
            isAuthenticated: isDexcomAuthenticated(),
            timestamp: new Date().toISOString()
        };
        app.log.info(status, 'Auth status');
        return status;
    } catch (error) {
        app.log.error(error, 'Error checking auth status');
        return reply.status(500).send({
            error: 'Failed to check authentication status',
            message: error instanceof Error ? error.message : 'Unknown error'
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
}>, reply: FastifyReply) => {
    try {
        const { count = 48 } = request.query;
        app.log.info({ count }, 'Fetching glucose readings');

        // Check if authenticated with Dexcom
        if (!isDexcomAuthenticated()) {
            // If not authenticated, generate mock readings
            app.log.info('Not authenticated with Dexcom, generating mock readings');
            return generateMockReadings(count);
        }

        // Use getV3EGVs instead of getLatestReadings
        return await dexcomService.getV3EGVs(count);
    } catch (error) {
        app.log.error('Error fetching glucose readings:', error);
        // Return mock readings if there's an error
        app.log.info('Falling back to mock readings due to error');
        const mockCount = request.query.count || 48;
        return generateMockReadings(mockCount);
    }
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
        if (!isDexcomAuthenticated()) {
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
        if (!isDexcomAuthenticated()) {
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
        if (!isDexcomAuthenticated()) {
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
        if (!isDexcomAuthenticated()) {
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
        if (!isDexcomAuthenticated()) {
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
        if (!isDexcomAuthenticated()) {
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

// Get Dexcom alerts
app.get('/api/dexcom/alerts', {
    schema: {
        querystring: Type.Object({
            startDate: Type.Optional(Type.String()),
            endDate: Type.Optional(Type.String())
        })
    }
}, async (request: FastifyRequest<{
    Querystring: {
        startDate?: string;
        endDate?: string;
    }
}>, reply: FastifyReply) => {
    try {
        app.log.info('Fetching Dexcom alerts');

        // Check if authenticated
        if (!isDexcomAuthenticated()) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        // Convert string dates to Date objects
        const endDate = request.query.endDate ? new Date(request.query.endDate) : new Date();
        const startDate = request.query.startDate ? new Date(request.query.startDate) : new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // Default to 24 hours ago

        const alerts = await dexcomService.getAlerts(startDate, endDate);
        app.log.info(`Successfully fetched ${alerts.length} alerts`);

        return { records: alerts };
    } catch (error) {
        app.log.error('Error fetching alerts:', error);
        return reply.code(500).send({
            error: 'Failed to fetch alerts',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Add this near the other Dexcom routes
app.get('/auth/dexcom/test', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        app.log.info('Testing Dexcom authentication...');

        // Check if authenticated
        const isAuthenticated = isDexcomAuthenticated();
        app.log.info({ isAuthenticated }, 'Current authentication status');

        if (isAuthenticated) {
            // Try to get some data to verify the token works
            try {
                const readings = await dexcomService.getLatestReadings(1);
                app.log.info({ readings }, 'Successfully retrieved readings');

                return {
                    status: 'authenticated',
                    tokenWorks: true,
                    readings
                };
            } catch (dataError) {
                app.log.error(dataError, 'Error retrieving data with token');

                // Try to refresh the token
                try {
                    app.log.info('Attempting to refresh token...');
                    const refreshed = await dexcomService.refreshToken();
                    app.log.info({ refreshed }, 'Token refresh result');

                    return {
                        status: 'authenticated',
                        tokenWorks: false,
                        refreshed,
                        error: dataError instanceof Error ? dataError.message : 'Unknown error'
                    };
                } catch (refreshError) {
                    app.log.error(refreshError, 'Error refreshing token');
                    return {
                        status: 'authenticated',
                        tokenWorks: false,
                        refreshed: false,
                        error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
                    };
                }
            }
        } else {
            return {
                status: 'not_authenticated',
                message: 'Please authenticate with Dexcom first'
            };
        }
    } catch (error) {
        app.log.error(error, 'Error in Dexcom test endpoint');
        return reply.status(500).send({
            error: 'Failed to test Dexcom authentication',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Add this helper function after the formatDexcomDate function
function isDexcomAuthenticated(): boolean {
    // Use a try-catch to safely access the isAuthenticated property
    try {
        // @ts-ignore - Accessing private property for compatibility
        return dexcomService.isAuthenticated;
    } catch (error) {
        console.error('Error checking Dexcom authentication status:', error);
        return false;
    }
}

// Track when we last processed readings for each user
const lastProcessedTimestamps: Record<string, number> = {};
const PROCESSING_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

// Debounced version of processAndStoreReadings to prevent repeated processing
export const debouncedProcessReadings = debounce(async (readings: any[], userId: string) => {
    const now = Date.now();
    const lastProcessed = lastProcessedTimestamps[userId] || 0;

    // Only process if we haven't processed in the last 30 minutes
    if (now - lastProcessed > PROCESSING_INTERVAL) {
        console.log(`Processing readings for user ${userId} - last processed ${Math.round((now - lastProcessed) / 60000)} minutes ago`);
        await bloodSugarEmbeddingService.processAndStoreReadings(readings, userId);
        lastProcessedTimestamps[userId] = now;
    } else {
        console.log(`Skipping processing for user ${userId} - last processed ${Math.round((now - lastProcessed) / 60000)} minutes ago`);
    }
}, 5000, { leading: true, trailing: false }); // Only process the first call within 5 seconds

// Helper function to format dates for Dexcom API
export function formatDexcomDate(date: Date): string {
    return date.toISOString().split('.')[0]; // Removes milliseconds and trailing Z
}

// Helper function to generate mock blood sugar readings for testing
export function generateMockReadings(count?: number): any[] {
    const readings = [];
    const now = new Date();

    if (count === 1) {
        // If only one reading is requested, just return the current one
        const value = Math.floor(Math.random() * 110) + 70; // Random between 70-180
        const trends = ['Flat', 'Rising', 'Falling', 'Rising Rapidly', 'Falling Rapidly'];
        const trend = trends[Math.floor(Math.random() * trends.length)];

        readings.push({
            value,
            trend,
            timestamp: formatDexcomDate(now),
            userId: 'default-user',
            source: 'mock' // Mark this as mock data
        });

        console.log('Generated 1 mock reading:', readings[0]);
        return readings;
    }

    // Otherwise generate a series of readings
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log('Generating mock readings from', formatDexcomDate(oneWeekAgo), 'to', formatDexcomDate(now));

    // Generate readings every 5 minutes for the past week
    for (let time = new Date(oneWeekAgo); time <= now; time = new Date(time.getTime() + 5 * 60000)) {
        // Generate a random blood sugar value between 70 and 180
        const value = Math.floor(Math.random() * 110) + 70;
        // Random trend
        const trends = ['Flat', 'Rising', 'Falling', 'Rising Rapidly', 'Falling Rapidly'];
        const trend = trends[Math.floor(Math.random() * trends.length)];

        readings.push({
            value,
            trend,
            timestamp: formatDexcomDate(time),
            userId: 'default-user',
            source: 'mock' // Mark this as mock data
        });
    }

    // If a specific count was requested, return only that many readings
    if (count && count > 1 && count < readings.length) {
        const result = readings.slice(-count); // Get the most recent 'count' readings
        console.log(`Generated ${result.length} mock readings (from ${readings.length} total)`);
        return result;
    }

    console.log(`Generated ${readings.length} mock readings`);
    return readings;
}

// Update the current-reading endpoint
app.get('/api/dexcom/current-reading', {
    schema: {
        response: {
            200: Type.Object({
                value: Type.Number(),
                trend: Type.String(),
                timestamp: Type.String(),
                source: Type.Optional(Type.String())
            }),
            404: Type.Object({
                error: Type.String(),
                message: Type.String()
            }),
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        app.log.info('Fetching current glucose reading');

        // Try to get the reading from the Share API first (real-time data)
        try {
            app.log.info('Trying to fetch from Dexcom Share API (real-time)');
            const shareReading = await dexcomService.getLatestShareReading();
            if (shareReading) {
                app.log.info('Successfully fetched reading from Share API:', shareReading);
                return shareReading;
            } else {
                app.log.info('No reading available from Share API, falling back to regular API');
            }
        } catch (shareError) {
            app.log.error('Error fetching from Share API, falling back to regular API:', shareError);
        }

        // Check if authenticated with regular Dexcom API
        if (!isDexcomAuthenticated()) {
            app.log.info('Not authenticated with Dexcom API, generating mock reading');
            const mockReadings = generateMockReadings(1);
            if (mockReadings.length > 0) {
                return mockReadings[0];
            } else {
                return reply.code(404).send({
                    error: 'No readings available',
                    message: 'Could not generate mock readings'
                });
            }
        }

        // Fall back to the regular API if Share API fails
        app.log.info('Falling back to regular Dexcom API (delayed data)');

        // Time window: 30 minutes ago to now (to account for Dexcom API delay)
        // Note: Dexcom API has a delay of up to 1 hour in the US and 3 hours internationally
        const now = new Date();
        const startDate = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

        // Format dates for Dexcom API
        const formattedStartDate = formatDexcomDate(startDate);
        const formattedEndDate = formatDexcomDate(now);

        app.log.info('Fetching readings with time window:', {
            startDate: formattedStartDate,
            endDate: formattedEndDate
        });

        // Use the dexcomService to get the most recent reading
        const reading = await dexcomService.getMostRecentReading();

        if (!reading) {
            return reply.code(404).send({
                error: 'No readings available',
                message: 'No glucose readings found in the specified time window'
            });
        }

        return reading;
    } catch (error) {
        app.log.error('Error fetching current glucose reading:', error);
        return reply.code(500).send({
            error: 'Failed to fetch current glucose reading',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Add more detailed CORS logging
app.addHook('onRequest', (request, reply, done) => {
    const origin = request.headers.origin;
    const method = request.method;

    if (origin) {
        console.log(`[CORS] Request from origin: ${origin}, method: ${method}, URL: ${request.url}`);
    }

    done();
});

// Add rate limiting middleware for Peloton endpoints
app.addHook('preHandler', async (request, reply) => {
    if (request.url.includes('/peloton')) {
        await rateLimitPelotonRequests(request, reply);
    }
});

// Add authentication middleware to all routes except those specifically excluded
app.addHook('preHandler', async (request, reply) => {
    // Skip auth for certain public routes
    const publicRoutes = [
        '/health',
        '/api/healthcheck',
        '/auth/dexcom/login',
        '/auth/dexcom/callback',
        '/auth/dexcom/status',
        '/api/auth/signin',
        '/api/auth/signup'
    ];

    // Check if the current route is public
    if (publicRoutes.some(route => request.url.startsWith(route))) {
        return;
    }

    // Apply authentication middleware
    await authenticate(request, reply);
});

// Add a simple health check endpoint that doesn't require auth
app.get('/api/healthcheck', (request, reply) => {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add the Dexcom direct auth endpoint
app.post('/auth/dexcom/direct', async (request: FastifyRequest<{ Body: { username: string; password: string } }>, reply: FastifyReply) => {
    try {
        const { username, password } = request.body;

        // Validate input
        if (!username || !password) {
            return reply.code(400).send({
                success: false,
                message: 'Username and password are required'
            });
        }

        app.log.info('Attempting direct Dexcom authentication');

        // Set environment variables temporarily for this request
        process.env.DEXCOM_SHARE_USERNAME = username;
        process.env.DEXCOM_SHARE_PASSWORD = password;

        // Try to get a session ID with these credentials
        const sessionId = await dexcomService.getShareSessionId();

        // Clear the environment variables
        process.env.DEXCOM_SHARE_USERNAME = undefined;
        process.env.DEXCOM_SHARE_PASSWORD = undefined;

        if (!sessionId) {
            app.log.error('Failed to authenticate with Dexcom Share API');
            return reply.code(401).send({
                success: false,
                message: 'Failed to authenticate with Dexcom Share. Check your credentials.'
            });
        }

        // Credentials worked! Save them to the permanent env file
        try {
            const envFile = path.join(__dirname, '..', '.env');
            let envContent = fs.readFileSync(envFile, 'utf8');

            // Update DEXCOM_SHARE_USERNAME in .env
            const usernameRegex = /DEXCOM_SHARE_USERNAME=.*/;
            if (usernameRegex.test(envContent)) {
                envContent = envContent.replace(usernameRegex, `DEXCOM_SHARE_USERNAME=${username}`);
            } else {
                envContent += `\nDEXCOM_SHARE_USERNAME=${username}`;
            }

            // Update DEXCOM_SHARE_PASSWORD in .env
            const passwordRegex = /DEXCOM_SHARE_PASSWORD=.*/;
            if (passwordRegex.test(envContent)) {
                envContent = envContent.replace(passwordRegex, `DEXCOM_SHARE_PASSWORD=${password}`);
            } else {
                envContent += `\nDEXCOM_SHARE_PASSWORD=${password}`;
            }

            // Write the updated content back to the .env file
            fs.writeFileSync(envFile, envContent);
            app.log.info('Saved Dexcom Share credentials to .env file');

            // Set the env vars again for the current process
            process.env.DEXCOM_SHARE_USERNAME = username;
            process.env.DEXCOM_SHARE_PASSWORD = password;

            return reply.send({
                success: true,
                message: 'Successfully authenticated with Dexcom Share'
            });
        } catch (fsError) {
            app.log.error(fsError, 'Error saving credentials to .env file');
            return reply.code(500).send({
                success: false,
                message: 'Authentication successful, but failed to save credentials'
            });
        }
    } catch (error) {
        app.log.error(error, 'Error in direct Dexcom authentication endpoint');
        return reply.code(500).send({
            success: false,
            message: 'Internal server error during authentication'
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
        app.log.info('- POST /api/auth/signup');
        app.log.info('- POST /api/auth/signin');
        app.log.info('- GET /api/auth/me');
        app.log.info('- POST /api/auth/signout');
        app.log.info('\nAPI:');
        app.log.info('- GET /api/dexcom/readings');
        app.log.info('- GET /api/dexcom/devices');
        app.log.info('- GET /api/dexcom/weekly-data');
        app.log.info('- GET /api/dexcom/device-data');
        app.log.info('- GET /api/dexcom/data-range');
        app.log.info('- GET /api/dexcom/events');
        app.log.info('- GET /api/dexcom/nutrition');
        app.log.info('- GET /api/dexcom/insulin');
        app.log.info('- GET /health');
        app.log.info('- GET /auth/dexcom/test');
        app.log.info('- POST /api/ai/analyze-blood-sugar');
        app.log.info('- POST /api/ai/embed-blood-sugar');
        app.log.info('- POST /api/ai/query-blood-sugar');
        app.log.info('- GET /api/ai/blood-sugar-insights/:timeframe?');
        app.log.info('- POST /api/ai/chat');
        app.log.info('- GET /api/ai/chat-history/:sessionId?');
        app.log.info('- DELETE /api/ai/chat-history/:sessionId?');
        app.log.info('\nPeloton:');
        app.log.info('- GET /api/peloton/test-connection');
        app.log.info('- GET /api/peloton/recent-workouts');
        app.log.info('- GET /api/peloton/muscle-impact');
        app.log.info('- GET /api/peloton/muscle-activity');
        app.log.info('- GET /api/peloton/muscle-chart');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start(); 