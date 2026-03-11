import { FastifyRequest, FastifyReply } from 'fastify';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { unlink, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db, uploadedFile } from '../db';
import { eq, and, or, desc, count, sum, sql, like } from 'drizzle-orm';

const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const pdf2pic = require('pdf2pic');

interface FileParams {
    id: string;
}

interface UpdateFileBody {
    description?: string;
    tags?: string[];
    analysis?: string;
}

interface QueryParams {
    page?: number;
    limit?: number;
    fileType?: string;
    sessionId?: string;
    search?: string;
}

const fileRoutes: FastifyPluginAsyncTypebox = async (fastify) => {

    // File upload endpoint
    fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            console.log('Backend file upload called');

            // Handle multipart file upload
            const data = await request.file();

            if (!data) {
                return reply.code(400).send({ error: 'No file provided' });
            }

            const { filename, file, mimetype } = data;

            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
            }

            // Get session ID from headers
            const sessionId = (request.headers['x-session-id'] as string) || 'default';

            console.log('File upload:', { filename, mimetype, userId, sessionId });

            // Validate file type
            const fileExtension = filename.split('.').pop()?.toLowerCase();
            const allowedTypes = ['csv', 'pdf', 'txt', 'json', 'xml', 'jpg', 'jpeg', 'png'];

            if (!fileExtension || !allowedTypes.includes(fileExtension)) {
                return reply.code(400).send({
                    error: 'Invalid file type. Only CSV, PDF, TXT, JSON, XML, and image files are supported.'
                });
            }

            // Read file content
            const chunks: Buffer[] = [];
            for await (const chunk of file) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            // Check file size (10MB limit)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (fileBuffer.length > maxSize) {
                return reply.code(400).send({
                    error: 'File too large. Maximum size is 10MB.'
                });
            }

            // Create unique filename
            const uniqueFileName = `${uuidv4()}-${filename}`;

            // Create upload directory if it doesn't exist
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', sessionId);
            if (!existsSync(uploadDir)) {
                await mkdir(uploadDir, { recursive: true });
            }

            // Save file to disk
            const filePath = path.join(uploadDir, uniqueFileName);
            await writeFile(filePath, fileBuffer);

            // Process file content based on type
            let content = '';
            if (['txt', 'json', 'xml', 'csv'].includes(fileExtension)) {
                content = fileBuffer.toString('utf-8');
            } else if (fileExtension === 'pdf') {
                try {
                    console.log('Extracting PDF content...');
                    const pdfData = await pdfParse(fileBuffer);
                    content = pdfData.text || '';
                    console.log(`PDF content extracted: ${content.length} characters`);

                    // If we got very little text (likely a scanned PDF), try OCR
                    if (content.trim().length < 50) {
                        console.log('PDF appears to be scanned, attempting OCR...');
                        try {
                            // Ensure temp directory exists
                            const tempDir = path.join(process.cwd(), 'temp');
                            if (!existsSync(tempDir)) {
                                await mkdir(tempDir, { recursive: true });
                            }

                            // Convert PDF to image(s)
                            const convert = pdf2pic.fromBuffer(fileBuffer, {
                                density: 300,           // High quality
                                saveFilename: "page",
                                savePath: "./temp/",
                                format: "png",
                                width: 2000,
                                height: 2800
                            });

                            // Convert first page to image
                            const imageResult = await convert(1, { responseType: 'buffer' });

                            // Initialize Tesseract worker
                            const worker = await createWorker();
                            await worker.loadLanguage('eng');
                            await worker.initialize('eng');

                            // Perform OCR on the image
                            const ocrResult = await worker.recognize(imageResult.buffer);
                            content = ocrResult.data.text || 'OCR extraction failed';

                            console.log(`OCR content extracted: ${content.length} characters`);

                            // Clean up Tesseract worker
                            await worker.terminate();

                        } catch (ocrError) {
                            console.error('OCR extraction failed:', ocrError);
                            content = content || 'PDF content could not be extracted (may be image-based or password protected)';
                        }
                    }

                } catch (pdfError) {
                    console.error('Error extracting PDF content:', pdfError);
                    content = 'Error extracting PDF content - file may be corrupted or password protected';
                }
            } else if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
                content = 'Image file uploaded';
            }

            // Save file metadata to database
            const [uploadedFileRecord] = await db.insert(uploadedFile).values({
                userId: userId,
                sessionId: sessionId,
                fileName: filename,
                uniqueName: uniqueFileName,
                fileType: fileExtension,
                filePath: `/uploads/${sessionId}/${uniqueFileName}`,
                fileSize: fileBuffer.length,
                mimeType: mimetype,
                content: content.substring(0, 10000), // Limit content to 10k characters
                tags: [], // Default empty tags
                isProcessed: false
            }).returning();

            console.log('File saved to database with ID:', uploadedFileRecord.id);

            const fileInfo = {
                id: uploadedFileRecord.id,
                name: filename,
                originalName: filename,
                uniqueName: uniqueFileName,
                type: fileExtension,
                size: fileBuffer.length,
                path: `/uploads/${sessionId}/${uniqueFileName}`,
                uploadedAt: uploadedFileRecord.createdAt.toISOString(),
                content: content.substring(0, 10000)
            };

            return {
                success: true,
                message: 'File uploaded successfully',
                fileInfo,
                attachmentId: uploadedFileRecord.id
            };

        } catch (error) {
            console.error('Error processing file upload:', error);
            return reply.code(500).send({
                error: 'Failed to process file upload',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get all uploaded files for a user
    fastify.get<{ Querystring: QueryParams }>('/files', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                // You could validate the token here if needed
                userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
            }

            const {
                page = 1,
                limit = 20,
                fileType,
                sessionId,
                search
            } = request.query;

            const offset = (page - 1) * limit;

            // Build where clause
            const conditions = [eq(uploadedFile.userId, userId)];

            if (fileType) {
                conditions.push(eq(uploadedFile.fileType, fileType));
            }

            if (sessionId) {
                conditions.push(eq(uploadedFile.sessionId, sessionId));
            }

            if (search) {
                conditions.push(
                    or(
                        like(uploadedFile.fileName, `%${search}%`),
                        like(uploadedFile.description, `%${search}%`),
                        like(uploadedFile.content, `%${search}%`)
                    )!
                );
            }

            const whereClause = and(...conditions);

            const [files, totalResult] = await Promise.all([
                db.select()
                    .from(uploadedFile)
                    .where(whereClause)
                    .orderBy(desc(uploadedFile.createdAt))
                    .limit(limit)
                    .offset(offset),
                db.select({ count: count() })
                    .from(uploadedFile)
                    .where(whereClause)
            ]);

            const total = totalResult[0]?.count || 0;

            return {
                files,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error fetching files:', error);
            return reply.code(500).send({
                error: 'Failed to fetch files',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get a specific file by ID
    fastify.get<{ Params: FileParams }>('/files/:id', async (request, reply) => {
        try {
            const { id } = request.params;

            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
            }

            const file = await db.query.uploadedFile.findFirst({
                where: and(
                    eq(uploadedFile.id, id),
                    eq(uploadedFile.userId, userId)
                )
            });

            if (!file) {
                return reply.code(404).send({ error: 'File not found' });
            }

            return file;
        } catch (error) {
            console.error('Error fetching file:', error);
            return reply.code(500).send({
                error: 'Failed to fetch file',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Update file metadata
    fastify.put<{ Params: FileParams, Body: UpdateFileBody }>('/files/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const { description, tags, analysis } = request.body;

            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
            }

            // Check if file exists and belongs to user
            const existingFile = await db.query.uploadedFile.findFirst({
                where: and(
                    eq(uploadedFile.id, id),
                    eq(uploadedFile.userId, userId)
                )
            });

            if (!existingFile) {
                return reply.code(404).send({ error: 'File not found' });
            }

            // Build update object
            const updateData: any = {};
            if (description !== undefined) updateData.description = description;
            if (tags !== undefined) updateData.tags = tags;
            if (analysis !== undefined) {
                updateData.analysis = analysis;
                updateData.isProcessed = true;
            }

            // Update file
            const [updatedFileRecord] = await db.update(uploadedFile)
                .set(updateData)
                .where(eq(uploadedFile.id, id))
                .returning();

            return updatedFileRecord;
        } catch (error) {
            console.error('Error updating file:', error);
            return reply.code(500).send({
                error: 'Failed to update file',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Delete a file
    fastify.delete<{ Params: FileParams }>('/files/:id', async (request, reply) => {
        try {
            const { id } = request.params;

            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
            }

            // Check if file exists and belongs to user
            const existingFile = await db.query.uploadedFile.findFirst({
                where: and(
                    eq(uploadedFile.id, id),
                    eq(uploadedFile.userId, userId)
                )
            });

            if (!existingFile) {
                return reply.code(404).send({ error: 'File not found' });
            }

            // Delete physical file
            try {
                const fullPath = path.join(process.cwd(), 'public', existingFile.filePath);
                await unlink(fullPath);
                console.log('Deleted physical file:', fullPath);
            } catch (fileError) {
                console.warn('Could not delete physical file:', fileError);
                // Continue with database deletion even if file deletion fails
            }

            // Delete from database
            await db.delete(uploadedFile)
                .where(eq(uploadedFile.id, id));

            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            console.error('Error deleting file:', error);
            return reply.code(500).send({
                error: 'Failed to delete file',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get file analytics/stats
    fastify.get('/files/stats', async (request, reply) => {
        try {
            // Extract user ID from authorization header
            const authHeader = request.headers.authorization;
            let userId = 'default-user';

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                userId = token !== 'undefined' && token !== 'null' ? token : 'default-user';
            }

            const [
                totalFilesResult,
                processedFilesResult,
                filesByType,
                totalSizeResult
            ] = await Promise.all([
                db.select({ count: count() })
                    .from(uploadedFile)
                    .where(eq(uploadedFile.userId, userId)),
                db.select({ count: count() })
                    .from(uploadedFile)
                    .where(and(
                        eq(uploadedFile.userId, userId),
                        eq(uploadedFile.isProcessed, true)
                    )),
                db.select({
                    fileType: uploadedFile.fileType,
                    count: count()
                })
                    .from(uploadedFile)
                    .where(eq(uploadedFile.userId, userId))
                    .groupBy(uploadedFile.fileType),
                db.select({ totalSize: sum(uploadedFile.fileSize) })
                    .from(uploadedFile)
                    .where(eq(uploadedFile.userId, userId))
            ]);

            const totalFiles = totalFilesResult[0]?.count || 0;
            const processedFiles = processedFilesResult[0]?.count || 0;
            const totalSizeBytes = Number(totalSizeResult[0]?.totalSize || 0);

            return {
                totalFiles,
                processedFiles,
                unprocessedFiles: totalFiles - processedFiles,
                filesByType: filesByType.map(ft => ({
                    type: ft.fileType,
                    count: ft.count
                })),
                totalSizeBytes,
                totalSizeMB: Math.round(totalSizeBytes / (1024 * 1024) * 100) / 100
            };
        } catch (error) {
            console.error('Error fetching file stats:', error);
            return reply.code(500).send({
                error: 'Failed to fetch file stats',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
};

export default fileRoutes;
