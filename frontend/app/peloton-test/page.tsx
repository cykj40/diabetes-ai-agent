'use client';

import { useState } from 'react';
import PelotonMuscleChart from '../../components/PelotonMuscleChart';
import MuscleImpactChart from '../../components/MuscleImpactChart';
import ClientOnly from '../../components/ClientOnly';
import Link from 'next/link';

export default function PelotonTest() {
    const [period, setPeriod] = useState<'7_days' | '30_days'>('7_days');

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Peloton Integration Test</h1>

            <div className="mb-4">
                <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
                    ← Back to Dashboard
                </Link>
            </div>

            <div className="mb-4">
                <label className="mr-4">Time Period:</label>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as '7_days' | '30_days')}
                    className="border p-2 rounded"
                >
                    <option value="7_days">Last 7 Days</option>
                    <option value="30_days">Last 30 Days</option>
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-[500px]">
                    <h2 className="text-lg font-semibold mb-4">Radar Chart (New)</h2>
                    <ClientOnly>
                        <PelotonMuscleChart period={period} />
                    </ClientOnly>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-[500px]">
                    <h2 className="text-lg font-semibold mb-4">Bar Chart (Current)</h2>
                    <ClientOnly>
                        <MuscleImpactChart days={period === '7_days' ? 7 : 30} />
                    </ClientOnly>
                </div>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-bold mb-2">Implementation Notes</h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li>The radar chart provides a better visualization of relative muscle workload</li>
                    <li>The bar chart shows absolute scores and number of workouts per muscle group</li>
                    <li>Both visualizations use the same Peloton workout data</li>
                    <li>Data is fetched from the Peloton API using your session cookie</li>
                    <li>You can compare different time periods (7 days vs 30 days)</li>
                </ul>
            </div>
        </div>
    );
} 