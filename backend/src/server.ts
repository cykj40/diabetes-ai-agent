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

// AI and Blood Sugar Embedding Routes
app.post('/api/ai/analyze-blood-sugar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const { content } = request.body as { content: string };

        if (!content) {
            return reply.status(400).send({ error: 'Content is required' });
        }

        const analysis = await aiService.analyzeBloodSugar({ content });
        return analysis;
    } catch (error) {
        app.log.error(error, 'Error analyzing blood sugar');
        return reply.status(500).send({ error: 'Failed to analyze blood sugar data' });
    }
});

app.post('/api/ai/embed-blood-sugar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // For now, use a default user ID since we don't have auth
        const userId = 'default-user';
        const { days = 7 } = request.body as { days?: number };

        // Fetch recent readings from Dexcom - get the last 288 readings (1 per 5 min = 288 per day)
        const count = days * 288;
        const readings = await dexcomService.getV3EGVs(count);

        if (!readings || readings.length === 0) {
            return reply.status(404).send({ message: 'No blood sugar readings found for the specified period' });
        }

        // Process and store readings in Pinecone
        await bloodSugarEmbeddingService.processAndStoreReadings(readings, userId);

        return {
            success: true,
            message: `Successfully embedded ${readings.length} blood sugar readings`,
            count: readings.length
        };
    } catch (error) {
        app.log.error(error, 'Error embedding blood sugar readings');
        return reply.status(500).send({ error: 'Failed to embed blood sugar readings' });
    }
});

app.post('/api/ai/query-blood-sugar', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // For now, use a default user ID since we don't have auth
        const userId = 'default-user';
        const { query, topK = 5 } = request.body as { query: string, topK?: number };

        if (!query) {
            return reply.status(400).send({ error: 'Query is required' });
        }

        const results = await bloodSugarEmbeddingService.querySimilarReadings(query, userId, topK);
        return results;
    } catch (error) {
        app.log.error(error, 'Error querying blood sugar readings');
        return reply.status(500).send({ error: 'Failed to query blood sugar readings' });
    }
});

app.get('/api/ai/blood-sugar-insights/:timeframe?', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // For now, use a default user ID since we don't have auth
        const userId = 'default-user';
        const { timeframe } = request.params as { timeframe?: 'day' | 'week' | 'month' };

        const insights = await bloodSugarEmbeddingService.generateBloodSugarInsights(userId, timeframe || 'week');
        return insights;
    } catch (error) {
        app.log.error(error, 'Error generating blood sugar insights');
        return reply.status(500).send({ error: 'Failed to generate blood sugar insights' });
    }
});

// Track when we last processed readings for each user
const lastProcessedTimestamps: Record<string, number> = {};
const PROCESSING_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

