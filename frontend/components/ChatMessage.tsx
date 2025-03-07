"use client";

// This is a Server Component by default (no "use client" directive)
import React from 'react';
import { FaUser } from 'react-icons/fa';
import { BsRobot } from 'react-icons/bs';
import BloodSugarCharts from './BloodSugarCharts';

interface MessageProps {
    id: string;
    text: string;
    sender: 'user' | 'ai' | 'system';
    timestamp: string;
    chartData?: {
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
                <div className="whitespace-pre-wrap">{text}</div>

                {/* Render chart if available */}
                {chartData && (
                    <div className="mt-3 bg-white rounded-lg p-3">
                        <BloodSugarCharts data={chartData} />
                    </div>
                )}
            </div>
        </div>
    );
} 