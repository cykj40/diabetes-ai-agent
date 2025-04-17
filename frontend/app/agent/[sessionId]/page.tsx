'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import AgentChat from '../../../components/AgentChat';

export default function SessionPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;

    return (
        <div className="h-full">
            <AgentChat sessionId={sessionId} />
        </div>
    );
} 