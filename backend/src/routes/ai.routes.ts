import express from 'express';
import { AIService } from '../services/ai.service';
import { BloodSugarEmbeddingService } from '../services/blood-sugar-embedding.service';
import { DexcomService } from '../services/dexcom.service';
import { DiabetesAgent } from '../services/diabetes-agent';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();
const aiService = new AIService();
const bloodSugarEmbeddingService = new BloodSugarEmbeddingService();
const dexcomService = new DexcomService();
const diabetesAgent = new DiabetesAgent();

// Initialize the embedding service when the server starts
(async () => {
    try {
        await bloodSugarEmbeddingService.initialize();
        console.log('Blood Sugar Embedding Service initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Blood Sugar Embedding Service:', error);
    }
})();

// Endpoint to analyze blood sugar data
router.post('/analyze-blood-sugar', authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const analysis = await aiService.analyzeBloodSugar({ content });
        res.json(analysis);
    } catch (error) {
        console.error('Error analyzing blood sugar:', error);
        res.status(500).json({ error: 'Failed to analyze blood sugar data' });
    }
});

// Endpoint to fetch and embed recent blood sugar readings
router.post('/embed-blood-sugar', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { days = 7 } = req.body;

        // Fetch recent readings from Dexcom
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const readings = await dexcomService.getReadings(userId, startDate, endDate);

        if (!readings || readings.length === 0) {
            return res.status(404).json({ message: 'No blood sugar readings found for the specified period' });
        }

        // Process and store readings in Pinecone
        await bloodSugarEmbeddingService.processAndStoreReadings(readings, userId);

        res.json({
            success: true,
            message: `Successfully embedded ${readings.length} blood sugar readings`,
            count: readings.length
        });
    } catch (error) {
        console.error('Error embedding blood sugar readings:', error);
        res.status(500).json({ error: 'Failed to embed blood sugar readings' });
    }
});

// Endpoint to query similar blood sugar readings
router.post('/query-blood-sugar', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { query, topK = 5 } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const results = await bloodSugarEmbeddingService.querySimilarReadings(query, userId, topK);
        res.json(results);
    } catch (error) {
        console.error('Error querying blood sugar readings:', error);
        res.status(500).json({ error: 'Failed to query blood sugar readings' });
    }
});

// Endpoint to generate blood sugar insights
router.get('/blood-sugar-insights/:timeframe?', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const timeframe = req.params.timeframe as 'day' | 'week' | 'month' || 'week';

        const insights = await bloodSugarEmbeddingService.generateBloodSugarInsights(userId, timeframe);
        res.json(insights);
    } catch (error) {
        console.error('Error generating blood sugar insights:', error);
        res.status(500).json({ error: 'Failed to generate blood sugar insights' });
    }
});

// Unified AI chat endpoint using DiabetesAgent
router.post('/chat', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, sessionId = 'default' } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Use the DiabetesAgent to process the message
        const result = await diabetesAgent.ask(message, `${userId}-${sessionId}`);

        // Get the chat history to include in the response
        const chatHistory = await diabetesAgent.getChatHistory(`${userId}-${sessionId}`);

        // Format the response for the frontend
        const response = {
            message: result.output,
            chatHistory: chatHistory.map(msg => ({
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                sender: msg._getType() === 'human' ? 'user' : 'ai',
                timestamp: new Date().toLocaleTimeString()
            })),
            sessionId: `${userId}-${sessionId}`
        };

        res.json(response);
    } catch (error) {
        console.error('Error processing chat message:', error);
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get chat history endpoint
router.get('/chat-history/:sessionId?', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.sessionId || 'default';

        const chatHistory = await diabetesAgent.getChatHistory(`${userId}-${sessionId}`);

        const formattedHistory = chatHistory.map(msg => ({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            sender: msg._getType() === 'human' ? 'user' : 'ai',
            timestamp: new Date().toLocaleTimeString()
        }));

        res.json({ chatHistory: formattedHistory });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

// Clear chat history endpoint
router.delete('/chat-history/:sessionId?', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = req.params.sessionId || 'default';

        await diabetesAgent.clearChatHistory(`${userId}-${sessionId}`);

        res.json({ success: true, message: 'Chat history cleared successfully' });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

export default router; 