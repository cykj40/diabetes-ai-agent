import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        // Get the backend URL from environment variables
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        // Create the redirect URL to the backend Dexcom auth endpoint
        const redirectUrl = `${backendUrl}/auth/dexcom/login`;

        // Log for debugging
        console.log(`Redirecting to Dexcom auth: ${redirectUrl}`);

        // Return a redirect response
        return NextResponse.redirect(redirectUrl);
    } catch (error) {
        console.error('Error redirecting to Dexcom auth:', error);
        return NextResponse.json(
            { error: 'Failed to redirect to Dexcom authentication' },
            { status: 500 }
        );
    }
} 