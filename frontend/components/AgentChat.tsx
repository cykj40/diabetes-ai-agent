'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Send, RefreshCw, ArrowLeft, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import type { Components } from 'react-markdown';
import AIChartRenderer from './AIChartRenderer';
import { useRouter } from 'next/navigation';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: string;
    isTyping?: boolean;
}

interface MarkdownComponentProps {
    children: ReactNode;
}

interface AgentChatProps {
    sessionId?: string;
}

export default function AgentChat({ sessionId = 'default' }: AgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [title, setTitle] = useState('Diabetes AI Assistant');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Load chat history and title on component mount
    useEffect(() => {
        fetchChatHistory();
        if (sessionId !== 'default') {
            fetchSessionTitle();
        }
    }, [sessionId]);

    // Scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchChatHistory = async () => {
        try {
            const response = await fetch(`/api/ai/chat-history/${sessionId}`);
            const data = await response.json();
            if (data.messages) {
                setMessages(data.messages.map((msg: Message) => ({ ...msg, isTyping: false })));
            }
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
        }
    };

    const fetchSessionTitle = async () => {
        try {
            const response = await fetch('/api/ai/chat-sessions');
            if (response.ok) {
                const sessions = await response.json();
                const currentSession = sessions.find((s: any) => s.id === sessionId);
                if (currentSession && currentSession.title) {
                    setTitle(currentSession.title.substring(0, 30) + (currentSession.title.length > 30 ? '...' : ''));
                }
            }
        } catch (error) {
            console.error('Failed to fetch session title:', error);
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

    const simulateTyping = async (text: string): Promise<void> => {
        return new Promise((resolve) => {
            const tempId = Date.now().toString() + '-ai';
            const aiMessage: Message = {
                id: tempId,
                text: '',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
                isTyping: true
            };

            setMessages(prev => [...prev, aiMessage]);

            let currentText = '';
            const words = text.split(' ');

            const typeWord = (index: number) => {
                if (index < words.length) {
                    currentText += (index > 0 ? ' ' : '') + words[index];
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === tempId
                                ? { ...msg, text: currentText }
                                : msg
                        )
                    );
                    setTimeout(() => typeWord(index + 1), 50); // Adjust speed here
                } else {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === tempId
                                ? { ...msg, isTyping: false }
                                : msg
                        )
                    );
                    resolve();
                }
            };

            typeWord(0);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

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
            await simulateTyping(data.message);

        } catch (error) {
            console.error('Error sending message:', error);
            await simulateTyping('Sorry, there was an error processing your request. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveChat = async () => {
        if (messages.length === 0) return;

        setIsSaving(true);
        try {
            // The chat is already being saved automatically on each message
            // This is just a visual confirmation for the user
            await new Promise(resolve => setTimeout(resolve, 500));
            alert('Chat history saved successfully');
        } catch (error) {
            console.error('Error saving chat:', error);
            alert('Failed to save chat history');
        } finally {
            setIsSaving(false);
        }
    };

    // Function to render message content with support for images and markdown
    const renderMessageContent = (text: string, isTyping: boolean = false) => {
        // Extract chart data if present
        const chartMatch = text.match(/\{[\s\S]*"type":\s*["'](line|pie)["'][\s\S]*\}/);
        let chartData = null;
        let cleanedText = text;

        if (chartMatch) {
            try {
                chartData = chartMatch[0];
                // Remove the chart data from the text
                cleanedText = text.replace(chartMatch[0], '');
            } catch (e) {
                console.error('Failed to parse chart data:', e);
            }
        }

        const components: Components = {
            p: (props) => <p className={`mb-2 ${isTyping ? 'typing' : ''} leading-relaxed`} {...props} />,
            strong: (props) => <strong className="font-bold text-inherit" {...props} />,
            ul: (props) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
            ol: (props) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
            li: (props) => <li className="mb-1" {...props} />,
            code: (props) => <code className="bg-gray-800 text-gray-200 rounded px-1 py-0.5 text-sm" {...props} />
        };

        return (
            <div className={`space-y-4 prose prose-sm sm:prose-base ${isTyping ? 'typing-container' : ''}`}>
                <ReactMarkdown components={components}>
                    {cleanedText}
                </ReactMarkdown>
                {chartData && (
                    <div className="mt-4 bg-white rounded-lg shadow-sm p-4">
                        <AIChartRenderer chartData={chartData} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
            {/* Navigation and action buttons */}
            <div className="flex flex-col p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft size={16} className="mr-1" />
                        Back to Dashboard
                    </button>
                    <button
                        onClick={handleSaveChat}
                        disabled={isSaving || messages.length === 0}
                        className="flex items-center text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-green-300 transition-colors"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                        ) : (
                            <Save size={16} className="mr-1" />
                        )}
                        Save Chat
                    </button>
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Continuing your conversation about your diabetes data.
                    </p>
                </div>
            </div>

            {/* Messages container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence>
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                                <p className="mb-2 text-lg font-medium">Start a conversation</p>
                                <p className="text-sm">Ask about your blood sugar, request charts, or get insights.</p>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[90%] rounded-lg p-4 ${message.sender === 'user'
                                        ? 'bg-blue-600 text-white prose-strong:text-white prose-headings:text-white'
                                        : 'bg-gray-100 text-gray-800 prose-strong:text-gray-900 prose-headings:text-gray-900'
                                        }`}
                                >
                                    {renderMessageContent(message.text, message.isTyping)}
                                    <div
                                        className={`text-xs mt-2 ${message.sender === 'user' ? 'text-blue-200' : 'text-gray-500'
                                            }`}
                                    >
                                        {message.timestamp}
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input form */}
            <div className="border-t p-3">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your blood sugar, request a chart, or get insights..."
                        className="w-full rounded-lg border border-gray-300 pr-12 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-transparent text-gray-500 hover:bg-gray-100 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading || !input.trim()}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                        ) : (
                            <Send size={18} className="text-blue-600" />
                        )}
                    </button>

                    {/* Clear chat button - moved to be more accessible */}
                    <div className="flex justify-end mt-2">
                        <button
                            onClick={clearChatHistory}
                            className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                            disabled={isLoading || messages.length === 0}
                            type="button"
                        >
                            <RefreshCw size={12} className="mr-1" />
                            Clear chat
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
} 