'use client';

import BloodSugarAI from '../../components/BloodSugarAI';

export default function AnalysisPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900">
                        Blood Sugar Analysis
                    </h1>
                    <p className="mt-4 text-xl text-gray-600">
                        Get AI-powered insights about your blood sugar patterns
                    </p>
                </div>

                <BloodSugarAI />
            </div>
        </div>
    );
} 