// Debounced version of processAndStoreReadings to prevent repeated processing
const debouncedProcessReadings = debounce(async (readings: any[], userId: string) => {
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

app.post('/api/ai/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        // For now, use a default user ID since we don't have auth
        const userId = 'default-user';
        const { message, sessionId } = request.body as { message: string, sessionId: string };

        if (!message) {
            return reply.status(400).send({ error: 'Message is required' });
        }

        if (!sessionId) {
            return reply.status(400).send({ error: 'Session ID is required' });
        }

        let readings = [];
        try {
            // Get recent readings from Dexcom - last 288 readings (1 day)
            readings = await dexcomService.getV3EGVs(288);

            // Process and store readings if available
            if (readings && readings.length > 0) {
                await debouncedProcessReadings(readings, userId);
            }
        } catch (dexcomError) {
            app.log.error('Error fetching Dexcom data:', dexcomError);
            // Continue without Dexcom data - don't let this stop the chat functionality
            console.log('Generating mock blood sugar data');
            // Generate some mock data for testing
            const mockReadings = generateMockReadings();
            if (mockReadings.length > 0) {
                console.log(`Found ${mockReadings.length} readings in the past week`);
                await debouncedProcessReadings(mockReadings, userId);
            }
        }

        // Get relevant blood sugar data based on the user's query
        const similarReadings = await bloodSugarEmbeddingService.querySimilarReadings(message, userId, 10);

        // Format the readings for the AI
        let contextData = '';
        if (similarReadings && similarReadings.length > 0) {
            contextData = 'Here is relevant blood sugar data:\n\n' +
                similarReadings.map((match: any) => {
                    const metadata = match.metadata;
                    return `Time: ${new Date(metadata.timestamp).toLocaleString()}, Value: ${metadata.value} mg/dL, Trend: ${metadata.trend}`;
                }).join('\n');
        }

        // Combine the user's message with the context data
        const fullPrompt = `${message}\n\n${contextData}`;

        // Get AI response
        const analysis = await aiService.analyzeBloodSugar({ content: fullPrompt });

        return {
            message: analysis.summary,
            recommendations: analysis.recommendations.split('\n').filter((r: string) => r.trim().length > 0),
            data: {
                glucoseTrend: analysis.glucoseTrend,
                anomalyDetected: analysis.anomalyDetected,
                anomalyDescription: analysis.anomalyDescription,
                riskLevel: analysis.riskLevel
            }
        };
    } catch (error) {
        app.log.error('Error processing chat message:', error);
        return reply.status(500).send({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Helper function to generate mock blood sugar readings for testing
function generateMockReadings() {
    const readings = [];
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Generate readings every 5 minutes for the past week
    for (let time = oneWeekAgo; time <= now; time = new Date(time.getTime() + 5 * 60000)) {
        // Generate a random blood sugar value between 70 and 180
        const value = Math.floor(Math.random() * 110) + 70;
        // Random trend
        const trends = ['Flat', 'Rising', 'Falling', 'Rising Rapidly', 'Falling Rapidly'];
        const trend = trends[Math.floor(Math.random() * trends.length)];

        readings.push({
            value,
            trend,
            timestamp: time.toISOString(),
            userId: 'default-user'
        });
    }

    return readings;
}

// Get chat history endpoint
app.get('/api/ai/chat-history/:sessionId', async (request: FastifyRequest<{
    Params: { sessionId: string }
}>, reply: FastifyReply) => {
    try {
        // For now, use a default user ID since we don't have auth
        const userId = 'default-user';
        const { sessionId } = request.params;

        if (!sessionId) {
            return reply.status(400).send({ error: 'Session ID is required' });
        }

        // Get chat history from the diabetes agent
        const chatHistory = await diabetesAgent.getChatHistory(`${userId}-${sessionId}`);

        // Format the chat history for the frontend
        const formattedHistory = chatHistory.map(msg => ({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            sender: msg._getType() === 'human' ? 'user' : 'ai',
            timestamp: new Date().toLocaleTimeString()
        }));

        return { chatHistory: formattedHistory };
    } catch (error) {
        app.log.error('Error fetching chat history:', error);
        return reply.status(500).send({
            error: 'Failed to fetch chat history',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Clear chat history endpoint
app.delete('/api/ai/chat-history/:sessionId', async (request: FastifyRequest<{
    Params: { sessionId: string }
}>, reply: FastifyReply) => {
    try {
        // For now, use a default user ID since we don't have auth
        const userId = 'default-user';
        const { sessionId } = request.params;

        if (!sessionId) {
            return reply.status(400).send({ error: 'Session ID is required' });
        }

        // Clear chat history from the diabetes agent
        await diabetesAgent.clearChatHistory(`${userId}-${sessionId}`);

        return { success: true, message: 'Chat history cleared successfully' };
    } catch (error) {
        app.log.error('Error clearing chat history:', error);
        return reply.status(500).send({
            error: 'Failed to clear chat history',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get Dexcom alerts
app.get('/api/dexcom/alerts', {
    schema: {
        querystring: Type.Object({
            startDate: Type.String(),
            endDate: Type.String()
        }),
        response: {
            200: Type.Object({
                recordType: Type.String(),
                recordVersion: Type.String(),
                userId: Type.String(),
                records: Type.Array(Type.Object({
                    recordId: Type.String(),
                    systemTime: Type.String(),
                    displayTime: Type.String(),
                    alertName: Type.String(),
                    alertState: Type.String(),
                    displayDevice: Type.String(),
                    transmitterGeneration: Type.String(),
                    transmitterId: Type.String(),
                    displayApp: Type.Optional(Type.String())
                }))
            }),
            401: ErrorResponse,
            500: ErrorResponse
        }
    }
}, async (request: FastifyRequest<{
    Querystring: {
        startDate: string;
        endDate: string;
    }
}>, reply: FastifyReply) => {
    try {
        const { startDate, endDate } = request.query;
        app.log.info(`Fetching Dexcom alerts from ${startDate} to ${endDate}`);

        // Check if authenticated
        if (!dexcomService.isAuthenticated) {
            return reply.code(401).send({
                error: 'Not authenticated with Dexcom',
                message: 'Please connect your Dexcom account'
            });
        }

        const alertsResponse = await dexcomService.getAlerts(startDate, endDate);
        app.log.info(`Successfully fetched ${alertsResponse.records.length} alerts`);

        return alertsResponse;
    } catch (error) {
        app.log.error('Error fetching alerts:', error);
        return reply.code(500).send({
            error: 'Failed to fetch alerts',
            message: error instanceof Error ? error.message : 'Unknown error'
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
        app.log.info('- POST /api/ai/embed-blood-sugar');
        app.log.info('- POST /api/ai/query-blood-sugar');
        app.log.info('- GET /api/ai/blood-sugar-insights/:timeframe?');
        app.log.info('- POST /api/ai/chat');
        app.log.info('- GET /api/ai/chat-history/:sessionId');
        app.log.info('- DELETE /api/ai/chat-history/:sessionId');
        app.log.info('- GET /health');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start(); 