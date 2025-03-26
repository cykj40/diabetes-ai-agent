import React from 'react';
import AgentChat from '../../components/AgentChat';

export default function AgentPage() {
    return (
        <div className="h-full flex flex-col">
            <header className="p-4 border-b bg-white">
                <h1 className="text-xl font-semibold text-gray-800">Diabetes AI Assistant</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Ask questions about your blood sugar data, request charts, or get insights about your patterns.
                </p>
            </header>

            <div className="flex-1 p-4">
                <AgentChat />
            </div>
        </div>
    );
} 