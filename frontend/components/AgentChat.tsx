'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Plus, Save, Trash2, Search, Paperclip, Edit3, MoreVertical, Check, X } from 'lucide-react';
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
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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

    // New Chat - Save current chat if it has messages, then navigate to new chat
    const handleNewChat = async () => {
        // If current chat has messages and is not saved, save it first
        if (messages.length > 0 && sessionId === 'default') {
            await handleSaveChat();
        }

        // Navigate to new chat
        router.push('/agent');

        // Clear current messages
        setMessages([]);
        setTitle('Diabetes AI Assistant');

        // Refresh recent sessions to show the newly saved chat
        fetchRecentSessions();
    };

    // Delete session
    const handleDeleteSession = async (sessionIdToDelete: string, event: React.MouseEvent) => {
        event.stopPropagation();

        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }

        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/ai/chat-sessions/${sessionIdToDelete}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // If we're deleting the current session, redirect to new chat
                if (sessionIdToDelete === sessionId) {
                    router.push('/agent');
                }
                // Refresh the sessions list
                fetchRecentSessions();
            } else {
                alert('Failed to delete conversation');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            alert('Failed to delete conversation');
        }
    };

    // Start editing session title
    const handleStartEdit = (session: RecentSession, event: React.MouseEvent) => {
        event.stopPropagation();
        setEditingSessionId(session.id);
        setEditingTitle(session.title);
        setActiveDropdown(null);
    };

    // Save edited title
    const handleSaveEdit = async (sessionIdToEdit: string) => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/ai/chat-sessions/${sessionIdToEdit}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: editingTitle
                })
            });

            if (response.ok) {
                setEditingSessionId(null);
                setEditingTitle('');
                fetchRecentSessions();

                // Update current title if editing current session
                if (sessionIdToEdit === sessionId) {
                    setTitle(editingTitle.substring(0, 30) + (editingTitle.length > 30 ? '...' : ''));
                }
            } else {
                alert('Failed to update conversation title');
            }
        } catch (error) {
            console.error('Error updating session:', error);
            alert('Failed to update conversation title');
        }
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setEditingSessionId(null);
        setEditingTitle('');
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
            let uploadResult;
            let analysisMessage;

            // Check if this is a blood work file (CSV or PDF with medical-sounding names)
            const isBloodWork = (fileType === 'csv' || fileType === 'pdf') &&
                (file.name.toLowerCase().includes('blood') ||
                    file.name.toLowerCase().includes('lab') ||
                    file.name.toLowerCase().includes('test') ||
                    file.name.toLowerCase().includes('result') ||
                    file.name.toLowerCase().includes('panel'));

            if (isBloodWork || (fileType === 'csv' || fileType === 'pdf')) {
                // Try blood work upload first for CSV/PDF files
                try {
                    const formData = new FormData();
                    formData.append('file', file);

                    const bloodWorkResponse = await fetch('/api/blood-work/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${getToken()}`
                        },
                        body: formData,
                    });

                    if (bloodWorkResponse.ok) {
                        uploadResult = await bloodWorkResponse.json();
                        console.log('Blood work upload successful:', uploadResult);

                        analysisMessage = uploadResult.insights ||
                            `✅ **Blood Work Analysis Complete**\n\n${uploadResult.message}\n\n` +
                            `📊 **Summary:**\n` +
                            `• Tests processed: ${uploadResult.testsCount || 0}\n` +
                            `• Abnormal results: ${uploadResult.abnormalCount || 0}\n\n` +
                            `🔍 You can now ask me questions about your lab results, like:\n` +
                            `• "What's my cholesterol level?"\n` +
                            `• "Show me my abnormal results"\n` +
                            `• "What foods should I eat based on my lab results?"`;
                    } else {
                        // If blood work upload fails, fall back to general file upload
                        throw new Error('Blood work processing failed');
                    }
                } catch (bloodWorkError) {
                    console.log('Blood work upload failed, trying general upload:', bloodWorkError);
                    // Fall back to general file upload
                    const formData = new FormData();
                    formData.append('file', file);

                    const generalResponse = await fetch('/api/ai/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    if (generalResponse.ok) {
                        uploadResult = await generalResponse.json();
                        analysisMessage = uploadResult.message || 'File uploaded successfully. You can now ask questions about the content.';
                    } else {
                        throw new Error('File upload failed');
                    }
                }
            } else {
                // For other file types, use general upload
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/ai/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    uploadResult = await response.json();
                    analysisMessage = uploadResult.message || 'File uploaded successfully. You can now ask questions about the content.';
                } else {
                    throw new Error('File upload failed');
                }
            }

            // Remove typing indicator and add AI response
            setMessages((prev) => {
                const filteredMessages = prev.filter(msg => !msg.isTyping);
                return [
                    ...filteredMessages,
                    {
                        id: Date.now().toString(),
                        text: analysisMessage,
                        sender: 'ai',
                        timestamp: new Date().toLocaleTimeString(),
                    }
                ];
            });

        } catch (error) {
            console.error('File upload error:', error);

            // Remove typing indicator and show error
            setMessages((prev) => {
                const filteredMessages = prev.filter(msg => !msg.isTyping);
                return [
                    ...filteredMessages,
                    {
                        id: Date.now().toString(),
                        text: `❌ Sorry, there was an error processing your file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        sender: 'ai',
                        timestamp: new Date().toLocaleTimeString(),
                    }
                ];
            });
        } finally {
            setIsUploadingFile(false);
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
            text: 'Thinking...',
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString(),
            isTyping: true
        };

        setMessages((prev) => [...prev, typingIndicator]);

        try {
            const response = await fetch('/api/ai/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    sessionId,
                    useWebSearch,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Remove typing indicator and add AI response
            setMessages((prev) => {
                const filteredMessages = prev.filter(msg => !msg.isTyping);
                return [
                    ...filteredMessages,
                    {
                        id: Date.now().toString(),
                        text: data.message,
                        sender: 'ai',
                        timestamp: new Date().toLocaleTimeString(),
                    }
                ];
            });

        } catch (error) {
            console.error('Error:', error);

            // Remove typing indicator and show error
            setMessages((prev) => {
                const filteredMessages = prev.filter(msg => !msg.isTyping);
                return [
                    ...filteredMessages,
                    {
                        id: Date.now().toString(),
                        text: 'Sorry, there was an error processing your request. Please try again.',
                        sender: 'ai',
                        timestamp: new Date().toLocaleTimeString(),
                    }
                ];
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveChat = async () => {
        if (messages.length === 0) {
            alert('No messages to save');
            return;
        }

        setIsSaving(true);

        try {
            const token = getToken();
            if (!token) {
                alert('Please sign in to save chats');
                return;
            }

            // Generate a title from the first user message or use a default
            const firstUserMessage = messages.find(msg => msg.sender === 'user');
            const autoTitle = firstUserMessage
                ? firstUserMessage.text.substring(0, 50) + (firstUserMessage.text.length > 50 ? '...' : '')
                : 'New Conversation';

            if (sessionId === 'default') {
                // Create a new session
                const createResponse = await fetch('/api/ai/chat-sessions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        title: chatName || autoTitle
                    })
                });

                if (!createResponse.ok) {
                    const errorData = await createResponse.json();
                    throw new Error(errorData.error || 'Failed to create chat session');
                }

                const newSession = await createResponse.json();

                // Save messages to the new session
                for (const message of messages.filter(msg => !msg.isTyping)) {
                    await fetch(`/api/ai/chat-history/${newSession.id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            message: message.text,
                            type: message.sender === 'user' ? 'human' : 'ai',
                            timestamp: message.timestamp
                        })
                    });
                }

                alert('Chat saved successfully!');

                // Navigate to the new session
                router.push(`/agent/${newSession.id}`);
            } else {
                // Update existing session title if provided
                if (chatName && chatName !== title) {
                    const updateResponse = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            title: chatName
                        })
                    });

                    if (updateResponse.ok) {
                        setTitle(chatName);
                        alert('Chat title updated successfully!');
                    }
                } else {
                    alert('Chat is already saved!');
                }
            }

            // Refresh recent sessions
            fetchRecentSessions();
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

    // Filter sessions based on search query
    const filteredSessions = recentSessions.filter(session =>
        session.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-white">
            {/* Enhanced Sidebar with CRUD Operations */}
            <div className="w-80 bg-[#f7f7f8] text-gray-800 flex-col h-full shadow-md border-r">
                {/* New Chat Button */}
                <div className="p-4 border-b">
                    <button
                        className="w-full flex items-center gap-3 rounded-lg border border-gray-300 p-3 text-sm font-medium transition-colors hover:bg-gray-100 hover:border-gray-400"
                        onClick={handleNewChat}
                    >
                        <Plus size={18} />
                        <span>New Chat</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-auto">
                    <div className="p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase mb-3">CONVERSATIONS</div>

                        {/* Current chat indicator */}
                        {sessionId !== 'default' && (
                            <div className="rounded-lg p-3 bg-blue-50 border border-blue-200 mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <div className="font-medium text-blue-800 text-sm truncate">
                                        Current: {title}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sessions list */}
                        {filteredSessions.length > 0 ? (
                            <div className="space-y-1">
                                {filteredSessions.map((session) => (
                                    <div
                                        key={session.id}
                                        className={`group relative rounded-lg p-3 cursor-pointer transition-colors ${session.id === sessionId
                                            ? 'bg-blue-100 border border-blue-200'
                                            : 'hover:bg-gray-100'
                                            }`}
                                        onClick={() => router.push(`/agent/${session.id}`)}
                                    >
                                        {editingSessionId === session.id ? (
                                            // Edit mode
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingTitle}
                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleSaveEdit(session.id);
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSaveEdit(session.id);
                                                    }}
                                                    className="text-green-600 hover:text-green-800 p-1"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancelEdit();
                                                    }}
                                                    className="text-gray-600 hover:text-gray-800 p-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            // Normal mode
                                            <>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm truncate text-gray-900">
                                                            {session.title || 'New Conversation'}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {session.messageCount || 0} messages
                                                        </div>
                                                    </div>

                                                    {/* Actions dropdown */}
                                                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdown(activeDropdown === session.id ? null : session.id);
                                                            }}
                                                            className="p-1 hover:bg-gray-200 rounded"
                                                        >
                                                            <MoreVertical size={14} />
                                                        </button>

                                                        {activeDropdown === session.id && (
                                                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                                                                <button
                                                                    onClick={(e) => handleStartEdit(session, e)}
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                                                                >
                                                                    <Edit3 size={12} />
                                                                    Rename
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteSession(session.id, e)}
                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
                                                                >
                                                                    <Trash2 size={12} />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 text-center py-8">
                                {searchQuery ? 'No conversations found' : 'No conversations yet'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom actions */}
                <div className="border-t border-gray-200 p-4">
                    <div className="space-y-2">
                        <button
                            className="w-full flex items-center gap-2 rounded-md p-2 text-sm hover:bg-gray-100"
                            onClick={() => router.push('/conversations')}
                        >
                            <Search size={16} />
                            <span>View All Conversations</span>
                        </button>
                        <button
                            className="w-full flex items-center gap-2 rounded-md p-2 text-sm hover:bg-gray-100"
                            onClick={() => router.push('/dashboard')}
                        >
                            <ArrowLeft size={16} />
                            <span>Back to Dashboard</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col h-full">
                {/* Chat header */}
                <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                        {sessionId !== 'default' && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                Session: {sessionId.substring(0, 8)}...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleWebSearch}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${useWebSearch
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}
                        >
                            Web Search {useWebSearch ? 'ON' : 'OFF'}
                        </button>
                        <button
                            onClick={handleSaveChat}
                            disabled={isSaving || messages.length === 0}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Save Chat"
                        >
                            <Save size={18} />
                        </button>
                        <button
                            onClick={handleClearChat}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
                            title="Clear Chat"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-500 mt-16">
                            <div className="text-6xl mb-4">🩺</div>
                            <h2 className="text-2xl font-semibold mb-2">Welcome to your Diabetes AI Assistant</h2>
                            <p className="text-lg mb-6">I can help you with blood sugar management, nutrition advice, and analyzing your health data.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h3 className="font-semibold text-blue-800 mb-2">📊 Upload Blood Work</h3>
                                    <p className="text-sm text-blue-600">Upload your lab results (CSV/PDF) and I'll provide personalized nutrition and insulin recommendations.</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h3 className="font-semibold text-green-800 mb-2">🍎 Nutrition Guidance</h3>
                                    <p className="text-sm text-green-600">Ask about food choices, carb counting, and meal planning for diabetes management.</p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <h3 className="font-semibold text-purple-800 mb-2">💉 Insulin Help</h3>
                                    <p className="text-sm text-purple-600">Get guidance on insulin dosing, timing, and management strategies.</p>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                    <h3 className="font-semibold text-orange-800 mb-2">📈 Data Analysis</h3>
                                    <p className="text-sm text-orange-600">Upload glucose readings, exercise data, or other health metrics for insights.</p>
                                </div>
                            </div>
                            <div className="mt-8 text-gray-600">
                                <p className="text-sm">Try asking:</p>
                                <div className="flex flex-wrap justify-center gap-2 mt-2">
                                    {[
                                        '"What should I eat for breakfast?"',
                                        '"Analyze my blood work results"',
                                        '"How much insulin should I take?"',
                                        '"What\'s a good post-workout snack?"'
                                    ].map((example, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setInput(example.replace(/"/g, ''))}
                                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700"
                                        >
                                            {example}
                                        </button>
                                    ))}
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
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-gray-200 p-4 bg-white">
                    <form onSubmit={handleSubmit} className="flex items-end gap-3">
                        <div className="flex-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                                placeholder="Type your message here... (Shift+Enter for new line)"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={1}
                                style={{
                                    minHeight: '50px',
                                    maxHeight: '120px',
                                    height: 'auto',
                                }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                                }}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".csv,.pdf,.txt,.json,.xml,.jpg,.jpeg,.png"
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingFile}
                                className="p-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Upload file"
                            >
                                <Paperclip size={20} />
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
} 