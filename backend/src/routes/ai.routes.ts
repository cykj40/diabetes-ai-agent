import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/ai.service';
import { BloodSugarEmbeddingService } from '../services/blood-sugar-embedding.service';
import { DexcomService } from '../services/dexcom.service';
import { DiabetesAgent } from '../services/diabetes-agent';
import { AgentService } from '../services/agent.service';
import { formatDexcomDate, generateMockReadings, debouncedProcessReadings } from '../server';
import { PrismaClient } from '@prisma/client';
import { BaseMessage } from '@langchain/core/messages';

// Create a Prisma client instance
const prisma = new PrismaClient();

// Define route parameter types
interface ChatParams {
    sessionId?: string;
}

// Define request body types
interface AnalyzeBloodSugarBody {
    content: string;
}

interface EmbedBloodSugarBody {
    days?: number;
}

interface QueryBloodSugarBody {
    query: string;
    topK?: number;
}

interface ChatBody {
    message: string;
    sessionId?: string;
    useWebSearch?: boolean;
}

// Define request body types for updating chat sessions
interface UpdateSessionBody {
    title: string;
    userId?: string;
}

export default async function aiRoutes(fastify: FastifyInstance) {
    const aiService = new AIService();
    const bloodSugarEmbeddingService = new BloodSugarEmbeddingService();
    const dexcomService = new DexcomService();
    const diabetesAgent = new DiabetesAgent();
    const agentService = new AgentService();

    // Initialize the embedding service when the server starts
    try {
        await bloodSugarEmbeddingService.initialize();
        console.log('Blood Sugar Embedding Service initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Blood Sugar Embedding Service:', error);
    }

    // Endpoint to analyze blood sugar data
    fastify.post<{ Body: AnalyzeBloodSugarBody }>('/analyze-blood-sugar', async (request, reply) => {
        try {
            const { content } = request.body;

            if (!content) {
                return reply.code(400).send({ error: 'Content is required' });
            }

            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const analysis = await aiService.analyzeBloodSugar({ content });
            return analysis;
        } catch (error) {
            console.error('Error analyzing blood sugar:', error);
            return reply.code(500).send({ error: 'Failed to analyze blood sugar data' });
        }
    });

    // Endpoint to fetch and embed recent blood sugar readings
    fastify.post<{ Body: EmbedBloodSugarBody }>('/embed-blood-sugar', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { days = 7 } = request.body;

            let readings = [];
            try {
                // Get recent readings from Dexcom - last 288 readings (1 day)
                readings = await dexcomService.getV3EGVs(288);
                console.log(`Retrieved ${readings.length} readings from Dexcom`);

                // Process and store readings if available
                if (readings && readings.length > 0) {
                    await debouncedProcessReadings(readings, userId);
                }
            } catch (dexcomError: any) {
                console.error('Error fetching Dexcom data:', dexcomError);

                // Log detailed error information if available
                if (dexcomError.response) {
                    console.error('Dexcom API response status:', dexcomError.response.status);
                    console.error('Dexcom API response data:', dexcomError.response.data);
                }

                // Continue without Dexcom data - don't let this stop the functionality
                console.log('Generating mock blood sugar data');

                // Generate some mock data for testing
                const mockReadings = generateMockReadings();
                if (mockReadings.length > 0) {
                    console.log(`Generated ${mockReadings.length} mock readings`);
                    try {
                        await debouncedProcessReadings(mockReadings, userId);
                    } catch (processingError) {
                        console.error('Error processing mock readings:', processingError);
                        // Continue even if processing fails
                    }
                }
            }

            return {
                success: true,
                message: `Successfully embedded blood sugar readings`,
                count: readings.length
            };
        } catch (error) {
            console.error('Error embedding blood sugar readings:', error);
            return reply.code(500).send({ error: 'Failed to embed blood sugar readings' });
        }
    });

    // Endpoint to query similar blood sugar readings
    fastify.post<{ Body: QueryBloodSugarBody }>('/query-blood-sugar', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { query, topK = 5 } = request.body;

            if (!query) {
                return reply.code(400).send({ error: 'Query is required' });
            }

            const results = await bloodSugarEmbeddingService.querySimilarReadings(query, userId, topK);
            return results;
        } catch (error) {
            console.error('Error querying blood sugar readings:', error);
            return reply.code(500).send({ error: 'Failed to query blood sugar readings' });
        }
    });

    // Endpoint to generate blood sugar insights
    fastify.get<{ Params: { timeframe?: 'day' | 'week' | 'month' } }>('/blood-sugar-insights/:timeframe?', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const timeframe = request.params.timeframe || 'week';

            const insights = await bloodSugarEmbeddingService.generateBloodSugarInsights(userId, timeframe);
            return insights;
        } catch (error) {
            console.error('Error generating blood sugar insights:', error);
            return reply.code(500).send({ error: 'Failed to generate blood sugar insights' });
        }
    });

    // Unified AI chat endpoint using DiabetesAgent
    fastify.post<{ Body: ChatBody }>('/chat', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { message, sessionId = 'default' } = request.body;

            if (!message) {
                return reply.code(400).send({ error: 'Message is required' });
            }

            // Use the DiabetesAgent to process the message
            const fullSessionId = `${userId}-${sessionId}`;
            const result = await diabetesAgent.ask(message, fullSessionId);

            // Get the chat history to include in the response
            const chatHistory = await diabetesAgent.getChatHistory(fullSessionId);

            // Format the response for the frontend
            const response = {
                message: result.output,
                chatHistory: chatHistory.map(msg => ({
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                    text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    sender: msg._getType() === 'human' ? 'user' : 'ai',
                    timestamp: new Date().toLocaleTimeString()
                })),
                sessionId: fullSessionId
            };

            return response;
        } catch (error) {
            console.error('Error processing chat message:', error);
            return reply.code(500).send({
                error: 'Failed to process chat message',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Agent API endpoint with tool calls
    fastify.post<{ Body: ChatBody }>('/agent', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                // Try to get userId from token, but don't fail if token is invalid
                try {
                    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
                    // You could validate the token here if needed
                    // For now, we'll just use the token as the userId or a default
                    userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
                } catch (error) {
                    console.warn('Failed to process authorization token:', error);
                    // Continue with default user
                }
            }

            // Extract parameters from request
            const { message, sessionId = 'default', useWebSearch = false } = request.body;

            if (!message) {
                return reply.code(400).send({ error: 'Message is required' });
            }

            // Use the AgentService to process the message with tool calls
            const result = await agentService.ask(message, userId, sessionId, useWebSearch);

            // Format the response for the frontend
            const response = {
                message: result.message,
                chatHistory: result.chatHistory.map((msg: any) => ({
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                    text: typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text),
                    sender: msg.sender === 'user' ? 'user' : 'ai',
                    timestamp: new Date().toLocaleTimeString()
                })),
                sessionId: result.sessionId
            };

            return response;
        } catch (error) {
            console.error('Error processing agent message:', error);
            return reply.code(500).send({
                error: 'Failed to process agent message',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Endpoint to get all chat sessions for a user
    fastify.get('/chat-sessions', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            // Get all sessions for this user by querying distinct sessionIds
            const sessionIds = await prisma.$queryRaw`
                SELECT DISTINCT 
                    "sessionId" as id,
                    (
                        SELECT content 
                        FROM "ChatMessage" 
                        WHERE "sessionId" = cm."sessionId" AND type = 'human' 
                        ORDER BY timestamp ASC 
                        LIMIT 1
                    ) as title,
                    MAX(timestamp) as timestamp
                FROM "ChatMessage" cm
                WHERE "sessionId" LIKE ${`${userId}-%`}
                GROUP BY "sessionId"
                ORDER BY MAX(timestamp) DESC
            `;

            return sessionIds;
        } catch (error) {
            console.error('Error fetching chat sessions:', error);
            return reply.code(500).send({
                error: 'Failed to fetch chat sessions',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Endpoint to get chat history for a session
    fastify.get<{ Params: ChatParams }>('/chat-history/:sessionId', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { sessionId = 'default' } = request.params;
            const fullSessionId = `${userId}-${sessionId}`;

            // Get the chat history from the database
            const messages = await prisma.chatMessage.findMany({
                where: { sessionId: fullSessionId },
                orderBy: { timestamp: 'asc' },
            });

            // Format messages for the frontend
            const formattedMessages = messages.map((msg) => ({
                id: msg.id,
                text: msg.content,
                sender: msg.type === 'human' ? 'user' : 'ai',
                timestamp: new Date(msg.timestamp).toLocaleTimeString()
            }));

            return { messages: formattedMessages };
        } catch (error) {
            console.error('Error fetching chat history:', error);
            return reply.code(500).send({
                error: 'Failed to fetch chat history',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Endpoint to delete chat history for a session
    fastify.delete<{ Params: ChatParams }>('/chat-history/:sessionId', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { sessionId = 'default' } = request.params;
            const fullSessionId = `${userId}-${sessionId}`;

            // Delete all messages for this session
            await prisma.chatMessage.deleteMany({
                where: { sessionId: fullSessionId },
            });

            return { success: true, message: 'Chat history cleared successfully' };
        } catch (error) {
            console.error('Error clearing chat history:', error);
            return reply.code(500).send({
                error: 'Failed to clear chat history',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Endpoint to update a chat session
    fastify.put<{ Params: ChatParams, Body: UpdateSessionBody }>('/chat-sessions/:sessionId', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { sessionId = 'default' } = request.params;
            const { title } = request.body;
            const fullSessionId = `${userId}-${sessionId}`;

            if (!title) {
                return reply.code(400).send({ error: 'Title is required' });
            }

            // Check if we have any messages for this session
            const existingMessages = await prisma.chatMessage.findFirst({
                where: { sessionId: fullSessionId }
            });

            if (!existingMessages) {
                // No messages exist for this session yet, create a system message to save the title
                await prisma.chatMessage.create({
                    data: {
                        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        content: title,
                        type: 'system',
                        sessionId: fullSessionId,
                        timestamp: new Date()
                    }
                });
            } else {
                // Try to update the session name by adding a system message
                await prisma.chatMessage.create({
                    data: {
                        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        content: `Session renamed to: ${title}`,
                        type: 'system',
                        sessionId: fullSessionId,
                        timestamp: new Date()
                    }
                });
            }

            return { success: true, message: 'Chat session updated successfully', sessionId: fullSessionId };
        } catch (error) {
            console.error('Error updating chat session:', error);
            return reply.code(500).send({
                error: 'Failed to update chat session',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Endpoint to delete a chat session
    fastify.delete<{ Params: ChatParams }>('/chat-sessions/:sessionId', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                userId = authHeader.substring(7); // Remove 'Bearer ' prefix
            }

            const { sessionId = 'default' } = request.params;
            const fullSessionId = `${userId}-${sessionId}`;

            // Delete all messages for this session
            await prisma.chatMessage.deleteMany({
                where: { sessionId: fullSessionId },
            });

            return { success: true, message: 'Chat history cleared successfully' };
        } catch (error) {
            console.error('Error clearing chat history:', error);
            return reply.code(500).send({
                error: 'Failed to clear chat history',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
} 