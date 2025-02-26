import { Router } from 'express';
import { DiabetesAgent } from '../services/diabetes-agent';

const router = Router();
const agent = new DiabetesAgent();

// Test monitoring endpoint
router.post('/monitor', async (req, res) => {
    try {
        const { sessionId = 'default' } = req.body;
        const result = await agent.monitor(sessionId);
        res.json(result);
    } catch (error) {
        console.error('Error in monitor endpoint:', error);
        res.status(500).json({ error: 'Failed to monitor blood sugar' });
    }
});

// Test question endpoint
router.post('/ask', async (req, res) => {
    try {
        const { question, sessionId = 'default' } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        const result = await agent.ask(question, sessionId);
        res.json(result);
    } catch (error) {
        console.error('Error in ask endpoint:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

// Get chat history endpoint
router.get('/history/:sessionId?', async (req, res) => {
    try {
        const sessionId = req.params.sessionId || 'default';
        const history = await agent.getChatHistory(sessionId);
        res.json(history);
    } catch (error) {
        console.error('Error in history endpoint:', error);
        res.status(500).json({ error: 'Failed to get chat history' });
    }
});

// Clear chat history endpoint
router.delete('/history/:sessionId?', async (req, res) => {
    try {
        const sessionId = req.params.sessionId || 'default';
        await agent.clearChatHistory(sessionId);
        res.json({ message: 'Chat history cleared successfully' });
    } catch (error) {
        console.error('Error in clear history endpoint:', error);
        res.status(500).json({ error: 'Failed to clear chat history' });
    }
});

export default router; 