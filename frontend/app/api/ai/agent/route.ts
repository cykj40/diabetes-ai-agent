import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        // Get auth token from request header - using header is more reliable in API routes
        const authHeader = request.headers.get('authorization');
        let token = null;

        // First check for Authorization header
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // If no header, try to get from cookies
        if (!token) {
            token = request.cookies.get('auth_token')?.value;
        }

        // Default to anonymous user if no token
        let userId = 'default-user';

        // Try to get user ID if token is available
        if (token) {
            try {
                // Fetch user information using the token
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

                const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.user?.id) {
                        userId = userData.user.id;
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                // Continue with default user ID
            }
        }

        // Get the request body
        const body = await request.json();

        // Get the backend URL
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        const response = await fetch(`${backendUrl}/api/ai/agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Pass token if available, but don't require it
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                message: body.message,
                sessionId: body.sessionId,
                useWebSearch: body.useWebSearch || false
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error response:', errorText);

            let errorData = {};
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                console.error('Failed to parse error response as JSON');
            }

            return NextResponse.json(
                errorData || { error: `Server responded with status: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API route error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process request',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 