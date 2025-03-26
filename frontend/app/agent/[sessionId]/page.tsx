'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AgentChat from '../../../components/AgentChat';

export default function SessionPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;
    const [title, setTitle] = useState('Diabetes AI Assistant');

    useEffect(() => {
        // Fetch session title if needed
        const fetchSessionTitle = async () => {
            try {
                const response = await fetch('/api/ai/chat-sessions');
                if (response.ok) {
                    const sessions = await response.json();
                    const currentSession = sessions.find((s: any) => s.id === sessionId);
                    if (currentSession && currentSession.title) {
                        setTitle(currentSession.title.substring(0, 30) + (currentSession.title.length > 30 ? '...' : ''));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch session title:', error);
            }
        };

        if (sessionId !== 'default') {
            fetchSessionTitle();
        }
    }, [sessionId]);

    return (
        <div className="h-full flex flex-col">
            <header className="p-4 border-b bg-white">
                <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Continuing your conversation about your diabetes data.
                </p>
            </header>

            <div className="flex-1 p-4">
                <AgentChat sessionId={sessionId} />
            </div>
        </div>
    );
} 