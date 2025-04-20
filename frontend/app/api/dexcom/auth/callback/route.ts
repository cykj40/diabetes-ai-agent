import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Get the URL and extract the code and state parameters
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        // Validate parameters
        if (!code || !state) {
            console.error('Missing code or state parameter in callback');
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Log for debugging
        console.log(`Received Dexcom callback with code: ${code.substring(0, 8)}... and state: ${state.substring(0, 8)}...`);

        // Get the backend URL from environment variables
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Forward to the backend with the code and state
        const callbackUrl = `${backendUrl}/auth/dexcom/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

        // Return a redirect response to the backend
        return NextResponse.redirect(callbackUrl);
    } catch (error) {
        console.error('Error handling Dexcom callback:', error);
        return NextResponse.json(
            { error: 'Failed to process Dexcom callback' },
            { status: 500 }
        );
    }
} 