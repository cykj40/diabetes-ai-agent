import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BloodWorkService } from '../services/blood-work.service';

const bloodWorkService = new BloodWorkService();

// Helper function to extract userId from request (you may need to adjust this based on your auth implementation)
function extractUserId(request: FastifyRequest): string {
    // Try to get user ID from JWT token or session
    // This is a placeholder - adjust based on your auth implementation
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            // You would decode the JWT token here to get the user ID
            // For now, returning default user
            return 'default-user';
        } catch (error) {
            console.log('Error extracting user ID from token:', error);
        }
    }

    // Fallback to default user if no auth or error
    return 'default-user';
}

export default async function bloodWorkRoutes(fastify: FastifyInstance) {
    /**
     * @route POST /api/blood-work/upload
     * @desc Upload and parse blood work file (CSV or PDF)
     */
    fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Handle multipart file upload
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'No file provided' });
            }

            const { filename, file, mimetype } = data;
            const userId = extractUserId(request);

            // Check file type
            const fileType = filename.split('.').pop()?.toLowerCase();
            if (!fileType || !['csv', 'pdf'].includes(fileType)) {
                return reply.code(400).send({
                    error: 'Invalid file type. Only CSV and PDF files are supported.'
                });
            }

            // Read file content
            const chunks: Buffer[] = [];
            for await (const chunk of file) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);
            const content = fileBuffer.toString('utf-8');

            let record;

            if (fileType === 'csv') {
                record = await bloodWorkService.parseCSV(content, filename, userId);
            } else if (fileType === 'pdf') {
                // For PDF, we'll do basic text extraction
                // In a real implementation, you'd use a PDF parsing library like pdf-parse
                record = await bloodWorkService.parsePDF(content, filename, userId);
            } else {
                return reply.code(400).send({ error: 'Unsupported file type' });
            }

            // Generate summary for the AI response
            const summary = bloodWorkService.generateSummary(record);

            fastify.log.info(`Blood work uploaded and parsed: ${record.id} with ${record.values.length} values for user ${userId}`);

            return {
                success: true,
                summary,
                recordId: record.id,
                recordName: record.name,
                testsCount: record.values.length,
                abnormalCount: record.values.filter(v => v.isAbnormal).length
            };

        } catch (error) {
            fastify.log.error('Error processing blood work upload:', error);
            return reply.code(500).send({
                error: 'Failed to process file upload',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    /**
     * @route GET /api/blood-work/records
     * @desc Get all blood work records for the user
     */
    fastify.get('/records', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = extractUserId(request);
            const records = await bloodWorkService.getAllRecords(userId);

            return {
                success: true,
                count: records.length,
                records
            };
        } catch (error) {
            fastify.log.error('Error fetching blood work records:', error);
            return reply.code(500).send({
                error: 'Failed to fetch blood work records',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    /**
     * @route GET /api/blood-work/records/:id
     * @desc Get a specific blood work record by ID
     */
    fastify.get('/records/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const { id } = request.params;
            const userId = extractUserId(request);
            const record = await bloodWorkService.getRecord(id, userId);

            if (!record) {
                return reply.code(404).send({
                    error: 'Blood work record not found'
                });
            }

            return {
                success: true,
                record
            };
        } catch (error) {
            fastify.log.error('Error fetching blood work record:', error);
            return reply.code(500).send({
                error: 'Failed to fetch blood work record',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    /**
     * @route GET /api/blood-work/search
     * @desc Search blood work records by test name
     */
    fastify.get('/search', async (request: FastifyRequest<{
        Querystring: {
            testName: string;
            abnormalOnly?: boolean
        }
    }>, reply: FastifyReply) => {
        try {
            const { testName, abnormalOnly = false } = request.query;
            const userId = extractUserId(request);

            if (!testName) {
                return reply.code(400).send({
                    error: 'testName query parameter is required'
                });
            }

            const results = await bloodWorkService.searchRecords(testName, userId, abnormalOnly);

            return {
                success: true,
                searchTerm: testName,
                includeAbnormalOnly: abnormalOnly,
                resultsCount: results.length,
                results
            };
        } catch (error) {
            fastify.log.error('Error searching blood work records:', error);
            return reply.code(500).send({
                error: 'Failed to search blood work records',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    /**
     * @route GET /api/blood-work/category/:category
     * @desc Get blood work records by category
     */
    fastify.get('/category/:category', async (request: FastifyRequest<{ Params: { category: string } }>, reply: FastifyReply) => {
        try {
            const { category } = request.params;
            const userId = extractUserId(request);
            const results = await bloodWorkService.getRecordsByCategory(category, userId);

            return {
                success: true,
                category,
                resultsCount: results.length,
                results
            };
        } catch (error) {
            fastify.log.error('Error fetching blood work records by category:', error);
            return reply.code(500).send({
                error: 'Failed to fetch blood work records by category',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    /**
     * @route DELETE /api/blood-work/records/:id
     * @desc Delete a blood work record
     */
    fastify.delete('/records/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const { id } = request.params;
            const userId = extractUserId(request);
            const success = await bloodWorkService.deleteRecord(id, userId);

            if (!success) {
                return reply.code(404).send({
                    error: 'Blood work record not found or could not be deleted'
                });
            }

            return {
                success: true,
                message: 'Blood work record deleted successfully'
            };
        } catch (error) {
            fastify.log.error('Error deleting blood work record:', error);
            return reply.code(500).send({
                error: 'Failed to delete blood work record',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
} 