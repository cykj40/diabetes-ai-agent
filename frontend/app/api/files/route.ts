import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const searchParams = request.nextUrl.searchParams;

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/file/files?${searchParams}`, {
            headers: {
                ...(authHeader && { 'Authorization': authHeader })
            }
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch files' },
            { status: 500 }
        );
    }
} 