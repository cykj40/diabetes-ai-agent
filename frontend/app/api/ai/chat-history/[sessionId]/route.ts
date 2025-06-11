import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

type Params = {
    params: Promise<{
        sessionId: string;
    }>;
};

export async function GET(request: NextRequest, { params: paramsPromise }: Params) {
    try {
        const params = await paramsPromise;
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

        const response = await fetch(`${backendUrl}/api/ai/chat-history/${sessionId}`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
                error: 'Failed to fetch chat history',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, { params: paramsPromise }: Params) {
    try {
        const params = await paramsPromise;
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

        console.log('Deleting chat history for session:', sessionId);
        console.log('Using backend URL:', backendUrl);

        const response = await fetch(`${backendUrl}/api/ai/chat-history/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        console.log('Backend response status:', response.status);

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
        console.log('Chat history deleted successfully');

        return NextResponse.json(data);
    } catch (error) {
        console.error('API route error:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete chat history',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 