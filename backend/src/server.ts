import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import { PineconeService } from './services/pinecone';
import path from 'path';
import fs from 'fs';

// Import routes
import dexcomRoutes from './routes/dexcom.routes';
import chatRoutes from './routes/chat.routes';

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

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Pinecone
PineconeService.initialize()
    .catch(error => {
        console.error('Failed to initialize Pinecone:', error);
        process.exit(1);
    });

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Routes
app.use('/api/dexcom', dexcomRoutes);
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('\nAvailable routes:');
    console.log('/api/health');
    console.log('Router:', app._router);
}); 