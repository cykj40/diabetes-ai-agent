'use client';

import { UserButton } from "@clerk/nextjs";
import GlucoseChart from "../../components/GlucoseChart";
import AIChat from "../../components/AIChat";
import DexcomStatus from "../../components/DexcomStatus";
import WeeklyBloodSugarChart from "../../components/WeeklyBloodSugarChart";
import TimeOfDayBloodSugarChart from "../../components/TimeOfDayBloodSugarChart";
import { BsGraphUp, BsBell } from 'react-icons/bs';
import { FiSettings, FiActivity } from 'react-icons/fi';
import { RiPulseLine } from 'react-icons/ri';

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
                        <DexcomStatus />
                    </div>
                    <div className="flex items-center space-x-6">
                        <button className="text-gray-600 hover:text-blue-600">
                            <BsBell className="text-xl" />
                        </button>
                        <button className="text-gray-600 hover:text-blue-600">
                            <FiSettings className="text-xl" />
                        </button>
                        <UserButton afterSignOutUrl="/" />
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Current Reading</h3>
                            <BsGraphUp className="text-blue-600 text-xl" />
                        </div>
                        <div className="text-3xl font-bold text-blue-600">120 mg/dL</div>
                        <div className="text-sm text-gray-500 mt-2">Trending stable</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Daily Average</h3>
                            <FiActivity className="text-green-600 text-xl" />
                        </div>
                        <div className="text-3xl font-bold text-green-600">135 mg/dL</div>
                        <div className="text-sm text-gray-500 mt-2">Last 24 hours</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-800">Time in Range</h3>
                            <RiPulseLine className="text-purple-600 text-xl" />
                        </div>
                        <div className="text-3xl font-bold text-purple-600">75%</div>
                        <div className="text-sm text-gray-500 mt-2">Target: 70-180 mg/dL</div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Glucose Chart */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Glucose Trends</h2>
                            <GlucoseChart />
                        </div>

                        {/* Weekly Blood Sugar Chart */}
                        <div className="mt-6">
                            <WeeklyBloodSugarChart />
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

                        {/* AI Chat Interface */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">AI Assistant</h2>
                                <AIChat />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pattern Analysis Section */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Time of Day Analysis</h2>
                        <TimeOfDayBloodSugarChart />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Weekly Patterns</h2>
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-gray-600">Best control on Wednesdays</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <span className="text-gray-600">Higher variability on weekends</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-gray-600">Consistent morning patterns</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 