import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
    // Get the path
    const path = request.nextUrl.pathname;

    // Handle hyphenated routes
    if (path === '/sign-in') {
        return NextResponse.redirect(new URL('/signin', request.url));
    }

    if (path === '/sign-up') {
        return NextResponse.redirect(new URL('/signup', request.url));
    }

    // Define public routes that don't require authentication
    const isPublicPath = path === '/signin' ||
        path === '/signup' ||
        path.startsWith('/_next') ||
        path.startsWith('/api/auth') ||
        path.startsWith('/api/ai/agent') ||
        path === '/';

    // Get the token from cookies
    const token = request.cookies.get('auth_token')?.value;

    // If the path requires authentication and no token exists, redirect to signin
    if (!isPublicPath && !token) {
        return NextResponse.redirect(new URL('/signin', request.url));
    }

    // If the user is already authenticated and tries to access signin/signup, redirect to chat
    if (isPublicPath && token && (path === '/signin' || path === '/signup')) {
        return NextResponse.redirect(new URL('/agent', request.url));
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        // Protected routes that require authentication
        '/agent/:path*',

        // Auth routes - handled differently if user is already logged in
        '/signin',
        '/signup',

        // Add routes with hyphens that should redirect
        '/sign-in',
        '/sign-up',
    ],
}; 