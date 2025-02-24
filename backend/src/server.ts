import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import routes from './routes';
import { PineconeService } from './services/pinecone';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

// Initialize Pinecone
PineconeService.initialize()
    .catch(error => {
        console.error('Failed to initialize Pinecone:', error);
        process.exit(1);
    });

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 