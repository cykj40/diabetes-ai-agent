'use client';

import DexcomAuth from '../../components/DexcomAuth';

export default function ConnectDexcomPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
                Connect Your Dexcom Device
            </h1>
            <DexcomAuth
                onAuthSuccess={() => {
                    console.log('Successfully connected to Dexcom!');
                }}
            />
        </div>
    );
} 