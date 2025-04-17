'use client';

export default function AgentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-screen bg-gray-50 overflow-hidden">
            <main className="h-screen overflow-auto">
                {children}
            </main>
        </div>
    );
} 