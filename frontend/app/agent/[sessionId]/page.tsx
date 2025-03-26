'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import AgentChat from '../../../components/AgentChat';

export default function SessionPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1">
                <AgentChat sessionId={sessionId} />
            </div>
        </div>
    );
} 