'use client';

import { useState } from 'react';
import ChatSidebar from '../../components/ChatSidebar';

export default function AgentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="h-screen bg-gray-50 overflow-hidden">
            <ChatSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <main
                className={`h-screen transition-all duration-300 overflow-auto ${sidebarOpen ? 'ml-64' : 'ml-0'
                    }`}
            >
                {children}
            </main>
        </div>
    );
} 