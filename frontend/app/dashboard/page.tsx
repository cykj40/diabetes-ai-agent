'use client';

import GlucoseChart from "../../components/GlucoseChart";
import DexcomStatus from "../../components/DexcomStatus";
import WeeklyBloodSugarChart from "../../components/WeeklyBloodSugarChart";
import TimeOfDayBloodSugarChart from "../../components/TimeOfDayBloodSugarChart";
import CurrentGlucoseReading from "../../components/CurrentGlucoseReading";
import DailyAverageReading from "../../components/DailyAverageReading";
import TimeInRangeReading from "../../components/TimeInRangeReading";
import WeeklyPatterns from "../../components/WeeklyPatterns";
import { BsBell } from 'react-icons/bs';
import { FiSettings, FiActivity, FiUser } from 'react-icons/fi';
import { RiPulseLine } from 'react-icons/ri';
import Link from 'next/link';
import ClientOnly from "../../components/ClientOnly";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
    const router = useRouter();
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);

    useEffect(() => {
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

        // Check if user is authenticated
        const token = getToken();
        if (!token) {
            router.push('/signin');
            return;
        }

        // Fetch current user
        const fetchUser = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user');
                }

                const data = await response.json();
                if (data.success) {
                    setUser(data.user);
                } else {
                    router.push('/signin');
                }
            } catch (error) {
                console.error('Error fetching user:', error);
                router.push('/signin');
            }
        };

        fetchUser();
    }, [router]);

    const handleSignOut = () => {
        document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.push('/signin');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Navigation */}
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <RiPulseLine className="text-blue-600 text-3xl" />
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                            DiabetesAI Assistant
                        </h1>
                        <ClientOnly>
                            <DexcomStatus />
                        </ClientOnly>
                    </div>
                    <div className="flex items-center space-x-6">
                        <Link href="/agent" className="flex items-center space-x-2 text-gray-600 hover:text-blue-600">
                            <FiActivity className="text-xl" />
                            <span className="hidden md:inline">AI Assistant</span>
                        </Link>
                        <button className="text-gray-600 hover:text-blue-600">
                            <BsBell className="text-xl" />
                        </button>
                        <button className="text-gray-600 hover:text-blue-600">
                            <FiSettings className="text-xl" />
                        </button>
                        <ClientOnly fallback={<div className="w-8 h-8 rounded-full bg-gray-200"></div>}>
                            <div className="relative group">
                                <button className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200">
                                    <FiUser />
                                </button>
                                <div className="absolute right-0 mt-2 w-48 py-2 bg-white rounded-md shadow-xl z-20 hidden group-hover:block">
                                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                                        {user?.email}
                                    </div>
                                    <a href="/account" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Account</a>
                                    <a href="/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</a>
                                    <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Sign out</button>
                                </div>
                            </div>
                        </ClientOnly>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <CurrentGlucoseReading />
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <DailyAverageReading />
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <TimeInRangeReading />
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Glucose Chart */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Glucose Trends</h2>
                            <ClientOnly fallback={<div className="h-64 bg-gray-100 animate-pulse rounded"></div>}>
                                <GlucoseChart />
                            </ClientOnly>
                        </div>

                        {/* Weekly Blood Sugar Chart */}
                        <div className="mt-6">
                            <ClientOnly fallback={<div className="h-64 bg-gray-100 animate-pulse rounded"></div>}>
                                <WeeklyBloodSugarChart />
                            </ClientOnly>
                        </div>
                    </div>

                    {/* Right Column - AI Insights */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Insights</h2>
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                    <h3 className="font-medium text-blue-800">Pattern Detected</h3>
                                    <p className="text-sm text-blue-600 mt-1">
                                        Slight elevation in morning glucose levels over the past week.
                                    </p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                                    <h3 className="font-medium text-purple-800">Recommendation</h3>
                                    <p className="text-sm text-purple-600 mt-1">
                                        Consider adjusting evening meal timing to improve morning readings.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* AI Assistant Link */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Assistant</h2>
                                <p className="text-gray-600 mb-4">
                                    Chat with your AI assistant to get personalized insights, charts, and answers about your diabetes management.
                                </p>
                                <Link
                                    href="/agent"
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full"
                                >
                                    <FiActivity size={18} />
                                    <span>Open AI Assistant</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pattern Analysis Section */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Time of Day Analysis</h2>
                        <ClientOnly fallback={<div className="h-64 bg-gray-100 animate-pulse rounded"></div>}>
                            <TimeOfDayBloodSugarChart />
                        </ClientOnly>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <ClientOnly fallback={<div className="h-64 bg-gray-100 animate-pulse rounded"></div>}>
                            <WeeklyPatterns />
                        </ClientOnly>
                    </div>
                </div>
            </main>
        </div>
    );
} 