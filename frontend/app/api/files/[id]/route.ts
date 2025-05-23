import { NextRequest, NextResponse } from 'next/server';

interface Params {
    id: string;
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
    try {
        const authHeader = request.headers.get('authorization');

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/file/files/${params.id}`, {
            headers: {
                ...(authHeader && { 'Authorization': authHeader })
            }
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch file' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
    try {
        const authHeader = request.headers.get('authorization');
        const body = await request.json();

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/file/files/${params.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(authHeader && { 'Authorization': authHeader })
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to update file' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
    try {
        const authHeader = request.headers.get('authorization');

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/api/file/files/${params.id}`, {
            method: 'DELETE',
            headers: {
                ...(authHeader && { 'Authorization': authHeader })
            }
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete file' },
            { status: 500 }
        );
    }
} 