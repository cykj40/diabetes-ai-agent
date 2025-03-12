import React from 'react';
import AgentChat from '../../components/AgentChat';

export default function AgentPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Diabetes AI Assistant</h1>
            <p className="mb-6 text-gray-600">
                Ask questions about your blood sugar data, request charts, or get insights about your patterns.
            </p>
            <AgentChat />
        </div>
    );
} 