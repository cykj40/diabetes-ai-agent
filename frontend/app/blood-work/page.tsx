'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Trash2, Eye, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BloodWorkRecord {
    id: string;
    name: string;
    date: string;
    fileName?: string;
    fileType?: string;
    testsCount: number;
    abnormalCount: number;
    values?: Array<{
        name: string;
        value: string | number;
        unit: string;
        normalRange?: string;
        isAbnormal?: boolean;
        category?: string;
    }>;
}

export default function BloodWorkPage() {
    const [isUploading, setIsUploading] = useState(false);
    const [records, setRecords] = useState<BloodWorkRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<BloodWorkRecord | null>(null);
    const [uploadResult, setUploadResult] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Get token from cookies
    const getToken = () => {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'auth_token') {
                return value;
            }
        }
        return null;
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        try {
            const token = getToken();
            const response = await fetch('/api/blood-work/records', {
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRecords(data.records || []);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check file type
        const fileType = file.name.split('.').pop()?.toLowerCase();
        if (!fileType || !['csv', 'pdf'].includes(fileType)) {
            alert('Please upload a CSV or PDF file');
            return;
        }

        setIsUploading(true);
        setUploadResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = getToken();
            const response = await fetch('/api/blood-work/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });

            const result = await response.json();

            if (response.ok) {
                setUploadResult(result.insights || result.message || 'File uploaded successfully!');
                await fetchRecords(); // Refresh the records list

                // Clear the file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } else {
                alert(`Upload failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error uploading file. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const viewRecordDetails = async (recordId: string) => {
        try {
            const token = getToken();
            const response = await fetch(`/api/blood-work/records/${recordId}`, {
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedRecord(data.record);
            }
        } catch (error) {
            console.error('Error fetching record details:', error);
        }
    };

    const deleteRecord = async (recordId: string) => {
        if (!confirm('Are you sure you want to delete this blood work record?')) return;

        try {
            const token = getToken();
            const response = await fetch(`/api/blood-work/records/${recordId}`, {
                method: 'DELETE',
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });

            if (response.ok) {
                await fetchRecords(); // Refresh the records list
                if (selectedRecord?.id === recordId) {
                    setSelectedRecord(null);
                }
            } else {
                alert('Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('Error deleting record');
        }
    };

    const discussWithAI = () => {
        router.push('/agent?context=blood-work');
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Blood Work Analysis</h1>
                    <p className="text-gray-600">Upload your lab results and get AI-powered insights</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Upload Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-xl font-semibold mb-4">Upload Blood Work</h2>

                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <p className="text-lg font-medium text-gray-900 mb-2">Upload your lab results</p>
                                <p className="text-gray-500 mb-4">Drag and drop or click to select CSV or PDF files</p>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.pdf"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                                >
                                    {isUploading ? 'Uploading...' : 'Choose File'}
                                </button>
                            </div>

                            {uploadResult && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                                    <h3 className="font-medium text-green-800 mb-2">Upload Successful!</h3>
                                    <p className="text-green-700 whitespace-pre-line">{uploadResult}</p>
                                </div>
                            )}
                        </div>

                        {/* Records List */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-semibold">Your Blood Work Records</h2>
                                    <button
                                        onClick={discussWithAI}
                                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                                    >
                                        Discuss with AI
                                    </button>
                                </div>
                            </div>

                            <div className="divide-y divide-gray-200">
                                {records.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">
                                        <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                                        <p>No blood work records yet. Upload your first lab results to get started!</p>
                                    </div>
                                ) : (
                                    records.map((record) => (
                                        <div key={record.id} className="p-6 hover:bg-gray-50">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-medium text-gray-900">{record.name}</h3>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        {new Date(record.date).toLocaleDateString()} •
                                                        {record.testsCount} tests •
                                                        {record.abnormalCount > 0 ? (
                                                            <span className="text-red-600">{record.abnormalCount} abnormal</span>
                                                        ) : (
                                                            <span className="text-green-600">All normal</span>
                                                        )}
                                                    </p>
                                                    {record.fileName && (
                                                        <p className="text-xs text-gray-400 mt-1">File: {record.fileName}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => viewRecordDetails(record.id)}
                                                        className="p-2 text-gray-400 hover:text-blue-600"
                                                        title="View details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteRecord(record.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600"
                                                        title="Delete record"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Details Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                            {selectedRecord ? (
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold">{selectedRecord.name}</h3>
                                        <button
                                            onClick={() => setSelectedRecord(null)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Date</p>
                                            <p className="font-medium">{new Date(selectedRecord.date).toLocaleDateString()}</p>
                                        </div>

                                        <div>
                                            <p className="text-sm text-gray-500">Summary</p>
                                            <p className="font-medium">
                                                {selectedRecord.testsCount} tests, {selectedRecord.abnormalCount} abnormal
                                            </p>
                                        </div>

                                        {selectedRecord.values && selectedRecord.values.length > 0 && (
                                            <div>
                                                <p className="text-sm text-gray-500 mb-2">Test Results</p>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                    {selectedRecord.values.map((value, index) => (
                                                        <div key={index} className={`p-2 rounded text-sm ${value.isAbnormal ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                                                            }`}>
                                                            <div className="font-medium">{value.name}</div>
                                                            <div className="text-gray-600">
                                                                {value.value} {value.unit}
                                                                {value.normalRange && (
                                                                    <span className="text-xs ml-2">({value.normalRange})</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500">
                                    <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                                    <p>Select a record to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 