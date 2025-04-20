import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Get user credentials from request body
        const body = await request.json();
        const { username, password } = body;

        // Validate input
        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'Username and password are required' },
                { status: 400 }
            );
        }

        // Get the backend URL from environment variables
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Forward the credentials to the backend
        const response = await fetch(`${backendUrl}/auth/dexcom/direct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        // Get the response data
        const data = await response.json();

        // Return the response from the backend
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Error in direct Dexcom authentication:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to authenticate with Dexcom' },
            { status: 500 }
        );
    }
} 