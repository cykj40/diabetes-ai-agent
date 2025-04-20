import React from 'react';
import Link from 'next/link';
import { FiLink, FiUser } from 'react-icons/fi';

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Settings</h1>

            <div className="flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-64">
                    <nav className="space-y-1">
                        <Link href="/settings"
                            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 hover:text-blue-600">
                            <FiUser className="mr-3 h-5 w-5" />
                            <span>Account</span>
                        </Link>
                        <Link href="/settings/integrations"
                            className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100 hover:text-blue-600">
                            <FiLink className="mr-3 h-5 w-5" />
                            <span>Integrations</span>
                        </Link>
                    </nav>
                </aside>

                <main className="flex-1">
                    <div className="bg-white p-6 rounded-lg shadow">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
} 