'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiRequest } from '../../lib/api'
import { mockDelay } from '../lib/utils'

// Define Zod schema for signin validation
const SignInSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
})

// Define Zod schema for signup validation
const SignUpSchema = z
    .object({
        email: z.string().min(1, 'Email is required').email('Invalid email format'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })

export type SignInData = z.infer<typeof SignInSchema>
export type SignUpData = z.infer<typeof SignUpSchema>

export type ActionResponse = {
    success: boolean
    message: string
    errors?: Record<string, string[]>
    error?: string
    token?: string
}



export async function signIn(formData: FormData): Promise<ActionResponse> {
    try {
        // Add a small delay to simulate network latency
        await mockDelay(700)

        // Extract data from form
        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
        }

        // Validate with Zod
        const validationResult = SignInSchema.safeParse(data)
        if (!validationResult.success) {
            return {
                success: false,
                message: 'Validation failed',
                errors: validationResult.error.flatten().fieldErrors,
            }
        }

        // Call the backend API
        const result = await apiRequest('/api/auth/signin', { method: 'POST', body: JSON.stringify(data) });

        // If successful, store the token in a cookie
        if (result.success && result.token) {
            // Use document.cookie in client component
            // For server component, return the token and set cookie on client side
            return {
                ...result,
                token: result.token // Return token to client for cookie setting
            };
        }

        return result;
    } catch (error) {
        console.error('Sign in error:', error)
        return {
            success: false,
            message: 'An error occurred while signing in',
            error: 'Failed to sign in',
        }
    }
}

export async function signUp(formData: FormData): Promise<ActionResponse> {
    try {
        // Add a small delay to simulate network latency
        await mockDelay(700)

        // Extract data from form
        const data = {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
            confirmPassword: formData.get('confirmPassword') as string,
        }

        // Validate with Zod
        const validationResult = SignUpSchema.safeParse(data)
        if (!validationResult.success) {
            return {
                success: false,
                message: 'Validation failed',
                errors: validationResult.error.flatten().fieldErrors,
            }
        }

        // Call the backend API
        const result = await apiRequest('/api/auth/signup', { 
            method: 'POST', 
            body: JSON.stringify({
                email: data.email,
                password: data.password,
            })
        });

        // If successful, return the token for client-side cookie setting
        if (result.success && result.token) {
            return {
                ...result,
                token: result.token // Return token to client for cookie setting
            };
        }

        return result;
    } catch (error) {
        console.error('Sign up error:', error)
        return {
            success: false,
            message: 'An error occurred while creating your account',
            error: 'Failed to create account',
        }
    }
}

export async function signOut(): Promise<void> {
    try {
        await mockDelay(300)

        // Cookie will be deleted on client side

        // Call the signout endpoint (optional)
        await apiRequest('/api/auth/signout', { method: 'POST' });
    } catch (error) {
        console.error('Sign out error:', error)
        throw new Error('Failed to sign out')
    } finally {
        redirect('/signin')
    }
}

// Get current user from JWT token
export async function getCurrentUser(token?: string) {
    if (!token) {
        return null;
    }

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (!data.success) {
            return null;
        }

        return data.user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}
