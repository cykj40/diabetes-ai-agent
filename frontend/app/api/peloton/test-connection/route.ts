import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const userId = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Use NEXT_PUBLIC_BACKEND_URL and provide a fallback
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        const response = await fetch(`${backendUrl}/api/peloton/test-connection`, {
            headers: {
                'Authorization': `Bearer ${userId}`
            }
        });

        const data = await response.json();

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error testing Peloton connection:', error);
        return NextResponse.json({
            success: false,
            message: `Error testing Peloton connection: ${error.message}`
        }, { status: 500 });
    }
} 