'use client';

import { useEffect, useState } from 'react';
import { BsBell } from 'react-icons/bs';
import { FiAlertTriangle } from 'react-icons/fi';

interface DexcomAlert {
    recordId: string;
    systemTime: string;
    displayTime: string;
    alertName: string;
    alertState: string;
    displayDevice: string;
    transmitterGeneration: string;
    transmitterId: string;
    displayApp?: string;
}

export default function DexcomAlerts() {
    const [alerts, setAlerts] = useState<DexcomAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastAttempt, setLastAttempt] = useState<string>('');

    const fetchAlerts = async () => {
        try {
            setRefreshing(true);
            if (!loading) setLoading(true);
            setError(null);

            const timestamp = new Date().toISOString();
            setLastAttempt(timestamp);
            console.log(`[${timestamp}] Fetching Dexcom alerts...`);

            // Calculate date range for the last 24 hours
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago

            const response = await fetch(`http://localhost:3001/api/dexcom/alerts?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            console.log(`[${timestamp}] Response status:`, response.status, response.statusText);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Please connect your Dexcom account to view alerts.');
                } else {
                    throw new Error(`Failed to fetch alerts: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log(`[${timestamp}] Received alerts:`, data);

            if (data && data.records) {
                setAlerts(data.records);
            } else {
                console.log(`[${timestamp}] No alerts available`);
                setAlerts([]);
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error fetching alerts:`, err);
            setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        console.log('DexcomAlerts component mounted, fetching initial data...');
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 900000); // Refresh every 15 minutes

        return () => {
            console.log('DexcomAlerts component unmounting, clearing interval');
            clearInterval(interval);
        };
    }, []);

    // Helper function to get alert name in a user-friendly format
    const getAlertName = (alertName: string): string => {
        switch (alertName.toLowerCase()) {
            case 'high': return 'High Blood Sugar';
            case 'low': return 'Low Blood Sugar';
            case 'rise': return 'Rising Fast';
            case 'fall': return 'Falling Fast';
            case 'outofrange': return 'Signal Loss';
            case 'urgentlow': return 'Urgent Low';
            case 'urgentlowsoon': return 'Urgent Low Soon';
            case 'noreadings': return 'No Readings';
            case 'fixedlow': return 'Fixed Low';
            default: return alertName;
        }
    };

    // Helper function to get alert color
    const getAlertColor = (alertName: string): string => {
        switch (alertName.toLowerCase()) {
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'low': return 'bg-red-100 text-red-800 border-red-200';
            case 'rise': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'fall': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'outofrange': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'urgentlow': return 'bg-red-100 text-red-800 border-red-200';
            case 'urgentlowsoon': return 'bg-red-100 text-red-800 border-red-200';
            case 'noreadings': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'fixedlow': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    if (loading && alerts.length === 0) {
        return (
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Recent Alerts</h3>
                    <BsBell className="text-blue-600 text-xl" />
                </div>
                <div className="text-gray-500 flex items-center justify-center p-4">
                    <div className="animate-spin mr-2">
                        <BsBell />
                    </div>
                    <span>Loading alerts...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Recent Alerts</h3>
                    <BsBell className="text-blue-600 text-xl" />
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <div className="text-red-800 font-medium">Error loading alerts</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                    <button
                        onClick={fetchAlerts}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Recent Alerts</h3>
                <div className="flex items-center">
                    {refreshing && <span className="text-xs text-blue-500 mr-2">Refreshing...</span>}
                    <BsBell className="text-blue-600 text-xl" />
                </div>
            </div>

            {alerts.length === 0 ? (
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-gray-500">No alerts in the last 24 hours</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert) => (
                        <div
                            key={alert.recordId}
                            className={`p-3 rounded-lg border ${getAlertColor(alert.alertName)}`}
                        >
                            <div className="flex items-start">
                                <FiAlertTriangle className="mt-0.5 mr-2" />
                                <div>
                                    <div className="font-medium">{getAlertName(alert.alertName)}</div>
                                    <div className="text-sm mt-1">
                                        {new Date(alert.displayTime).toLocaleString()}
                                    </div>
                                    <div className="text-xs mt-1">
                                        Status: {alert.alertState.replace(/([A-Z])/g, ' $1').trim()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
                <span>Last updated: {new Date(lastAttempt).toLocaleTimeString()}</span>
                <button
                    onClick={fetchAlerts}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                >
                    Refresh
                </button>
            </div>
        </div>
    );
} 