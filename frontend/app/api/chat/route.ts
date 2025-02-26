import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { message } = await request.json();

        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            throw new Error('Failed to get response from backend');
        }

        const data = await response.json();

        return NextResponse.json({ response: data.response });
    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json(
            { error: 'Failed to process chat request' },
            { status: 500 }
        );
    }
} 