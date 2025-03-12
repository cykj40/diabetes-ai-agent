'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw } from 'lucide-react';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: string;
}

export default function AgentChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sessionId = 'default';

    // Load chat history on component mount
    useEffect(() => {
        fetchChatHistory();
    }, []);

    // Scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchChatHistory = async () => {
        try {
            const response = await fetch(`/api/ai/chat-history/${sessionId}`);
            const data = await response.json();
            if (data.messages) {
                setMessages(data.messages);
            }
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
        }
    };

    const clearChatHistory = async () => {
        try {
            setIsLoading(true);
            await fetch(`/api/ai/chat-history/${sessionId}`, {
                method: 'DELETE',
            });
            setMessages([]);
            setIsLoading(false);
        } catch (error) {
            console.error('Failed to clear chat history:', error);
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        // Add user message to chat
        const userMessage: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Call the agent API
            const response = await fetch('/api/ai/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    sessionId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response from AI');
            }

            const data = await response.json();

            // Add AI response to chat
            const aiMessage: Message = {
                id: Date.now().toString() + '-ai',
                text: data.message,
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            // Add error message
            const errorMessage: Message = {
                id: Date.now().toString() + '-error',
                text: 'Sorry, there was an error processing your request. Please try again.',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Function to render message content with support for images
    const renderMessageContent = (text: string) => {
        // Check if the message contains an image URL from DALL-E
        const imageUrlMatch = text.match(/(https:\/\/[^\s]+\.(jpg|jpeg|png|gif))/i);

        if (imageUrlMatch) {
            const imageUrl = imageUrlMatch[0];
            const textWithoutImage = text.replace(imageUrl, '');

            return (
                <>
                    <p>{textWithoutImage}</p>
                    <img
                        src={imageUrl}
                        alt="Generated chart"
                        className="mt-2 rounded-lg max-w-full h-auto"
                        style={{ maxHeight: '400px' }}
                    />
                </>
            );
        }

        return <p>{text}</p>;
    };

    return (
        <div className="flex flex-col h-[70vh] bg-white rounded-lg shadow-md">
            {/* Chat header */}
            <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-semibold">AI Assistant</h2>
                <button
                    onClick={clearChatHistory}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                    disabled={isLoading}
                >
                    <RefreshCw size={16} className="mr-1" />
                    Clear Chat
                </button>
            </div>

            {/* Messages container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Start a conversation with your AI Assistant</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 ${message.sender === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}
                            >
                                {renderMessageContent(message.text)}
                                <div
                                    className={`text-xs mt-1 ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                                        }`}
                                >
                                    {message.timestamp}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSubmit} className="border-t p-4">
                <div className="flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your blood sugar, request a chart, or get insights..."
                        className="flex-1 border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
} 