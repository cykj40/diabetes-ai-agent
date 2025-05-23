// This file is not used - we have moved to Fastify and use AI routes instead
// Commenting out to fix build errors

/*
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { extractUserIdFromRequest } from '../utils/auth';

const prisma = new PrismaClient();

export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const userId = extractUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const sessionId = req.params.sessionId;
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const messages = await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' },
        });

        return res.json({
            messages: messages.map(msg => ({
                id: msg.id,
                text: msg.content,
                sender: msg.type === 'human' ? 'user' : 'ai',
                timestamp: msg.timestamp.toISOString(),
            })),
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        return res.status(500).json({
            error: 'Failed to fetch chat history',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const clearChatHistory = async (req: Request, res: Response) => {
    try {
        const userId = extractUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const sessionId = req.params.sessionId;
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        await prisma.chatMessage.deleteMany({
            where: { sessionId },
        });

        return res.json({ success: true, message: 'Chat history cleared successfully' });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        return res.status(500).json({
            error: 'Failed to clear chat history',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const getChatSessions = async (req: Request, res: Response) => {
    try {
        const userId = extractUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get distinct sessionIds and their first and last messages
        const sessions = await prisma.$queryRaw`
            SELECT DISTINCT 
                cm."sessionId" as id,
                (
                    SELECT content 
                    FROM "ChatMessage" 
                    WHERE "sessionId" = cm."sessionId" AND type = 'human' 
                    ORDER BY timestamp ASC 
                    LIMIT 1
                ) as title,
                MAX(cm.timestamp) as timestamp
            FROM "ChatMessage" cm
            GROUP BY cm."sessionId"
            ORDER BY MAX(cm.timestamp) DESC
        `;

        return res.json(sessions);
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        return res.status(500).json({
            error: 'Failed to fetch chat sessions',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
*/ 