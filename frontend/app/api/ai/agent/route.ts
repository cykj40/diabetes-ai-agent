import { NextResponse, NextRequest } from 'next/server';

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

        console.log("[API Route] Auth token exists:", !!token);

        // Try to get user ID if token is available
        if (token) {
            try {
                // Fetch user information using the token
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                console.log("[API Route] Using backend URL:", backendUrl);

                const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                console.log("[API Route] User auth response status:", userResponse.status);

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    if (userData.user?.id) {
                        userId = userData.user.id;
                        console.log("[API Route] Authenticated as user:", userId);
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                // Continue with default user ID
            }
        }

        // Get the request body
        const body = await request.json();
        console.log("[API Route] Request body:", {
            message: body.message?.substring(0, 50) + "...",
            sessionId: body.sessionId,
            useWebSearch: body.useWebSearch,
            hasAttachments: !!body.attachments
        });

        // Get the backend URL
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        console.log("[API Route] Calling backend at:", `${backendUrl}/api/ai/agent`);

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
                useWebSearch: body.useWebSearch || false,
                attachments: body.attachments || []
            }),
        });

        console.log("[API Route] Backend response status:", response.status);

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
        console.log("[API Route] Backend response structure:",
            Object.keys(data),
            "message?", !!data.message,
            "chatHistory?", Array.isArray(data.chatHistory),
            "sessionId?", !!data.sessionId
        );

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