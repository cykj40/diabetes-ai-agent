import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai.service';

const router = Router();
const aiService = new AIService();

// Analyze blood sugar data
router.post('/analyze', async (req: Request, res: Response) => {
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

// Question answering endpoint
router.post('/qa', async (req: Request, res: Response) => {
    try {
        const { question, entries } = req.body;
        if (!question || !entries) {
            return res.status(400).json({ error: 'Question and entries are required' });
        }

        const answer = await aiService.qa(question, entries);
        res.json({ answer });
    } catch (error) {
        console.error('Error answering question:', error);
        res.status(500).json({ error: 'Failed to answer question' });
    }
});

export default router; 