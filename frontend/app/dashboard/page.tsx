'use client';

import { UserButton } from "@clerk/nextjs";
import GlucoseChart from "../../components/GlucoseChart";
import DexcomStatus from "../../components/DexcomStatus";
import WeeklyBloodSugarChart from "../../components/WeeklyBloodSugarChart";
import TimeOfDayBloodSugarChart from "../../components/TimeOfDayBloodSugarChart";
import CurrentGlucoseReading from "../../components/CurrentGlucoseReading";
import DailyAverageReading from "../../components/DailyAverageReading";
import TimeInRangeReading from "../../components/TimeInRangeReading";
import WeeklyPatterns from "../../components/WeeklyPatterns";
import DexcomAlerts from "../../components/DexcomAlerts";
import { BsGraphUp, BsBell, BsChatSquareText } from 'react-icons/bs';
import { FiSettings, FiActivity } from 'react-icons/fi';
import { RiPulseLine } from 'react-icons/ri';
import Link from 'next/link';
import ClientOnly from "../../components/ClientOnly";

export default function Dashboard() {
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
                        <Link href="/ai-chat" className="flex items-center space-x-2 text-gray-600 hover:text-blue-600">
                            <BsChatSquareText className="text-xl" />
                            <span className="hidden md:inline">AI Chat</span>
                        </Link>
                        <button className="text-gray-600 hover:text-blue-600">
                            <BsBell className="text-xl" />
                        </button>
                        <button className="text-gray-600 hover:text-blue-600">
                            <FiSettings className="text-xl" />
                        </button>
                        <ClientOnly fallback={<div className="w-8 h-8 rounded-full bg-gray-200"></div>}>
                            <UserButton afterSignOutUrl="/" />
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

                        {/* Dexcom Alerts */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <ClientOnly fallback={<div className="h-48 bg-gray-100 animate-pulse p-6"></div>}>
                                <DexcomAlerts />
                            </ClientOnly>
                        </div>

                        {/* AI Chat Link */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Assistant</h2>
                                <p className="text-gray-600 mb-4">
                                    Chat with your AI assistant to get personalized insights and answers about your diabetes management.
                                </p>
                                <Link
                                    href="/ai-chat"
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full"
                                >
                                    <BsChatSquareText size={18} />
                                    <span>Open AI Chat Assistant</span>
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