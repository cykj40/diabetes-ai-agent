import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        console.log('Blood work upload endpoint called');

        // Parse the multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.log('No file provided');
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log('Blood work file received:', file.name, file.type, file.size);

        // Validate file type
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop()?.toLowerCase();

        if (!fileExtension || !['csv', 'pdf'].includes(fileExtension)) {
            return NextResponse.json({
                error: 'Invalid file type. Only CSV and PDF files are supported for blood work analysis.'
            }, { status: 400 });
        }

        // Get auth token and forward to backend
        const authHeader = request.headers.get('authorization');

        // Prepare the request to the backend
        const backendFormData = new FormData();
        const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
        backendFormData.append('file', fileBlob, fileName);

        // Send to backend blood work service
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        console.log('Forwarding to backend:', `${backendUrl}/api/blood-work/upload`);

        const response = await fetch(`${backendUrl}/api/blood-work/upload`, {
            method: 'POST',
            body: backendFormData,
            headers: {
                ...(authHeader && { 'Authorization': authHeader }),
            },
        });

        const result = await response.json();
        console.log('Backend response:', result);

        if (!response.ok) {
            return NextResponse.json(result, { status: response.status });
        }

        // Return enhanced response with better formatting
        return NextResponse.json({
            success: true,
            message: "Blood work uploaded and analyzed successfully!",
            insights: result.summary || `📊 Processed ${result.testsCount || 0} lab tests from ${result.recordName || fileName}.\n${result.abnormalCount > 0 ? `⚠️ Found ${result.abnormalCount} abnormal results that may need attention.` : '✅ All results appear within normal ranges.'}`,
            data: result,
            recordId: result.recordId,
            recordName: result.recordName,
            testsCount: result.testsCount || 0,
            abnormalCount: result.abnormalCount || 0
        });

    } catch (error) {
        console.error('Error processing blood work upload:', error);
        return NextResponse.json({
            error: 'Failed to process blood work upload',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 