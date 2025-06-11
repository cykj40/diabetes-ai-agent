'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Plus, Save, Trash2, Search, Paperclip } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ChatMessage from './ChatMessage';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: string;
    isTyping?: boolean;
}

interface AgentChatProps {
    sessionId?: string;
}

interface RecentSession {
    id: string;
    title: string;
    timestamp: string;
    messageCount?: number;
}

export default function AgentChat({ sessionId = 'default' }: AgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [title, setTitle] = useState('Diabetes AI Assistant');
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [chatName, setChatName] = useState<string>('');

    // Function to get token from cookies
    const getToken = () => {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'auth_token') {
                return value;
            }
        }
        return null;
    };

    // Focus input when component mounts
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Load chat history and title on component mount
    useEffect(() => {
        fetchChatHistory();
        fetchRecentSessions();
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

    const fetchRecentSessions = async () => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch('/api/ai/chat-sessions/recent', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const sessions = await response.json();
                console.log('Recent sessions fetched:', sessions); // Debug log
                setRecentSessions(sessions);
            } else {
                console.error('Failed to fetch recent sessions:', response.status);
            }
        } catch (error) {
            console.error('Failed to fetch recent sessions:', error);
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

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        console.log('File selected:', file.name, file.type);

        // Check file type
        const fileType = file.name.split('.').pop()?.toLowerCase();
        const allowedTypes = ['csv', 'pdf', 'txt', 'json', 'xml', 'jpg', 'jpeg', 'png'];
        if (!fileType || !allowedTypes.includes(fileType)) {
            alert('Please upload a supported file type: CSV, PDF, TXT, JSON, XML, or image files');
            return;
        }

        setIsUploadingFile(true);

        // Add user message showing file upload
        const userMessage: Message = {
            id: Date.now().toString(),
            text: `📎 Uploaded: ${file.name}`,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Add typing indicator
        const typingIndicator: Message = {
            id: 'typing-' + Date.now().toString(),
            text: 'Processing your file...',
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString(),
            isTyping: true
        };

        setMessages((prev) => [...prev, typingIndicator]);

        try {
            // Upload the file to the AI upload endpoint
            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch('/api/ai/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'X-Session-ID': sessionId
                },
                body: formData,
            });

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: ${uploadResponse.status}`);
            }

            const uploadResult = await uploadResponse.json();
            console.log('Upload result:', uploadResult);

            // Remove typing indicator
            setMessages((prev) => prev.filter(msg => !msg.isTyping));

            // Now send a message to the AI to analyze the uploaded file
            const analysisMessage = `I've uploaded a file called "${file.name}". Can you analyze this ${fileType.toUpperCase()} file and tell me what insights you can provide? If it's medical data like blood work or lab results, please provide a detailed analysis.`;

            // Send to AI agent for analysis
            const response = await fetch('/api/ai/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    message: analysisMessage,
                    sessionId,
                    useWebSearch: false,
                    attachments: [uploadResult] // Include file info
                })
            });

            if (!response.ok) {
                throw new Error(`AI analysis failed: ${response.status}`);
            }

            const result = await response.json();

            // Add AI response
            const aiMessage: Message = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                text: result.message || 'File processed successfully!',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
            };

            setMessages((prev) => [...prev.filter(msg => !msg.isTyping), aiMessage]);

        } catch (error) {
            console.error('Error uploading file:', error);

            // Remove typing indicator
            setMessages((prev) => prev.filter(msg => !msg.isTyping));

            const errorMessage: Message = {
                id: Date.now().toString(),
                text: 'Sorry, there was an error processing your file. Please try again.',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev.filter(msg => !msg.isTyping), errorMessage]);
        } finally {
            setIsUploadingFile(false);
            // Clear the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
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

        // Add typing indicator
        const typingIndicator: Message = {
            id: 'typing-' + Date.now().toString(),
            text: '...',
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString(),
            isTyping: true
        };

        setMessages((prev) => [...prev, typingIndicator]);

        try {
            // Get token from cookie if available
            const cookies = document.cookie.split(';');
            const authCookie = cookies.find(c => c.trim().startsWith('auth_token='));
            const token = authCookie ? authCookie.split('=')[1].trim() : null;
            console.log("[Chat] Auth token exists:", !!token);

            console.log("[Chat] Sending request to /api/ai/agent");
            const response = await fetch('/api/ai/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    message: input,
                    sessionId,
                    useWebSearch, // Pass the web search flag
                }),
            });

            console.log("[Chat] Response status:", response.status);

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const data = await response.json();
            console.log("[Chat] API Response:", data);
            console.log("[Chat] Response structure:",
                "keys:", Object.keys(data),
                "message?", typeof data.message,
                "chatHistory?", Array.isArray(data.chatHistory) ? data.chatHistory.length : "not array"
            );

            // Remove typing indicator
            setMessages((prev) => prev.filter(msg => !msg.isTyping));

            // Update messages from chat history if provided
            if (data.chatHistory && Array.isArray(data.chatHistory)) {
                console.log("[Chat] Using chatHistory from response");
                setMessages(data.chatHistory);
            } else if (data.message) {
                console.log("[Chat] Using message from response");
                // Fallback to adding just the response message
                const aiMessage: Message = {
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                    text: data.message,
                    sender: 'ai',
                    timestamp: new Date().toLocaleTimeString(),
                };
                setMessages((prev) => [...prev.filter(msg => !msg.isTyping), aiMessage]);
            } else {
                console.log("[Chat] No usable data in response");
                throw new Error("Invalid response format from server");
            }

            // Reset web search flag after use
            setUseWebSearch(false);
        } catch (error) {
            console.error('[Chat] Error sending message:', error);
            // Remove typing indicator
            setMessages((prev) => prev.filter(msg => !msg.isTyping));

            const errorMessage: Message = {
                id: Date.now().toString(),
                text: 'Sorry, there was an error processing your request. Please try again.',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString(),
            };
            setMessages((prev) => [...prev.filter(msg => !msg.isTyping), errorMessage]);

            // Reset web search flag after use
            setUseWebSearch(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveChat = async () => {
        console.log('Save chat clicked, messages length:', messages.length);
        console.log('Messages:', messages);

        if (messages.length === 0) {
            console.log('No messages to save, returning early');
            return;
        }

        // Generate a default chat name from the first user message if not provided
        const chatTitle = chatName.trim() || messages.find(m => m.sender === 'user')?.text.substring(0, 30) || `Chat ${new Date().toLocaleString()}`;
        console.log('Generated chat title:', chatTitle);
        setChatName(chatTitle);
        setIsSaving(true);

        try {
            // Get token from cookie if available
            const cookies = document.cookie.split(';');
            const authCookie = cookies.find(c => c.trim().startsWith('auth_token='));
            const token = authCookie ? authCookie.split('=')[1].trim() : null;

            if (!token) {
                throw new Error('Authentication required to save chats');
            }

            // Create a new session with the first message as the title
            const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: chatTitle
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to save chat: ${response.status}`);
            }

            setTitle(chatTitle);
            alert('Chat saved successfully!');

            // Refresh recent sessions list
            fetchRecentSessions();

            // If we're in a 'default' session, navigate to the new session
            if (sessionId === 'default') {
                // Get the latest sessions
                const sessionsResponse = await fetch('/api/ai/chat-sessions', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (sessionsResponse.ok) {
                    const sessions = await sessionsResponse.json();
                    if (sessions.length > 0) {
                        // Navigate to the first (most recent) session
                        router.push(`/agent/${sessions[0].id}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error saving chat:', error);
            alert(`Failed to save chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearChat = () => {
        if (confirm('Are you sure you want to clear the chat?')) {
            clearChatHistory();
        }
    };

    const toggleWebSearch = () => {
        setUseWebSearch(prev => !prev);
    };

    return (
        <div className="flex h-screen bg-white">
            {/* Sidebar */}
            <div className="w-64 bg-[#f7f7f8] text-gray-800 flex-col h-full shadow-md">
                <div className="p-3">
                    <button
                        className="w-full flex items-center gap-3 rounded-md border border-gray-300 p-3 text-sm transition-colors hover:bg-gray-100"
                        onClick={() => router.push('/agent')}
                    >
                        <Plus size={16} />
                        <span>New chat</span>
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-2">
                    <div className="text-xs text-gray-500 font-medium uppercase px-2 py-2">RECENT CHATS</div>

                    {/* Current chat if not in default */}
                    {sessionId !== 'default' && (
                        <div className="rounded-md p-2 bg-blue-100 border border-blue-200 cursor-pointer text-sm mb-2">
                            <div className="font-medium text-blue-800">Current: {title}</div>
                        </div>
                    )}

                    {/* Recent sessions */}
                    {recentSessions.length > 0 ? (
                        recentSessions.map((session) => (
                            <div
                                key={session.id}
                                className={`rounded-md p-2 cursor-pointer text-sm mb-1 hover:bg-gray-200 ${session.id === sessionId ? 'bg-blue-100 border border-blue-200' : 'bg-gray-100'
                                    }`}
                                onClick={() => router.push(`/agent/${session.id}`)}
                            >
                                <div className="font-medium truncate">
                                    {session.title || 'New Conversation'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {session.messageCount || 0} messages
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-gray-500 px-2 py-2">
                            No recent chats
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-200 p-3">
                    <button
                        className="w-full flex items-center gap-2 rounded-md p-2 text-sm hover:bg-gray-100"
                        onClick={() => router.push('/dashboard')}
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Dashboard</span>
                    </button>
                </div>
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col h-full max-h-screen overflow-hidden relative">
                <div className="flex-1 overflow-y-auto">
                    <div className="w-full">
                        <AnimatePresence>
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-600 p-8">
                                    <div className="text-center mt-8">
                                        <h1 className="text-3xl font-semibold mb-6">Diabetes AI Assistant</h1>
                                        <p className="mb-6">Ask about your blood sugar, request charts, or get insights about your health data.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-xl mx-auto">
                                            <div className="border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 cursor-pointer">
                                                <p className="font-medium">Show me my blood sugar trends</p>
                                            </div>
                                            <div className="border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 cursor-pointer">
                                                <p className="font-medium">What was my average glucose this week?</p>
                                            </div>
                                            <div className="border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 cursor-pointer">
                                                <p className="font-medium">When was my last low blood sugar?</p>
                                            </div>
                                            <div className="border border-gray-200 rounded-lg p-3 text-left hover:bg-gray-50 cursor-pointer">
                                                <p className="font-medium">Create a chart of my glucose patterns</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <ChatMessage
                                        key={message.id}
                                        id={message.id}
                                        text={message.text}
                                        sender={message.sender}
                                        timestamp={message.timestamp}
                                        isTyping={message.isTyping}
                                    />
                                ))
                            )}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input form */}
                <div className="border-t border-gray-300 bg-white">
                    <div className="max-w-3xl mx-auto p-4">
                        <form onSubmit={handleSubmit} className="relative">
                            <div className="flex items-center px-4 py-2 rounded-xl border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                                {/* File upload button */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none mr-2"
                                    title="Upload files (CSV, PDF, TXT, JSON, XML, or images)"
                                    disabled={isUploadingFile}
                                >
                                    <Paperclip size={18} />
                                </button>

                                {/* Hidden file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.pdf,.txt,.json,.xml,.jpg,.jpeg,.png"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />

                                <textarea
                                    ref={inputRef}
                                    className="flex-1 max-h-32 outline-none resize-none bg-transparent placeholder:text-gray-500"
                                    placeholder="Message the AI..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (input.trim() && !isLoading) {
                                                handleSubmit(e);
                                            }
                                        }
                                    }}
                                    rows={1}
                                ></textarea>
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        type="button"
                                        onClick={toggleWebSearch}
                                        className={`p-1 rounded-md ${useWebSearch ? 'bg-green-600 text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'} focus:outline-none`}
                                        title={useWebSearch ? "Web search enabled" : "Enable web search"}
                                    >
                                        <Search size={18} />
                                    </button>

                                    {isLoading || isUploadingFile ? (
                                        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    ) : (
                                        <button
                                            type="submit"
                                            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
                                            disabled={!input.trim()}
                                        >
                                            <Send size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleClearChat}
                                    className="flex items-center gap-1 hover:text-gray-700"
                                    disabled={messages.length === 0 || isLoading}
                                >
                                    <Trash2 size={14} />
                                    <span>Clear chat</span>
                                </button>
                                <span className="text-xs text-gray-400">
                                    📎 Upload CSV, PDF, TXT, JSON, XML, or image files
                                </span>
                            </div>
                            <button
                                onClick={handleSaveChat}
                                className="flex items-center gap-1 hover:text-gray-700"
                                disabled={messages.length === 0 || isLoading || isSaving}
                            >
                                <Save size={14} />
                                <span>{isSaving ? 'Saving...' : 'Save chat'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 