"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { FiRefreshCw } from 'react-icons/fi';

interface GlucoseReading {
    value: number;
    trend: string;
    timestamp: string;
}

interface DexcomDevice {
    lastUploadDate: string;
    transmitterId?: string;
    transmitterGeneration: string;
    displayDevice: string;
    displayApp?: string;
}

interface DeviceDataResponse {
    devices: DexcomDevice[];
    readings: GlucoseReading[];
}

const GlucoseChart = () => {
    const [readings, setReadings] = useState<GlucoseReading[]>([]);
    const [devices, setDevices] = useState<DexcomDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchDeviceData();
        const interval = setInterval(fetchDeviceData, 300000); // Refresh every 5 minutes

        return () => clearInterval(interval);
    }, []);

    const fetchDeviceData = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            console.log('Fetching Dexcom device data...');
            const response = await fetch('http://localhost:3001/api/dexcom/device-data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Please connect your Dexcom account to view blood sugar data.');
                } else {
                    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
                }
            }

            const data: DeviceDataResponse = await response.json();
            console.log(`Received ${data.readings.length} glucose readings and ${data.devices.length} devices`);

            setReadings(data.readings);
            setDevices(data.devices);
        } catch (err) {
            console.error('Error fetching device data:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading && !refreshing) {
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
                <button
                    onClick={fetchDeviceData}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const latestDevice = devices.length > 0 ? devices[0] : null;

    return (
        <div className="p-4 bg-white rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Blood Sugar Trends</h2>
                <button
                    onClick={fetchDeviceData}
                    disabled={refreshing}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>

            {refreshing ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <>
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

                        {latestDevice && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-md">
                                <h3 className="font-medium text-gray-700">Device Information</h3>
                                <p>Device: {latestDevice.displayDevice} {latestDevice.displayApp ? `(${latestDevice.displayApp})` : ''}</p>
                                <p>Transmitter: {latestDevice.transmitterGeneration} {latestDevice.transmitterId ? `(${latestDevice.transmitterId.substring(0, 8)}...)` : ''}</p>
                                <p>Last Upload: {new Date(latestDevice.lastUploadDate).toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default GlucoseChart;
