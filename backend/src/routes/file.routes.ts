import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { unlink, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const pdf2pic = require('pdf2pic');
const prisma = new PrismaClient();

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

export default async function fileRoutes(fastify: FastifyInstance) {

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
            const uploadedFile = await prisma.uploadedFile.create({
                data: {
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
                }
            });

            console.log('File saved to database with ID:', uploadedFile.id);

            const fileInfo = {
                id: uploadedFile.id,
                name: filename,
                originalName: filename,
                uniqueName: uniqueFileName,
                type: fileExtension,
                size: fileBuffer.length,
                path: `/uploads/${sessionId}/${uniqueFileName}`,
                uploadedAt: uploadedFile.createdAt.toISOString(),
                content: content.substring(0, 10000)
            };

            return {
                success: true,
                message: 'File uploaded successfully',
                fileInfo,
                attachmentId: uploadedFile.id
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

            const skip = (page - 1) * limit;

            // Build where clause
            const where: any = { userId };

            if (fileType) {
                where.fileType = fileType;
            }

            if (sessionId) {
                where.sessionId = sessionId;
            }

            if (search) {
                where.OR = [
                    { fileName: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [files, total] = await Promise.all([
                prisma.uploadedFile.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma.uploadedFile.count({ where })
            ]);

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

            const file = await prisma.uploadedFile.findFirst({
                where: { id, userId }
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
            const existingFile = await prisma.uploadedFile.findFirst({
                where: { id, userId }
            });

            if (!existingFile) {
                return reply.code(404).send({ error: 'File not found' });
            }

            // Update file
            const updatedFile = await prisma.uploadedFile.update({
                where: { id },
                data: {
                    ...(description !== undefined && { description }),
                    ...(tags !== undefined && { tags }),
                    ...(analysis !== undefined && { analysis, isProcessed: true })
                }
            });

            return updatedFile;
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
            const existingFile = await prisma.uploadedFile.findFirst({
                where: { id, userId }
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
            await prisma.uploadedFile.delete({
                where: { id }
            });

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
                totalFiles,
                processedFiles,
                filesByType,
                totalSize
            ] = await Promise.all([
                prisma.uploadedFile.count({ where: { userId } }),
                prisma.uploadedFile.count({ where: { userId, isProcessed: true } }),
                prisma.uploadedFile.groupBy({
                    by: ['fileType'],
                    where: { userId },
                    _count: { id: true }
                }),
                prisma.uploadedFile.aggregate({
                    where: { userId },
                    _sum: { fileSize: true }
                })
            ]);

            return {
                totalFiles,
                processedFiles,
                unprocessedFiles: totalFiles - processedFiles,
                filesByType: filesByType.map(ft => ({
                    type: ft.fileType,
                    count: ft._count.id
                })),
                totalSizeBytes: totalSize._sum.fileSize || 0,
                totalSizeMB: Math.round((totalSize._sum.fileSize || 0) / (1024 * 1024) * 100) / 100
            };
        } catch (error) {
            console.error('Error fetching file stats:', error);
            return reply.code(500).send({
                error: 'Failed to fetch file stats',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
} 