"use client";

import { useState, useRef, useEffect } from "react";
import { BsSend, BsRobot } from 'react-icons/bs';
import { FaUser } from 'react-icons/fa';
import BloodSugarCharts from './BloodSugarCharts';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
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

export default function AIChat() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            console.log('Sending message to API:', input);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: input }),
            });

            const data = await response.json();
            console.log('API response:', data);

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to get response');
            }

            if (!data.text && !data.message) {
                console.error('Invalid response format:', data);
                throw new Error('Invalid response format from server');
            }

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: data.text || data.message,
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
                chartData: data.chartData
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error in sendMessage:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: error instanceof Error
                    ? `Error: ${error.message}`
                    : 'Sorry, I encountered an error while processing your request.',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-gray-50 rounded-lg shadow-sm">
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex items-start space-x-2 max-w-[80%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                            }`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.sender === 'user' ? 'bg-blue-500' : 'bg-gray-600'
                                }`}>
                                {message.sender === 'user' ? (
                                    <FaUser className="text-white w-4 h-4" />
                                ) : (
                                    <BsRobot className="text-white w-4 h-4" />
                                )}
                            </div>
                            <div className={`flex flex-col space-y-1 ${message.sender === 'user' ? 'items-end' : 'items-start'
                                }`}>
                                <div className={`rounded-lg p-3 ${message.sender === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-800 shadow-sm'
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                </div>
                                {message.chartData && (
                                    <div className="w-full mt-2">
                                        <BloodSugarCharts data={message.chartData} />
                                    </div>
                                )}
                                <span className="text-xs text-gray-500">{message.timestamp}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your blood sugar data..."
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center space-x-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                            }`}
                    >
                        <span>Send</span>
                        <BsSend className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}

