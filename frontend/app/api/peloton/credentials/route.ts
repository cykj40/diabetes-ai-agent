import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const userId = authHeader.substring(7); // Remove 'Bearer ' prefix
        const body = await request.json();

        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({
                success: false,
                message: "Username and password are required"
            }, { status: 400 });
        }

        // Use NEXT_PUBLIC_BACKEND_URL with proper fallback
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        console.log('Using backend URL:', backendUrl);

        const response = await fetch(`${backendUrl}/api/peloton/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userId}`
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error saving Peloton credentials:', error);
        return NextResponse.json({
            success: false,
            message: `Error saving Peloton credentials: ${error.message}`
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const userId = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Use NEXT_PUBLIC_BACKEND_URL with proper fallback
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        console.log('Using backend URL for delete:', backendUrl);

        const response = await fetch(`${backendUrl}/api/peloton/credentials`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${userId}`
            }
        });

        const data = await response.json();

        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error('Error deleting Peloton integration:', error);
        return NextResponse.json({
            success: false,
            message: `Error deleting Peloton integration: ${error.message}`
        }, { status: 500 });
    }
} 