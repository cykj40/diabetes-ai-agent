"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
}

const GlucoseChart = () => {
    const [readings, setReadings] = useState<GlucoseReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReadings = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/dexcom/readings', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch readings');
                }

                const data = await response.json();
                if (Array.isArray(data)) {
                    setReadings(data);
                } else {
                    throw new Error('Invalid data format received');
                }
            } catch (err) {
                console.error('Error fetching readings:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch readings');
            } finally {
                setLoading(false);
            }
        };

        fetchReadings();
        const interval = setInterval(fetchReadings, 300000); // Refresh every 5 minutes

        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Blood Sugar Trends</h2>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={readings}>
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    />
                    <YAxis domain={[40, 400]} />
                    <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: number) => [`${value} mg/dL`]}
                    />
                    <ReferenceLine y={180} stroke="#fbbf24" strokeDasharray="3 3" label="High" />
                    <ReferenceLine y={70} stroke="#fbbf24" strokeDasharray="3 3" label="Low" />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-sm text-gray-500">
                <p>Target Range: 70-180 mg/dL</p>
                {readings.length > 0 && (
                    <p>Latest Reading: {readings[readings.length - 1].value} mg/dL ({readings[readings.length - 1].trend})</p>
                )}
            </div>
        </div>
    );
};

export default GlucoseChart;
