import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Parse the multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop()?.toLowerCase();

        if (!fileExtension || !['csv', 'pdf'].includes(fileExtension)) {
            return NextResponse.json({
                error: 'Invalid file type. Only CSV and PDF files are supported.'
            }, { status: 400 });
        }

        // Read file content
        const fileContent = await file.text();

        // Prepare the request to the backend
        const backendFormData = new FormData();
        const fileBlob = new Blob([fileContent], { type: file.type });
        backendFormData.append('file', fileBlob, fileName);

        // Send to backend
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
        const response = await fetch(`${backendUrl}/api/blood-work/upload`, {
            method: 'POST',
            body: backendFormData,
            // Add authorization header if available
            headers: {
                // Note: You may need to pass through authorization headers here
                // 'Authorization': request.headers.get('authorization') || '',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            return NextResponse.json(result, { status: response.status });
        }

        // Return success response with insights
        return NextResponse.json({
            success: true,
            message: "Blood work uploaded successfully! Here's what I found:",
            data: result,
            insights: result.summary || 'Blood work data processed successfully.'
        });

    } catch (error) {
        console.error('Error processing blood work upload:', error);
        return NextResponse.json({
            error: 'Failed to process file upload',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 