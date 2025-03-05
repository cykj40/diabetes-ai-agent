"use client";

import React, { useState, useRef, useEffect } from 'react';
import { BsSend, BsRobot, BsArrowRepeat, BsTrash } from 'react-icons/bs';
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
    const [sessionId, setSessionId] = useState(`session-${Date.now()}`);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Initialize with a welcome message and fetch chat history
    useEffect(() => {
        setMessages([{
            id: '1',
            text: "Hello! I'm your diabetes assistant. Ask me anything about your blood sugar data.",
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString()
        }]);

        // Fetch chat history when component mounts
        fetchChatHistory();
    }, []);

    const fetchChatHistory = async () => {
        try {
            const response = await fetch(`/api/chat/history/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.chatHistory && data.chatHistory.length > 0) {
                    setMessages(data.chatHistory);
                }
            }
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    };

    const clearChatHistory = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/chat/history/${sessionId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setMessages([{
                    id: Date.now().toString(),
                    text: "Chat history cleared. How can I help you today?",
                    sender: 'ai',
                    timestamp: new Date().toLocaleTimeString()
                }]);
            }
        } catch (error) {
            console.error('Error clearing chat history:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

            // Use the chat endpoint
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    sessionId: sessionId
                }),
            });

            const data = await response.json();
            console.log('API response:', data);

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Failed to get response');
            }

            // Format the AI response
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: data.message || "I've analyzed your request and here's my response.",
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString()
            };

            // Update messages with just the latest AI response
            // (The full history is already managed by the backend)
            setMessages(prev => [...prev.slice(0, prev.length - 1), userMessage, aiMessage]);
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

    const embedBloodSugarData = async () => {
        setIsEmbedding(true);
        try {
            // Call the embed endpoint
            const response = await fetch('/api/chat/embed-blood-sugar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    days: 7 // Embed the last 7 days of data
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to embed blood sugar data');
            }

            // Add a system message about the embedding
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: `${data.message} You can now ask questions about your recent blood sugar data.`,
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString()
            }]);
        } catch (error) {
            console.error('Error embedding blood sugar data:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: error instanceof Error
                    ? `Error embedding data: ${error.message}`
                    : 'Sorry, I encountered an error while embedding your blood sugar data.',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString()
            }]);
        } finally {
            setIsEmbedding(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-gray-50 rounded-lg shadow-sm">
            <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <div className="flex space-x-2">
                    <button
                        onClick={embedBloodSugarData}
                        disabled={isEmbedding || isLoading}
                        className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                    >
                        <BsArrowRepeat className={`mr-1 ${isEmbedding ? 'animate-spin' : ''}`} />
                        Update Data
                    </button>
                    <button
                        onClick={clearChatHistory}
                        disabled={isLoading}
                        className="flex items-center text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                    >
                        <BsTrash className="mr-1" />
                        Clear Chat
                    </button>
                </div>
            </div>
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
                        disabled={isLoading || isEmbedding}
                        className={`px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center space-x-2 ${(isLoading || isEmbedding) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
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

