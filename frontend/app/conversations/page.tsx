'use client';

import React, { useState, useEffect } from 'react';
import {
    MessageSquare,
    Trash2,
    Edit3,
    Eye,
    Calendar,
    Search,
    Filter,
    Download,
    ArrowRight,
    Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ChatSession {
    id: string;
    title: string;
    timestamp: string;
    messageCount?: number;
}

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: string;
}

export default function ConversationsPage() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingSession, setEditingSession] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [showMessages, setShowMessages] = useState(false);
    const router = useRouter();

    // Get auth token
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

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const token = getToken();
            if (!token) {
                router.push('/signin');
                return;
            }

            const response = await fetch('/api/ai/chat-sessions', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            } else {
                console.error('Failed to fetch sessions');
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (sessionId: string) => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/ai/chat-history/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const handleViewMessages = async (sessionId: string) => {
        setSelectedSession(sessionId);
        setShowMessages(true);
        await fetchMessages(sessionId);
    };

    const handleEditSession = (session: ChatSession) => {
        setEditingSession(session.id);
        setEditTitle(session.title);
    };

    const handleSaveEdit = async (sessionId: string) => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: editTitle
                })
            });

            if (response.ok) {
                setEditingSession(null);
                fetchSessions();
            }
        } catch (error) {
            console.error('Error updating session:', error);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) return;

        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/ai/chat-sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                fetchSessions();
                if (selectedSession === sessionId) {
                    setSelectedSession(null);
                    setShowMessages(false);
                }
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    const handleContinueConversation = (sessionId: string) => {
        router.push(`/agent/${sessionId}`);
    };

    const exportConversation = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;

        const exportData = {
            title: session.title,
            timestamp: session.timestamp,
            messages: messages
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const truncateText = (text: string, maxLength: number) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const filteredSessions = sessions.filter(session =>
        session.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
                            <p className="text-gray-600 mt-1">Manage your chat history and conversations</p>
                        </div>
                        <button
                            onClick={() => router.push('/agent')}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            <MessageSquare size={20} />
                            New Conversation
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Sessions List */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Chat Sessions</h2>

                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-2 text-gray-600">Loading conversations...</p>
                                </div>
                            ) : filteredSessions.length === 0 ? (
                                <div className="p-8 text-center">
                                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-600">No conversations found</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {filteredSessions.map((session) => (
                                        <div key={session.id} className="p-4 hover:bg-gray-50">
                                            {editingSession === session.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleSaveEdit(session.id);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingSession(null);
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => handleSaveEdit(session.id)}
                                                        className="text-green-600 hover:text-green-800 text-sm"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingSession(null)}
                                                        className="text-gray-600 hover:text-gray-800 text-sm"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <h3 className="font-medium text-gray-900">
                                                                {truncateText(session.title, 40)}
                                                            </h3>
                                                            <div className="flex items-center text-sm text-gray-500 mt-1">
                                                                <Clock size={14} className="mr-1" />
                                                                {formatDate(session.timestamp)}
                                                            </div>
                                                        </div>
                                                        <div className="flex space-x-1 ml-2">
                                                            <button
                                                                onClick={() => handleViewMessages(session.id)}
                                                                className="text-blue-600 hover:text-blue-800"
                                                                title="View messages"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditSession(session)}
                                                                className="text-gray-600 hover:text-gray-800"
                                                                title="Edit title"
                                                            >
                                                                <Edit3 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => exportConversation(session.id)}
                                                                className="text-green-600 hover:text-green-800"
                                                                title="Export conversation"
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleContinueConversation(session.id)}
                                                                className="text-purple-600 hover:text-purple-800"
                                                                title="Continue conversation"
                                                            >
                                                                <ArrowRight size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSession(session.id)}
                                                                className="text-red-600 hover:text-red-800"
                                                                title="Delete conversation"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messages View */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {showMessages ? 'Messages' : 'Select a conversation to view messages'}
                            </h2>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {showMessages && selectedSession ? (
                                messages.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600">No messages in this conversation</p>
                                    </div>
                                ) : (
                                    <div className="p-4 space-y-4">
                                        {messages.map((message) => (
                                            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender === 'user'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-900'
                                                    }`}>
                                                    <p className="text-sm">{message.text}</p>
                                                    <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                                                        }`}>
                                                        {message.timestamp}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="p-8 text-center">
                                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Select a conversation from the list to view its messages</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 