import { AIService } from './ai.service';
import { PineconeService } from './pinecone';
import { BloodWorkService, BloodWorkRecord } from './blood-work.service';
import { PrismaClient } from '@prisma/client';

export class BloodWorkEmbeddingService {
    private aiService: AIService;
    private bloodWorkService: BloodWorkService;
    private prisma: PrismaClient;
    private readonly indexName = 'blood-work-data';
    private readonly embeddingDimension = 1536; // OpenAI embedding dimension

    constructor() {
        this.aiService = new AIService();
        this.bloodWorkService = new BloodWorkService();
        this.prisma = new PrismaClient();
    }

    async initialize() {
        try {
            // Initialize Pinecone service
            await PineconeService.initialize();

            // Check if index exists, create if not
            const indexes = await PineconeService.listIndexes();
            const indexExists = indexes.includes(this.indexName);

            if (!indexExists) {
                console.log(`Creating Pinecone index: ${this.indexName}`);
                await PineconeService.createIndex(this.indexName, this.embeddingDimension);
                console.log('Blood work index created successfully');
            } else {
                console.log(`Pinecone index ${this.indexName} already exists`);
            }
        } catch (error) {
            console.error('Failed to initialize BloodWorkEmbeddingService:', error);
            throw error;
        }
    }

    /**
     * Process and vectorize a blood work record for semantic search
     * @param record Blood work record to process
     * @param userId User ID for the record
     */
    async processAndStoreRecord(record: BloodWorkRecord, userId: string) {
        console.log(`Vectorizing blood work record ${record.id} for user ${userId}`);

        try {
            // Create text representations for the entire record and individual tests
            const textRepresentations: string[] = [];
            const metadata: any[] = [];

            // Create overall record summary
            const recordSummary = this.createRecordSummary(record);
            textRepresentations.push(recordSummary);
            metadata.push({
                userId,
                recordId: record.id,
                recordName: record.name,
                recordDate: record.date,
                type: 'blood_work_summary',
                testsCount: record.values.length
            });

            // Create individual test representations
            for (const test of record.values) {
                const testText = this.createTestText(test, record);
                textRepresentations.push(testText);
                metadata.push({
                    userId,
                    recordId: record.id,
                    recordName: record.name,
                    recordDate: record.date,
                    type: 'blood_work_test',
                    testName: test.name,
                    testValue: test.value,
                    testUnit: test.unit,
                    isAbnormal: test.isAbnormal,
                    category: test.category
                });
            }

            // Generate embeddings
            console.log(`Generating embeddings for ${textRepresentations.length} text segments`);
            const embeddings = await this.aiService.generateEmbeddings(textRepresentations);

            // Prepare vectors for Pinecone
            const vectors = embeddings.map((embedding, index) => ({
                id: `${userId}-${record.id}-${index}`,
                values: embedding,
                metadata: metadata[index]
            }));

            // Store in Pinecone
            await PineconeService.upsert(this.indexName, vectors);

            console.log(`Successfully stored blood work record ${record.id} in Pinecone`);
        } catch (error) {
            console.error('Error processing blood work record:', error);
            throw error;
        }
    }

    /**
     * Create a comprehensive text summary of the blood work record
     */
    private createRecordSummary(record: BloodWorkRecord): string {
        const date = new Date(record.date).toLocaleDateString();
        const abnormalTests = record.values.filter(v => v.isAbnormal);

        let summary = `Blood work results from ${date} (${record.name}): `;
        summary += `${record.values.length} tests performed. `;

        if (abnormalTests.length > 0) {
            summary += `${abnormalTests.length} abnormal results: `;
            summary += abnormalTests.map(test =>
                `${test.name} ${test.value} ${test.unit} (abnormal)`
            ).join(', ') + '. ';
        } else {
            summary += 'All results within normal ranges. ';
        }

        // Add key diabetes markers if present
        const diabetesTests = record.values.filter(v =>
            v.name.toLowerCase().includes('glucose') ||
            v.name.toLowerCase().includes('hba1c') ||
            v.name.toLowerCase().includes('a1c')
        );

        if (diabetesTests.length > 0) {
            summary += 'Diabetes markers: ';
            summary += diabetesTests.map(test =>
                `${test.name} ${test.value} ${test.unit}`
            ).join(', ') + '. ';
        }

        // Add cholesterol if present
        const cholesterolTests = record.values.filter(v =>
            v.name.toLowerCase().includes('cholesterol') ||
            v.name.toLowerCase().includes('ldl') ||
            v.name.toLowerCase().includes('hdl') ||
            v.name.toLowerCase().includes('triglyceride')
        );

        if (cholesterolTests.length > 0) {
            summary += 'Lipid panel: ';
            summary += cholesterolTests.map(test =>
                `${test.name} ${test.value} ${test.unit}`
            ).join(', ') + '. ';
        }

        return summary;
    }

