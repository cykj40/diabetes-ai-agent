'use client';

import { useState } from 'react';

interface BloodSugarAnalysis {
    glucoseTrend: string;
    anomalyDetected: boolean;
    anomalyDescription?: string;
    recommendations: string;
    summary: string;
    riskLevel: number;
}

interface QAEntry {
    id: string;
    content: string;
    createdAt: Date;
}

export default function BloodSugarAI() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<BloodSugarAnalysis | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState<string | null>(null);
    const [bloodSugarData, setBloodSugarData] = useState('');

    const analyzeBloodSugar = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: bloodSugarData }),
            });

            if (!response.ok) {
                throw new Error('Failed to analyze blood sugar data');
            }

            const data = await response.json();
            setAnalysis(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const askQuestion = async () => {
        if (!bloodSugarData || !question) return;

        try {
            setLoading(true);
            setError(null);
            const entries: QAEntry[] = [
                {
                    id: 'current',
                    content: bloodSugarData,
                    createdAt: new Date(),
                },
            ];

            const response = await fetch('/api/ai/qa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question, entries }),
            });

            if (!response.ok) {
                throw new Error('Failed to get answer');
            }

            const data = await response.json();
            setAnswer(data.answer);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Blood Sugar AI Analysis
                </h2>

                {/* Input Section */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="bloodSugarData" className="block text-sm font-medium text-gray-700">
                            Enter Blood Sugar Data
                        </label>
                        <textarea
                            id="bloodSugarData"
                            rows={4}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={bloodSugarData}
                            onChange={(e) => setBloodSugarData(e.target.value)}
                            placeholder="Enter your blood sugar readings here..."
                        />
                    </div>
                    <button
                        onClick={analyzeBloodSugar}
                        disabled={loading || !bloodSugarData}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    >
                        {loading ? 'Analyzing...' : 'Analyze Blood Sugar'}
                    </button>
                </div>

                {/* Analysis Results */}
                {analysis && (
                    <div className="mt-8 space-y-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-gray-800">Analysis Results</h3>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-700">Trend</h4>
                                    <p className="text-gray-600">{analysis.glucoseTrend}</p>
                                </div>

                                {analysis.anomalyDetected && (
                                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                        <h4 className="font-medium text-red-800">Anomaly Detected</h4>
                                        <p className="text-red-700">{analysis.anomalyDescription}</p>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-medium text-gray-700">Summary</h4>
                                    <p className="text-gray-600">{analysis.summary}</p>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-700">Recommendations</h4>
                                    <p className="text-gray-600">{analysis.recommendations}</p>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-700">Risk Level</h4>
                                    <div className="mt-2 relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <div className="text-xs font-semibold text-blue-700 w-10">
                                                {analysis.riskLevel}/10
                                            </div>
                                        </div>
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                                            <div
                                                style={{ width: `${(analysis.riskLevel / 10) * 100}%` }}
                                                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Q&A Section */}
                <div className="mt-8 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Ask a Question</h3>
                    <div>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask about your blood sugar data..."
                        />
                    </div>
                    <button
                        onClick={askQuestion}
                        disabled={loading || !question || !bloodSugarData}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-green-300 transition-colors"
                    >
                        {loading ? 'Getting Answer...' : 'Ask Question'}
                    </button>

                    {answer && (
                        <div className="bg-green-50 rounded-lg p-4 mt-4">
                            <h4 className="font-medium text-green-800">Answer</h4>
                            <p className="text-green-700 mt-2">{answer}</p>
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
} 