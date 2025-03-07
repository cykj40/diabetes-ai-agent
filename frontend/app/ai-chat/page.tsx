// This is a Server Component by default (no "use client" directive)
import React from 'react';
import AIChat from '../../components/AIChat';

export const metadata = {
    title: 'Diabetes AI Assistant',
    description: 'Chat with your AI diabetes assistant to get insights about your blood sugar data',
};

export default function AIChatPage() {
    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6">Diabetes AI Assistant</h1>
            <p className="mb-6 text-gray-600">
                Ask questions about your blood sugar data, get insights, and receive personalized recommendations.
            </p>
            <div className="h-[600px]">
                <AIChat />
            </div>
        </div>
    );
} 