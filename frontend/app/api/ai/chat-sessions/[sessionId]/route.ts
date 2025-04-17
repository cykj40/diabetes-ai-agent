import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function PUT(
    request: NextRequest,
    context: { params: { sessionId: string } }
) {
    try {
        const { sessionId } = context.params;
        const { title } = await request.json();

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

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user information using the token
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Validate the token and get user ID
        const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userResponse.ok) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userData = await userResponse.json();
        const userId = userData.user?.id;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Update or create the chat session on the backend
        const response = await fetch(`${backendUrl}/api/ai/chat-sessions/${sessionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                userId
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
                error: 'Failed to save chat session',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ sessionId: string }> }
) {
    try {
        // Correctly unwrap the params promise
        const params = await context.params;
        const sessionId = params.sessionId;

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

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user information using the token
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Validate the token and get user ID
        const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userResponse.ok) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userData = await userResponse.json();
        const userId = userData.user?.id;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete the chat session on the backend
        const response = await fetch(`${backendUrl}/api/ai/chat-sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
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

        return NextResponse.json({ success: true, message: 'Chat session deleted successfully' });
    } catch (error) {
        console.error('API route error:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete chat session',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 