import { AIService } from './ai.service';
import { PineconeService } from './pinecone';
import { DexcomReading } from './dexcom.service';
import { PrismaClient } from '@prisma/client';

export class BloodSugarEmbeddingService {
    private aiService: AIService;
    private pineconeService: PineconeService;
    private prisma: PrismaClient;
    private readonly indexName = 'blood-sugar-data';
    private readonly embeddingDimension = 1536; // OpenAI embedding dimension

    constructor() {
        this.aiService = new AIService();
        this.pineconeService = new PineconeService();
        this.prisma = new PrismaClient();
    }

    async initialize() {
        try {
            // Initialize Pinecone service
            await this.pineconeService.initialize();

            // Check if index exists, create if not
            const indexes = await this.pineconeService.listIndexes();
            const indexExists = indexes.some(index => index === this.indexName);

            if (!indexExists) {
                console.log(`Creating new Pinecone index: ${this.indexName}`);
                await this.pineconeService.createIndex(this.indexName, this.embeddingDimension);
                console.log('Index created successfully');
            } else {
                console.log(`Pinecone index ${this.indexName} already exists`);
            }
        } catch (error) {
            console.error('Failed to initialize BloodSugarEmbeddingService:', error);
            throw error;
        }
    }

    /**
     * Process and store blood sugar readings in Pinecone
     * @param readings Array of Dexcom readings
     * @param userId User ID for the readings
     */
    async processAndStoreReadings(readings: DexcomReading[], userId: string) {
        if (!readings || readings.length === 0) {
            console.log('No readings to process');
            return;
        }

        console.log(`Processing ${readings.length} blood sugar readings for user ${userId}`);

        try {
            // Process readings in batches to avoid rate limits
            const batchSize = 10;
            for (let i = 0; i < readings.length; i += batchSize) {
                const batch = readings.slice(i, i + batchSize);
                await this.processReadingBatch(batch, userId);
            }

            console.log('Successfully processed and stored all readings');
        } catch (error) {
            console.error('Error processing blood sugar readings:', error);
            throw error;
        }
    }

    /**
     * Process a batch of readings and store them in Pinecone
     */
    private async processReadingBatch(readings: DexcomReading[], userId: string) {
        try {
            // Create text representations for embedding
            const textRepresentations = readings.map(reading => {
                const date = new Date(reading.timestamp);
                const formattedDate = date.toLocaleString();

                return `Blood sugar reading: ${reading.value} mg/dL, trend: ${reading.trend}, time: ${formattedDate}`;
            });

            // Generate embeddings
            const embeddings = await this.aiService.generateEmbeddings(textRepresentations);

            // Prepare vectors for Pinecone
            const vectors = readings.map((reading, index) => ({
                id: `${userId}-${new Date(reading.timestamp).getTime()}`,
                values: embeddings[index],
                metadata: {
                    userId,
                    value: reading.value,
                    trend: reading.trend,
                    timestamp: reading.timestamp,
                    type: 'blood_sugar'
                }
            }));

            // Store in Pinecone
            await this.pineconeService.upsert(this.indexName, vectors);

            // Also store in database for backup/reference
            await this.storeReadingsInDatabase(readings, userId);

            console.log(`Successfully processed batch of ${readings.length} readings`);
        } catch (error) {
            console.error('Error processing reading batch:', error);
            throw error;
        }
    }

    /**
     * Store readings in the database as a backup
     */
    private async storeReadingsInDatabase(readings: DexcomReading[], userId: string) {
        try {
            // Store each reading in the database
            for (const reading of readings) {
                await this.prisma.bloodSugarReading.upsert({
                    where: {
                        userId_timestamp: {
                            userId,
                            timestamp: new Date(reading.timestamp)
                        }
                    },
                    update: {
                        value: reading.value,
                        trend: reading.trend,
                        isEmbedded: true
                    },
                    create: {
                        userId,
                        value: reading.value,
                        trend: reading.trend,
                        timestamp: new Date(reading.timestamp),
                        isEmbedded: true
                    }
                });
            }
        } catch (error) {
            console.error('Error storing readings in database:', error);
            // Don't throw here, as we still want to continue if Pinecone storage succeeded
        }
    }

    /**
     * Query for similar blood sugar readings based on natural language
     * @param query Natural language query
     * @param userId User ID to filter results
     * @param topK Number of results to return
     */
    async querySimilarReadings(query: string, userId: string, topK: number = 5) {
        try {
            // Generate embedding for query
            const queryEmbedding = await this.aiService.generateEmbeddings([query]);

            // Query Pinecone
            const results = await this.pineconeService.query(
                this.indexName,
                queryEmbedding[0],
                topK,
                { userId }
            );

            return results;
        } catch (error) {
            console.error('Error querying similar readings:', error);
            throw error;
        }
    }

    /**
     * Get all embedded readings for a user within a date range
     */
    async getEmbeddedReadings(userId: string, startDate?: Date, endDate?: Date) {
        try {
            // Query the database for readings that have been embedded
            const filter: any = {
                userId,
                isEmbedded: true
            };

            if (startDate || endDate) {
                filter.timestamp = {};
                if (startDate) filter.timestamp.gte = startDate;
                if (endDate) filter.timestamp.lte = endDate;
            }

            const readings = await this.prisma.bloodSugarReading.findMany({
                where: filter,
                orderBy: {
                    timestamp: 'desc'
                }
            });

            return readings;
        } catch (error) {
            console.error('Error getting embedded readings:', error);
            throw error;
        }
    }

    /**
     * Generate a summary of blood sugar patterns based on embedded data
     */
    async generateBloodSugarInsights(userId: string, timeframe: 'day' | 'week' | 'month' = 'week') {
        try {
            // Get date range based on timeframe
            const endDate = new Date();
            const startDate = new Date();

            switch (timeframe) {
                case 'day':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
            }

            // Get readings for the timeframe
            const readings = await this.getEmbeddedReadings(userId, startDate, endDate);

            if (readings.length === 0) {
                return {
                    summary: "No blood sugar data available for the selected timeframe.",
                    patterns: [],
                    recommendations: []
                };
            }

            // Create a prompt for the AI to analyze the data
            const readingsText = readings.map(r =>
                `Time: ${r.timestamp.toLocaleString()}, Value: ${r.value} mg/dL, Trend: ${r.trend}`
            ).join('\n');

            const prompt = `
        Analyze the following blood sugar readings over the past ${timeframe}:
        
        ${readingsText}
        
        Provide:
        1. A summary of overall blood sugar control
        2. Key patterns or trends identified
        3. Actionable recommendations for improving blood sugar management
      `;

            // Get AI analysis
            const analysis = await this.aiService.analyzeBloodSugar(prompt);

            return analysis;
        } catch (error) {
            console.error('Error generating blood sugar insights:', error);
            throw error;
        }
    }
} 