import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

export class PineconeService {
    private static client: Pinecone;

    static async initialize() {
        if (!process.env.PINECONE_API_KEY) {
            throw new Error('Missing Pinecone API key');
        }

        try {
            console.log('Initializing Pinecone client...');
            this.client = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY
            });
            console.log('Pinecone client initialized successfully');

            // Test the connection by listing indexes
            const indexes = await this.listIndexes();
            console.log('Connection test successful. Available indexes:', indexes);
        } catch (error) {
            console.error('Error initializing Pinecone client:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async createIndex(indexName: string, dimension: number) {
        try {
            console.log(`Creating index ${indexName} with dimension ${dimension}...`);
            console.log('Using serverless configuration with AWS us-east-1 region');

            await this.client.createIndex({
                name: indexName,
                dimension: dimension,
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'  // East Coast AWS region for serverless
                    }
                },
                waitUntilReady: true
            });

            console.log(`Index ${indexName} created successfully`);
        } catch (error) {
            console.error(`Error creating index ${indexName}:`, error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async deleteIndex(indexName: string) {
        try {
            console.log(`Deleting index ${indexName}...`);
            await this.client.deleteIndex(indexName);
            console.log(`Index ${indexName} deleted successfully`);
        } catch (error) {
            console.error(`Error deleting index ${indexName}:`, error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async listIndexes() {
        try {
            console.log('Listing available indexes...');
            const response = await this.client.listIndexes();
            const indexNames = response.indexes?.map(index => index.name) || [];
            console.log('Available indexes:', indexNames);
            return indexNames;
        } catch (error) {
            console.error('Error listing indexes:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async describeIndex(indexName: string) {
        try {
            console.log(`Describing index ${indexName}...`);
            const response = await this.client.describeIndex(indexName);
            console.log(`Index ${indexName} description:`, response);
            return response;
        } catch (error) {
            console.error(`Error describing index ${indexName}:`, error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async upsert(indexName: string, vectors: any[]) {
        try {
            console.log(`Upserting ${vectors.length} vectors to index ${indexName}...`);
            const index = this.client.index(indexName);
            await index.upsert(vectors);
            console.log(`Upserted ${vectors.length} vectors to index ${indexName} successfully`);
        } catch (error) {
            console.error(`Error upserting vectors to index ${indexName}:`, error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async query(indexName: string, queryVector: number[], topK: number = 10, filter?: any) {
        try {
            console.log(`Querying index ${indexName} with topK=${topK}...`);
            const index = this.client.index(indexName);
            const queryRequest: any = {
                topK,
                vector: queryVector,
                includeMetadata: true
            };

            if (filter) {
                queryRequest.filter = filter;
                console.log('Using filter:', filter);
            }

            const results = await index.query(queryRequest);
            console.log(`Query returned ${results.matches?.length || 0} matches`);
            return results;
        } catch (error) {
            console.error(`Error querying index ${indexName}:`, error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    static async delete(indexName: string, ids: string[]) {
        try {
            console.log(`Deleting ${ids.length} vectors from index ${indexName}...`);
            const index = this.client.index(indexName);
            await index.deleteMany(ids);
            console.log(`Deleted ${ids.length} vectors from index ${indexName} successfully`);
        } catch (error) {
            console.error(`Error deleting vectors from index ${indexName}:`, error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }

    // New method for generating embeddings using Pinecone's Inference API
    static async generateEmbeddings(texts: string[], model: string = 'multilingual-e5-large') {
        try {
            console.log(`Generating embeddings for ${texts.length} texts using model ${model}...`);
            const embeddings = await this.client.inference.embed(
                model,
                texts,
                { inputType: 'passage', truncate: 'END' }
            );
            console.log(`Generated embeddings for ${texts.length} texts successfully`);
            return embeddings;
        } catch (error) {
            console.error('Error generating embeddings:', error);
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            throw error;
        }
    }
} 