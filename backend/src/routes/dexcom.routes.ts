import { Router, Request, Response } from 'express';
import { DexcomService } from '../services/dexcom.service';
import crypto from 'crypto';
import session from 'express-session';

// Extend Express Request type to include our custom session properties
declare module 'express-session' {
    interface SessionData {
        dexcomState?: string;
        dexcomTokens?: {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            token_type: string;
        };
    }
}

const router = Router();
const dexcomService = new DexcomService();

// Initialize Dexcom OAuth flow
router.get('/auth/dexcom', (req: Request, res: Response) => {
    // Generate a random state value for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    // Store state in session for validation
    req.session.dexcomState = state;

    const authUrl = dexcomService.getAuthorizationUrl(state);
    res.redirect(authUrl);
});

// Handle Dexcom OAuth callback
router.get('/auth/dexcom/callback', async (req: Request, res: Response) => {
    const { code, state } = req.query;

    // Validate state to prevent CSRF attacks
    if (state !== req.session.dexcomState) {
        return res.status(400).json({ error: 'Invalid state parameter' });
    }

    try {
        const tokens = await dexcomService.exchangeCodeForToken(code as string);

        // Store tokens securely
        req.session.dexcomTokens = tokens;

        res.redirect('/dashboard'); // Redirect to your frontend dashboard
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        res.status(500).json({ error: 'Failed to authenticate with Dexcom' });
    }
});

// Refresh Dexcom token
router.post('/auth/dexcom/refresh', async (req: Request, res: Response) => {
    const refreshToken = req.session.dexcomTokens?.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token available' });
    }

    try {
        const tokens = await dexcomService.refreshToken(refreshToken);
        req.session.dexcomTokens = tokens;
        res.json({ success: true });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// Get blood glucose values
router.get('/egvs', async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
    }

    try {
        const egvs = await dexcomService.getEgvs(
            new Date(startDate as string),
            new Date(endDate as string)
        );
        res.json(egvs);
    } catch (error) {
        console.error('Error fetching EGVs:', error);
        res.status(500).json({ error: 'Failed to fetch blood glucose values' });
    }
});

// Get alerts
router.get('/alerts', async (req: Request, res: Response) => {
    const { startDate, endDate, hours } = req.query;

    try {
        let alerts;
        if (hours) {
            alerts = await dexcomService.getLatestAlerts(Number(hours));
        } else if (startDate && endDate) {
            alerts = await dexcomService.getAlerts(
                new Date(startDate as string),
                new Date(endDate as string)
            );
        } else {
            // Default to last 24 hours if no parameters provided
            alerts = await dexcomService.getLatestAlerts();
        }
        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// Get devices and their settings
router.get('/devices', async (req: Request, res: Response) => {
    try {
        const devices = await dexcomService.getDevices();
        res.json(devices);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Get data range
router.get('/dataRange', async (req: Request, res: Response) => {
    try {
        const lastSyncTime = req.query.lastSyncTime ? new Date(req.query.lastSyncTime as string) : undefined;
        const dataRange = await dexcomService.getDataRange(lastSyncTime);
        res.json(dataRange);
    } catch (error) {
        console.error('Error fetching data range:', error);
        res.status(500).json({ error: 'Failed to fetch data range' });
    }
});

export default router; 