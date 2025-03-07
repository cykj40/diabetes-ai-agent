import { AIService } from './ai.service';
import { PineconeService } from './pinecone';
import { DexcomReading } from './dexcom.service';
import { PrismaClient } from '@prisma/client';

export class BloodSugarEmbeddingService {
    private aiService: AIService;
    private prisma: PrismaClient;
    private readonly indexName = 'blood-sugar-data';
    private readonly embeddingDimension = 1536; // OpenAI embedding dimension

    constructor() {
        this.aiService = new AIService();
        this.prisma = new PrismaClient();
    }

    async initialize() {
        try {
            // Initialize Pinecone service
            await PineconeService.initialize();

            // Check if index exists, create if not
            const indexes = await PineconeService.listIndexes();
            const indexExists = indexes.some((index: any) => index === this.indexName);

            if (!indexExists) {
                console.log(`Creating new Pinecone index: ${this.indexName}`);
                await PineconeService.createIndex(this.indexName, this.embeddingDimension);
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
            await PineconeService.upsert(this.indexName, vectors);

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
            // Check if the BloodSugarReading table has the userId column
            let hasUserIdColumn = true;
            try {
                // Try a simple query to check if userId column exists
                await this.prisma.$queryRaw`SELECT "userId" FROM "BloodSugarReading" LIMIT 1`;
            } catch (error: any) {
                if (error.message && error.message.includes('column "userId" does not exist')) {
                    console.log('The userId column does not exist in the BloodSugarReading table. Skipping database storage.');
                    hasUserIdColumn = false;
                    return; // Skip database operations
                }
            }

            if (!hasUserIdColumn) {
                return; // Skip database operations
            }

            // Store each reading in the database
            for (const reading of readings) {
                const timestamp = new Date(reading.timestamp);
                const sessionId = `session-${Date.now()}`;

                try {
                    // Use a more basic query that doesn't rely on userId if it's not available
                    const existingReadings = await this.prisma.$queryRaw<Array<{ id: string }>>`
                        SELECT id FROM "BloodSugarReading" 
                        WHERE "timestamp" = ${timestamp}
                    `;

                    const existingReading = existingReadings.length > 0 ? existingReadings[0] : null;

                    if (existingReading) {
                        // Update existing reading
                        await this.prisma.bloodSugarReading.update({
                            where: { id: existingReading.id },
                            data: {
                                value: reading.value,
                                trend: reading.trend,
                                timestamp: timestamp
                            }
                        });
                    } else {
                        // Create new reading
                        await this.prisma.bloodSugarReading.create({
                            data: {
                                sessionId,
                                value: reading.value,
                                trend: reading.trend,
                                timestamp: timestamp,
                                // Only include userId if the column exists
                                ...(hasUserIdColumn ? { userId } : {})
                            }
                        });
                    }
                } catch (error: any) {
                    console.error(`Error processing reading at ${timestamp}:`, error);
                    // Continue with the next reading instead of failing the entire batch
                }
            }
        } catch (error) {
            console.error('Error storing readings in database:', error);
            // Don't throw the error, just log it and continue
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
            const results = await PineconeService.query(
                this.indexName,
                queryEmbedding[0],
                topK
            );

            // Filter results by userId if needed
            return results.matches.filter((match: any) =>
                match.metadata && match.metadata.userId === userId
            );
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
            // Note: We're not filtering by userId due to schema issues
            console.log(`Getting embedded readings for time period: ${startDate?.toISOString()} to ${endDate?.toISOString()}`);

            const filter: any = {
                isEmbedded: true
            };

            if (startDate || endDate) {
                filter.timestamp = {};
                if (startDate) filter.timestamp.gte = startDate;
                if (endDate) filter.timestamp.lte = endDate;
            }

            console.log('Using filter:', JSON.stringify(filter));
            const readings = await this.prisma.bloodSugarReading.findMany({
                where: filter,
                orderBy: {
                    timestamp: 'desc'
                }
            });

            console.log(`Found ${readings.length} embedded readings`);
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
            const analysis = await this.aiService.analyzeBloodSugar({ content: prompt });

            return {
                summary: analysis.summary,
                patterns: [
                    {
                        description: `Glucose Trend: ${analysis.glucoseTrend}`,
                        severity: analysis.riskLevel > 7 ? 'high' : analysis.riskLevel > 4 ? 'medium' : 'low'
                    },
                    ...(analysis.anomalyDetected && analysis.anomalyDescription
                        ? [
                            {
                                description: `Anomaly Detected: ${analysis.anomalyDescription}`,
                                severity: 'high'
                            }
                        ]
                        : [])
                ],
                recommendations: analysis.recommendations.split('\n').filter(r => r.trim().length > 0)
            };
        } catch (error) {
            console.error('Error generating blood sugar insights:', error);
            throw error;
        }
    }
} 