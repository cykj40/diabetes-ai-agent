'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FiPlusCircle, FiMessageSquare, FiChevronLeft, FiChevronRight, FiTrash2 } from 'react-icons/fi';
import { usePathname } from 'next/navigation';

interface ChatSession {
    id: string;
    title: string;
    timestamp: string;
}

interface ChatSidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
}

export default function ChatSidebar({ isOpen, toggleSidebar }: ChatSidebarProps) {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();
    const currentSessionId = pathname.includes('/agent/') ? pathname.split('/').pop() : 'default';

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const response = await fetch('/api/ai/chat-sessions');
                if (response.ok) {
                    const data = await response.json();
                    setSessions(data);
                }
            } catch (error) {
                console.error('Failed to fetch chat sessions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchSessions();
        }
    }, [isOpen]);

    const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (confirm('Are you sure you want to delete this chat?')) {
            try {
                const response = await fetch(`/api/ai/chat-history/${sessionId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    setSessions(sessions.filter(session => session.id !== sessionId));
                    if (sessionId === currentSessionId) {
                        window.location.href = '/agent';
                    }
                }
            } catch (error) {
                console.error('Failed to delete chat session:', error);
            }
        }
    };

    const createNewChat = () => {
        window.location.href = '/agent';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    // Determine sidebar visibility classes
    const sidebarClasses = isOpen
        ? 'translate-x-0 shadow-lg'
        : '-translate-x-full';

    return (
        <>
            {/* Main sidebar */}
            <div
                className={`fixed top-0 left-0 h-full bg-[#202123] text-white w-64 transition-transform duration-300 z-30 ${sidebarClasses}`}
            >
                <div className="flex flex-col h-full">
                    {/* New chat button */}
                    <div className="p-4">
                        <button
                            onClick={createNewChat}
                            className="flex items-center justify-center gap-2 px-4 py-3 w-full border border-white/20 rounded-md hover:bg-gray-700 transition-colors text-sm"
                        >
                            <FiPlusCircle size={16} />
                            <span>New chat</span>
                        </button>
                    </div>

                    {/* Sessions list */}
                    <div className="flex-1 overflow-y-auto px-3">
                        {isLoading ? (
                            <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
                        ) : sessions.length === 0 ? (
                            <div className="py-4 text-center text-sm text-gray-400">No chat history found</div>
                        ) : (
                            <ul className="space-y-1 pb-4">
                                {sessions.map((session) => (
                                    <li key={session.id}>
                                        <Link
                                            href={`/agent/${session.id}`}
                                            className={`flex items-center py-3 px-3 rounded-md group relative
                                                ${session.id === currentSessionId ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`}
                                        >
                                            <FiMessageSquare className="flex-shrink-0 text-gray-400 mr-2" size={16} />
                                            <div className="flex-1 overflow-hidden min-w-0">
                                                <span className="text-sm truncate block">
                                                    {session.title || 'Untitled Chat'}
                                                </span>
                                                <span className="text-xs text-gray-400">{formatDate(session.timestamp)}</span>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSession(session.id, e)}
                                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                                                aria-label="Delete chat"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* Toggle button */}
            <button
                onClick={toggleSidebar}
                className={`fixed top-4 left-4 z-40 p-2 rounded-md transition-all duration-300 ${isOpen ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800 shadow-md'
                    }`}
                aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
            >
                {isOpen ? <FiChevronLeft size={20} /> : <FiChevronRight size={20} />}
            </button>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}
        </>
    );
} 