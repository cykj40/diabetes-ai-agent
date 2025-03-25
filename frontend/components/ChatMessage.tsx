"use client";

// This is a Server Component by default (no "use client" directive)
import React from 'react';
import { FaUser } from 'react-icons/fa';
import { BsRobot } from 'react-icons/bs';
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
}

export default function ChatMessage({ id, text, sender, timestamp, chartData }: MessageProps) {
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

    return (
        <div
            key={id}
            className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
        >
            <div
                className={`max-w-[80%] rounded-lg p-3 ${sender === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : sender === 'system'
                        ? 'bg-yellow-100 text-gray-800 border border-yellow-300'
                        : 'bg-gray-200 text-gray-800 rounded-bl-none'
                    }`}
            >
                <div className="flex items-center mb-1">
                    {sender === 'user' ? (
                        <FaUser className="mr-2 text-white" />
                    ) : sender === 'system' ? (
                        <span className="mr-2 text-yellow-600 text-sm font-semibold">SYSTEM</span>
                    ) : (
                        <BsRobot className="mr-2" />
                    )}
                    <span className="text-xs opacity-75">{timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap">{cleanedText}</div>

                {/* Render chart if available */}
                {typeof chartData === 'string' ? (
                    <div className="mt-3 bg-white rounded-lg p-3">
                        <AIChartRenderer chartData={chartData} />
                    </div>
                ) : chartData ? (
                    <div className="mt-3 bg-white rounded-lg p-3">
                        <BloodSugarCharts data={chartData} />
                    </div>
                ) : aiChartData ? (
                    <div className="mt-3 bg-white rounded-lg p-3">
                        <AIChartRenderer chartData={aiChartData} />
                    </div>
                ) : null}
            </div>
        </div>
    );
} 