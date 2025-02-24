import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

export class PineconeService {
    private static client: Pinecone;
    private static readonly HEALTH_INDEX = 'health-data-embeddings';

    static async initialize() {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
            throw new Error('Missing Pinecone configuration');
        }

        this.client = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
            environment: process.env.PINECONE_ENVIRONMENT
        });
    }

    // ... rest of the code
} 