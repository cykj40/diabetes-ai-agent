import { AIService } from './ai.service';
import PgVectorService from './pgvector.service';
import { DexcomReading } from './dexcom.service';
import { db, bloodSugarReading } from '../db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export class BloodSugarEmbeddingService {
    private aiService: AIService;

    constructor() {
        this.aiService = new AIService();
    }

    async initialize() {
        try {
            // Initialize pgvector extension
            await PgVectorService.initialize();
            console.log('BloodSugarEmbeddingService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize BloodSugarEmbeddingService:', error);
            throw error;
        }
    }

    /**
     * Process and store blood sugar readings in pgvector
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
     * Process a batch of readings and store them in pgvector
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

            // Prepare vectors for pgvector
            const vectors = readings.map((reading, index) => ({
                id: `${userId}-${new Date(reading.timestamp).getTime()}`,
                values: embeddings[index],
                content: textRepresentations[index],
                metadata: {
                    userId,
                    value: reading.value,
                    trend: reading.trend,
                    timestamp: reading.timestamp,
                    type: 'blood_sugar'
                }
            }));

            // Store in pgvector
            await PgVectorService.upsert('blood_sugar', vectors);

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
                const timestamp = new Date(reading.timestamp);
                const sessionId = `session-${Date.now()}`;

                try {
                    // Check if reading already exists for this user and timestamp
                    const existingReadings = await db
                        .select()
                        .from(bloodSugarReading)
                        .where(
                            and(
                                eq(bloodSugarReading.userId, userId),
                                eq(bloodSugarReading.timestamp, timestamp)
                            )
                        );

                    if (existingReadings.length > 0) {
                        // Update existing reading
                        await db
                            .update(bloodSugarReading)
                            .set({
                                value: reading.value,
                                trend: reading.trend,
                                timestamp: timestamp,
                                isEmbedded: true
                            })
                            .where(eq(bloodSugarReading.id, existingReadings[0].id));
                    } else {
                        // Create new reading
                        await db.insert(bloodSugarReading).values({
                            sessionId,
                            userId,
                            value: reading.value,
                            trend: reading.trend,
                            timestamp: timestamp,
                            isEmbedded: true
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

            // Query pgvector
            const results = await PgVectorService.query(
                'blood_sugar',
                queryEmbedding[0],
                topK,
                { userId }
            );

            return results.matches;
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
            console.log(`Getting embedded readings for user ${userId}, time period: ${startDate?.toISOString()} to ${endDate?.toISOString()}`);

            // Build the where conditions
            const conditions = [
                eq(bloodSugarReading.userId, userId),
                eq(bloodSugarReading.isEmbedded, true)
            ];

            if (startDate) {
                conditions.push(gte(bloodSugarReading.timestamp, startDate));
            }
            if (endDate) {
                conditions.push(lte(bloodSugarReading.timestamp, endDate));
            }

            const readings = await db
                .select()
                .from(bloodSugarReading)
                .where(and(...conditions))
                .orderBy(desc(bloodSugarReading.timestamp));

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
                recommendations: analysis.recommendations.split('\n').filter((r: string) => r.trim().length > 0)
            };
        } catch (error) {
            console.error('Error generating blood sugar insights:', error);
            throw error;
        }
    }
} 