    /**
     * Create detailed text for individual test
     */
    private createTestText(test: any, record: BloodWorkRecord): string {
        const date = new Date(record.date).toLocaleDateString();
        let text = `${test.name}: ${test.value} ${test.unit} from blood work on ${date}. `;

        if (test.normalRange) {
            text += `Normal range: ${test.normalRange}. `;
        }

        text += test.isAbnormal ? 'This result is abnormal. ' : 'This result is normal. ';

        if (test.category) {
            text += `Category: ${test.category}. `;
        }

        // Add context based on test type
        const testName = test.name.toLowerCase();
        if (testName.includes('glucose') || testName.includes('sugar')) {
            text += 'This is a blood glucose measurement important for diabetes management. ';
        } else if (testName.includes('hba1c') || testName.includes('a1c')) {
            text += 'This is hemoglobin A1c, showing average blood sugar over 2-3 months. ';
        } else if (testName.includes('cholesterol')) {
            text += 'This is a cholesterol measurement important for cardiovascular health. ';
        } else if (testName.includes('ldl')) {
            text += 'This is LDL (bad) cholesterol. ';
        } else if (testName.includes('hdl')) {
            text += 'This is HDL (good) cholesterol. ';
        } else if (testName.includes('triglyceride')) {
            text += 'This is triglycerides, a type of fat in the blood. ';
        }

        return text;
    }

    /**
     * Query blood work data using natural language
     * @param query Natural language query about blood work
     * @param userId User ID to filter results
     * @param topK Number of results to return
     */
    async queryBloodWork(query: string, userId: string, topK: number = 10) {
        try {
            console.log(`Querying blood work data for user ${userId}: "${query}"`);

            // Generate embedding for query
            const queryEmbedding = await this.aiService.generateEmbeddings([query]);

            // Query Pinecone with user filter
            const results = await PineconeService.query(
                this.indexName,
                queryEmbedding[0],
                topK,
                { userId: { $eq: userId } }
            );

            if (!results.matches || results.matches.length === 0) {
                return {
                    success: false,
                    message: "No blood work data found. Upload blood work files first.",
                    results: []
                };
            }

            // Format results
            const formattedResults = results.matches.map((match: any) => ({
                score: match.score,
                metadata: match.metadata
            }));

            return {
                success: true,
                query,
                resultsCount: formattedResults.length,
                results: formattedResults
            };
        } catch (error) {
            console.error('Error querying blood work data:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                results: []
            };
        }
    }

    /**
     * Get blood work context for AI responses
     * @param query User query
     * @param userId User ID
     */
    async getBloodWorkContext(query: string, userId: string): Promise<string> {
        try {
            const results = await this.queryBloodWork(query, userId, 5);

            if (!results.success || results.results.length === 0) {
                return "No relevant blood work data found.";
            }

            let context = "Based on your blood work results:\n\n";

            results.results.forEach((result: any) => {
                const meta = result.metadata;
                if (meta.type === 'blood_work_test') {
                    const abnormalFlag = meta.isAbnormal ? ' ⚠️ ABNORMAL' : ' ✓ Normal';
                    context += `- ${meta.testName}: ${meta.testValue} ${meta.testUnit}${abnormalFlag} (${meta.recordDate})\n`;
                }
            });

            return context;
        } catch (error) {
            console.error('Error getting blood work context:', error);
            return "Error retrieving blood work data.";
        }
    }

    /**
     * Delete blood work vectors for a specific record
     * @param recordId Record ID to delete
     * @param userId User ID
     */
    async deleteRecordVectors(recordId: string, userId: string) {
        try {
            // Query for all vectors related to this record
            const queryResults = await PineconeService.query(
                this.indexName,
                new Array(this.embeddingDimension).fill(0), // Dummy vector
                100, // Get more results to find all related vectors
                {
                    userId: { $eq: userId },
                    recordId: { $eq: recordId }
                }
            );

            if (queryResults.matches && queryResults.matches.length > 0) {
                const idsToDelete = queryResults.matches.map((match: any) => match.id);
                await PineconeService.delete(this.indexName, idsToDelete);
                console.log(`Deleted ${idsToDelete.length} vectors for record ${recordId}`);
            }
        } catch (error) {
            console.error('Error deleting record vectors:', error);
        }
    }

    /**
     * Re-process all blood work records for a user (useful for migrations or updates)
     * @param userId User ID to re-process
     */
    async reprocessUserBloodWork(userId: string) {
        try {
            console.log(`Re-processing all blood work for user ${userId}`);

            const records = await this.bloodWorkService.getAllRecords(userId);

            for (const record of records) {
                await this.processAndStoreRecord(record, userId);
            }

            console.log(`Completed re-processing ${records.length} blood work records`);
        } catch (error) {
            console.error('Error re-processing blood work:', error);
            throw error;
        }
    }
} 