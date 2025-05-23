import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        console.log('Upload endpoint called');

        // Parse the multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.log('No file provided');
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log('File received:', file.name, file.type, file.size);

        // Get auth token
        const authHeader = request.headers.get('authorization');
        const sessionId = request.headers.get('X-Session-ID') || 'default';

        // Forward to backend upload service
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const backendFormData = new FormData();

        // Convert file to blob and append to new FormData
        const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        backendFormData.append('file', fileBlob, file.name);

        const response = await fetch(`${backendUrl}/api/file/upload`, {
            method: 'POST',
            body: backendFormData,
            headers: {
                ...(authHeader && { 'Authorization': authHeader }),
                'X-Session-ID': sessionId
            }
        });

        const result = await response.json();

        if (!response.ok) {
            return NextResponse.json(result, { status: response.status });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error processing file upload:', error);
        return NextResponse.json({
            error: 'Failed to process file upload',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 