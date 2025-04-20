'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FiCheck, FiX } from 'react-icons/fi';
import PelotonTroubleshootingInfo from './troubleshooting-info';

export default function IntegrationsPage() {
    const [pelotonUsername, setPelotonUsername] = useState('');
    const [pelotonPassword, setPelotonPassword] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);

    // Check connection status on page load
    useEffect(() => {
        checkPelotonConnection();
    }, []);

    // Function to check if Peloton is connected
    const checkPelotonConnection = async () => {
        try {
            const response = await fetch('/api/peloton/test-connection', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('user_id') || 'default-user'}`
                }
            });
            const data = await response.json();
            setIsConnected(data.success);

            // Show troubleshooting info if connection failed
            if (!data.success) {
                setShowTroubleshooting(true);
            }
        } catch (error) {
            console.error('Failed to check Peloton connection:', error);
            setIsConnected(false);
            setShowTroubleshooting(true);
        }
    };

    // Save Peloton credentials
    const handleSavePeloton = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!pelotonUsername || !pelotonPassword) {
            toast.error('Please enter both username and password');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/peloton/credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('user_id') || 'default-user'}`
                },
                body: JSON.stringify({
                    username: pelotonUsername,
                    password: pelotonPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Peloton account connected successfully');
                setIsConnected(true);
                setPelotonPassword(''); // Clear password for security
                setShowTroubleshooting(false);
            } else {
                toast.error(data.message || 'Failed to connect Peloton account');
                setShowTroubleshooting(true);
            }
        } catch (error) {
            console.error('Error saving Peloton credentials:', error);
            toast.error('Failed to connect Peloton account');
            setShowTroubleshooting(true);
        } finally {
            setIsLoading(false);
        }
    };

    // Disconnect Peloton
    const handleDisconnectPeloton = async () => {
        setIsLoading(true);

        try {
            const response = await fetch('/api/peloton/credentials', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('user_id') || 'default-user'}`
                }
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Peloton account disconnected successfully');
                setIsConnected(false);
                setPelotonUsername('');
            } else {
                toast.error(data.message || 'Failed to disconnect Peloton account');
                setShowTroubleshooting(true);
            }
        } catch (error) {
            console.error('Error disconnecting Peloton account:', error);
            toast.error('Failed to disconnect Peloton account');
            setShowTroubleshooting(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Integrations</h2>

            <div className="space-y-8">
                <div className="border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium">Peloton</h3>
                        <div className="flex items-center">
                            {isConnected ? (
                                <span className="flex items-center text-green-500">
                                    <FiCheck className="mr-1" /> Connected
                                </span>
                            ) : (
                                <span className="flex items-center text-gray-500">
                                    <FiX className="mr-1" /> Not connected
                                </span>
                            )}
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-4">
                        Connect your Peloton account to track your workouts and analyze their impact on your glucose levels.
                    </p>

                    {isConnected ? (
                        <div>
                            <p className="text-sm mb-4">Your Peloton account is connected. You can now view your workout data in the dashboard.</p>
                            <button
                                onClick={handleDisconnectPeloton}
                                disabled={isLoading}
                                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                {isLoading ? 'Disconnecting...' : 'Disconnect Account'}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSavePeloton} className="space-y-4">
                            <div>
                                <label htmlFor="peloton-username" className="block text-sm font-medium text-gray-700">
                                    Peloton Username
                                </label>
                                <input
                                    type="text"
                                    id="peloton-username"
                                    value={pelotonUsername}
                                    onChange={(e) => setPelotonUsername(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label htmlFor="peloton-password" className="block text-sm font-medium text-gray-700">
                                    Peloton Password
                                </label>
                                <input
                                    type="password"
                                    id="peloton-password"
                                    value={pelotonPassword}
                                    onChange={(e) => setPelotonPassword(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    {isLoading ? 'Connecting...' : 'Connect Account'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Show troubleshooting info when needed */}
                    {showTroubleshooting && <PelotonTroubleshootingInfo />}

                    {/* Manual link to toggle troubleshooting info */}
                    <button
                        className="text-sm text-blue-600 hover:text-blue-800 mt-4 underline"
                        onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                    >
                        {showTroubleshooting ? 'Hide troubleshooting tips' : 'View troubleshooting tips'}
                    </button>
                </div>
            </div>
        </div>
    );
} 