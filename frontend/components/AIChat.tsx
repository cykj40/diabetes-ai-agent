"use client";

import React, { useState, useRef, useEffect } from 'react';
import { BsSend, BsArrowRepeat, BsTrash } from 'react-icons/bs';
import ChatHeader from './ChatHeader';
import ChatMessage from './ChatMessage';

interface Message {
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

interface ErrorResponse {
    details?: string;
    error?: string;
}

interface ApiResponse {
    message?: string;
    output?: string;
}

const BACKEND_URL = 'http://localhost:3001'; // Hardcoded backend URL for reliability

export default function AIChat() {
    const [messages, setMessages] = useState<Message[]>([{
        id: '1',
        text: "Hello! I'm your diabetes AI assistant. How can I help you today?",
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString()
    }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isClient, setIsClient] = useState(false);
    const sessionId = 'session-' + Date.now();

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        // This will only run on the client
        setIsClient(true);

        // Fetch chat history
        fetchChatHistory();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const fetchChatHistory = async () => {
        try {
            // Use the frontend API route instead of directly calling the backend
            const response = await fetch(`/api/ai/chat-history/${sessionId}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Failed to fetch chat history:', response.status);
                return;
            }

            const data = await response.json();
            console.log('Chat history:', data);

            if (data.messages && Array.isArray(data.messages)) {
                setMessages(data.messages);
            }
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    };

    const clearChatHistory = async () => {
        if (!confirm('Are you sure you want to clear the chat history?')) {
            return;
        }

        try {
            setIsLoading(true);
            // Use the frontend API route instead of directly calling the backend
            const response = await fetch(`/api/ai/chat-history/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Failed to clear chat history:', response.status);
                return;
            }

            setMessages([]);
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

            // Use the frontend API route instead of directly calling the backend
            const url = `/api/ai/chat`;
            console.log('Using frontend API route:', url);

            const requestBody = {
                message: input,
                sessionId: sessionId
            };
            console.log('Request body:', JSON.stringify(requestBody));

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody),
            }).catch(fetchError => {
                console.error('Fetch error details:', fetchError);
                throw new Error(`Network error: ${fetchError.message}`);
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Could not read error response');
                console.error('Error response text:', errorText);

                let errorData: ErrorResponse = {};
                try {
                    errorData = JSON.parse(errorText) as ErrorResponse;
                } catch (e) {
                    console.error('Failed to parse error response as JSON');
                }

                throw new Error(
                    errorData.details ||
                    errorData.error ||
                    `Server responded with status: ${response.status}`
                );
            }

            const responseText = await response.text();
            console.log('Raw response text:', responseText);

            let data: ApiResponse = {};
            try {
                data = JSON.parse(responseText) as ApiResponse;
                console.log('Parsed API response:', data);
            } catch (e) {
                console.error('Failed to parse response as JSON:', e);
                throw new Error('Invalid JSON response from server');
            }

            // Format the AI response
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: data.message || data.output || "I've analyzed your request and here's my response.",
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString()
            };

            // Update messages with the latest AI response
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

    const embedBloodSugarData = async () => {
        try {
            // Call the embed endpoint using the frontend API route
            const response = await fetch(`/api/ai/embed-blood-sugar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    // No need to pass any data, the backend will fetch from Dexcom
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || errorData.error || `Server responded with status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Embed response:', data);

            // Add a system message to indicate the data was embedded
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: 'Your blood sugar data has been embedded. You can now ask questions about it.',
                sender: 'system',
                timestamp: new Date().toLocaleTimeString()
            }]);
        } catch (error) {
            console.error('Error embedding blood sugar data:', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                text: error instanceof Error
                    ? `Error embedding data: ${error.message}`
                    : 'Sorry, I encountered an error while embedding your blood sugar data.',
                sender: 'system',
                timestamp: new Date().toLocaleTimeString()
            }]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
                <ChatHeader title="AI Chat" />
                {isClient && (
                    <div className="flex space-x-2">
                        <button
                            onClick={embedBloodSugarData}
                            disabled={isEmbedding || isLoading}
                            className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                        >
                            <BsArrowRepeat className={`mr-1 ${isEmbedding ? 'animate-spin' : ''}`} />
                            {isEmbedding ? 'Processing...' : 'Embed Blood Sugar Data'}
                        </button>
                        <button
                            onClick={clearChatHistory}
                            disabled={isLoading}
                            className="flex items-center text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                        >
                            <BsTrash className="mr-1" />
                            Clear History
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        id={message.id}
                        text={message.text}
                        sender={message.sender}
                        timestamp={message.timestamp}
                        chartData={message.chartData}
                    />
                ))}
                {isLoading && (
                    <div className="flex justify-center items-center py-4">
                        <div className="animate-pulse text-gray-500">AI is thinking...</div>
                    </div>
                )}
            </div>

            {isClient && (
                <form onSubmit={sendMessage} className="p-4 border-t">
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Ask about your blood sugar data..."
                            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className={`px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center space-x-2 ${(isLoading || isEmbedding) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
                        >
                            <span>Send</span>
                            <BsSend />
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

