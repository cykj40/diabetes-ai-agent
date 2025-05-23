'use client';

import React, { useState, useEffect } from 'react';
import {
    FileText,
    Image,
    Download,
    Trash2,
    Edit3,
    Tag,
    Search,
    Filter,
    Upload,
    BarChart3,
    Calendar,
    FileType,
    HardDrive
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UploadedFile {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    filePath: string;
    content?: string;
    analysis?: string;
    tags: string[];
    description?: string;
    isProcessed: boolean;
    createdAt: string;
    updatedAt: string;
}

interface FileStats {
    totalFiles: number;
    processedFiles: number;
    unprocessedFiles: number;
    filesByType: { type: string; count: number }[];
    totalSizeBytes: number;
    totalSizeMB: number;
}

export default function FilesPage() {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<FileStats | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ description: '', tags: '', analysis: '' });
    const router = useRouter();

    // Get auth token
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
        fetchFiles();
        fetchStats();
    }, [searchTerm, filterType]);

    const fetchFiles = async () => {
        try {
            const token = getToken();
            if (!token) {
                router.push('/signin');
                return;
            }

            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (filterType !== 'all') params.append('fileType', filterType);

            const response = await fetch(`/api/files?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setFiles(data.files);
            } else {
                console.error('Failed to fetch files');
            }
        } catch (error) {
            console.error('Error fetching files:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch('/api/files/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleEdit = (file: UploadedFile) => {
        setEditingFile(file.id);
        setEditForm({
            description: file.description || '',
            tags: file.tags.join(', '),
            analysis: file.analysis || ''
        });
    };

    const handleSaveEdit = async (fileId: string) => {
        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/files/${fileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    description: editForm.description,
                    tags: editForm.tags.split(',').map(t => t.trim()).filter(t => t),
                    analysis: editForm.analysis
                })
            });

            if (response.ok) {
                setEditingFile(null);
                fetchFiles();
                fetchStats();
            }
        } catch (error) {
            console.error('Error updating file:', error);
        }
    };

    const handleDelete = async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const token = getToken();
            if (!token) return;

            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                fetchFiles();
                fetchStats();
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    };

    const getFileIcon = (fileType: string) => {
        if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            return <Image className="w-6 h-6 text-purple-600" />;
        }
        return <FileText className="w-6 h-6 text-blue-600" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">File Manager</h1>
                            <p className="text-gray-600 mt-1">Manage your uploaded files and documents</p>
                        </div>
                        <button
                            onClick={() => router.push('/agent')}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                            <Upload size={20} />
                            Upload New File
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <HardDrive className="w-8 h-8 text-blue-600" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Total Files</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <BarChart3 className="w-8 h-8 text-green-600" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Processed</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.processedFiles}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <FileType className="w-8 h-8 text-orange-600" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">File Types</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.filesByType.length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <HardDrive className="w-8 h-8 text-purple-600" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Total Size</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalSizeMB} MB</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="max-w-7xl mx-auto px-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="md:w-48">
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Types</option>
                                <option value="csv">CSV</option>
                                <option value="pdf">PDF</option>
                                <option value="txt">Text</option>
                                <option value="json">JSON</option>
                                <option value="xml">XML</option>
                                <option value="jpg">Images</option>
                                <option value="jpeg">Images</option>
                                <option value="png">Images</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Files List */}
            <div className="max-w-7xl mx-auto px-4 pb-8">
                <div className="bg-white rounded-lg shadow">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading files...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="p-8 text-center">
                            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No files found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {files.map((file) => (
                                        <tr key={file.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {getFileIcon(file.fileType)}
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                                                        {file.description && (
                                                            <p className="text-sm text-gray-500">{file.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    {file.fileType.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatFileSize(file.fileSize)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${file.isProcessed
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {file.isProcessed ? 'Processed' : 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatDate(file.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(file)}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(file.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingFile && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit File</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="File description..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                                <input
                                    type="text"
                                    value={editForm.tags}
                                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="blood work, lab results, diabetes..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Analysis Notes</label>
                                <textarea
                                    value={editForm.analysis}
                                    onChange={(e) => setEditForm({ ...editForm, analysis: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Your analysis notes..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button
                                onClick={() => setEditingFile(null)}
                                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSaveEdit(editingFile)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 