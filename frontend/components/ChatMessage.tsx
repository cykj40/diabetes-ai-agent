"use client";

// This is a Server Component by default (no "use client" directive)
import React from 'react';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import BloodSugarCharts from './BloodSugarCharts';
import AIChartRenderer from './AIChartRenderer';

interface MessageProps {
    id: string;
    text: string;
    sender: 'user' | 'ai' | 'system';
    timestamp: string;
    chartData?: string | {
        type: 'line' | 'bar' | 'timeOfDay';
        data: {
            labels: string[];
            values: number[];
            trends?: string[];
        };
        title: string;
        insights?: string[];
    };
    isTyping?: boolean;
}

export default function ChatMessage({ id, text, sender, timestamp, chartData, isTyping = false }: MessageProps) {
    // Try to extract chart data from the message text if it's from AI
    const extractChartData = (text: string): string | null => {
        // First try to find JSON code blocks
        const codeBlockMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        // Then try to find plain JSON objects
        const jsonMatch = text.match(/\{[\s\S]*"type":\s*["'](line|pie)["'][\s\S]*\}/);
        if (jsonMatch) {
            try {
                // Validate that it's proper chart data
                const data = JSON.parse(jsonMatch[0]);
                if (data.type && data.data && data.data.datasets) {
                    return jsonMatch[0];
                }
            } catch (e) {
                console.error('Failed to parse chart data:', e);
            }
        }

        return null;
    };

    const aiChartData = sender === 'ai' ? extractChartData(text) : null;

    // Clean the text by removing both code blocks and plain JSON objects
    const cleanedText = text
        .replace(/```json\n[\s\S]*?\n```/, '')
        .replace(/\{[\s\S]*"type":\s*["'](line|pie)["'][\s\S]*\}/, '')
        .trim();

    const components = {
        p: (props: any) => <p className="mb-2 leading-relaxed" {...props} />,
        strong: (props: any) => <strong className="font-bold" {...props} />,
        ul: (props: any) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
        ol: (props: any) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
        li: (props: any) => <li className="mb-1" {...props} />,
        code: (props: any) => <code className="bg-gray-100 rounded px-1 py-0.5 text-sm font-mono" {...props} />
    };

    return (
        <div
            key={id}
            className={`w-full ${sender === 'ai' ? 'bg-gray-50' : 'bg-white'} border-b border-gray-200`}
        >
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : sender === 'system'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-teal-600 text-white'
                        }`}>
                        {sender === 'user' ? (
                            <User size={16} />
                        ) : sender === 'system' ? (
                            <span className="text-xs font-semibold">SYS</span>
                        ) : (
                            <Bot size={16} />
                        )}
                    </div>

                    {/* Message content */}
                    <div className="flex-1 text-gray-800 min-w-0">
                        <div className={`prose prose-sm sm:prose-base ${isTyping ? 'typing-animation' : ''}`}>
                            <ReactMarkdown components={components}>
                                {cleanedText}
                            </ReactMarkdown>
                        </div>

                        {/* Render chart if available */}
                        {typeof chartData === 'string' ? (
                            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                                <AIChartRenderer chartData={chartData} />
                            </div>
                        ) : chartData ? (
                            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                                <BloodSugarCharts data={chartData} />
                            </div>
                        ) : aiChartData ? (
                            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
                                <AIChartRenderer chartData={aiChartData} />
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
} 