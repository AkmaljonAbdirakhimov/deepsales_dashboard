"use client";

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, User, FileAudio, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, Manager } from '@/services/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FileWithManager {
    file: File;
    managerId: number | null;
    id?: number;
    status?: 'pending' | 'uploaded' | 'analyzing' | 'completed' | 'error';
}

export default function UploadPage() {
    const router = useRouter();
    const [files, setFiles] = useState<FileWithManager[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [isLoadingManagers, setIsLoadingManagers] = useState(true);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const newFiles = acceptedFiles.map((file) => ({
            file,
            managerId: null,
            status: 'pending' as const,
        }));
        setFiles((prev) => [...prev, ...newFiles]);
        setError(null);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
        },
        multiple: true,
    });

    // Function to load managers
    const loadManagers = useCallback(async () => {
        try {
            setIsLoadingManagers(true);
            const managerList = await api.getManagers();
            setManagers(managerList);
        } catch (err) {
            console.error('Error loading managers:', err);
            // Don't show error to user, just continue with empty list
        } finally {
            setIsLoadingManagers(false);
        }
    }, []);

    // Load managers on component mount
    useEffect(() => {
        loadManagers();
    }, [loadManagers]);

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const updateManagerId = (index: number, id: number | null) => {
        setFiles((prev) =>
            prev.map((f, i) => (i === index ? { ...f, managerId: id } : f))
        );
    };

    const handleUpload = async () => {
        // Prevent multiple simultaneous uploads
        if (isUploading || isAnalyzing) {
            return;
        }

        // Filter only files that haven't been uploaded yet
        const pendingFiles = files.filter((f) => f.status !== 'uploaded' && f.status !== 'analyzing');

        if (pendingFiles.length === 0) {
            setError('Barcha fayllar allaqachon yuklangan.');
            return;
        }

        if (managers.length === 0) {
            setError('Avval menejer yarating. Menejerlar sahifasiga o\'ting.');
            return;
        }

        // Validate manager selection for pending files
        const missingManagers = pendingFiles.filter((f) => !f.managerId);
        if (missingManagers.length > 0) {
            setError(`Iltimos, barcha audio fayllar uchun menejerni tanlang.`);
            return;
        }

        setIsUploading(true);
        setError(null);
        setSuccess(null);

        try {
            const fileList = pendingFiles.map((f) => f.file);
            const managerIds = pendingFiles.map((f) => f.managerId!).filter((id) => id !== null);

            const response = await api.uploadFiles(fileList, managerIds);

            // Update files with IDs from response - match by index in pendingFiles array
            setFiles((prev) => {
                let pendingIndex = 0;
                return prev.map((f) => {
                    // Skip files that are already uploaded or analyzing
                    if (f.status === 'uploaded' || f.status === 'analyzing') {
                        return f;
                    }

                    // Update pending files with response data
                    const updatedFile = {
                        ...f,
                        id: response.files[pendingIndex]?.id,
                        status: 'uploaded' as const,
                    };
                    pendingIndex++;
                    return updatedFile;
                });
            });

            // Refresh managers list to include any newly added managers
            await loadManagers();

            setSuccess(`${response.files.length} ta fayl muvaffaqiyatli yuklandi!`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Yuklashda xatolik yuz berdi');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAnalyze = async () => {
        const uploadedFiles = files.filter((f) => f.id && f.status === 'uploaded');

        if (uploadedFiles.length === 0) {
            setError('Avval fayllarni yuklang!');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setSuccess(null);

        try {
            const fileIds = uploadedFiles.map((f) => f.id!).filter((id) => id !== undefined);
            await api.analyzeFiles(fileIds);

            // Update status to analyzing
            setFiles((prev) =>
                prev.map((f) =>
                    f.id && uploadedFiles.includes(f) ? { ...f, status: 'analyzing' as const } : f
                )
            );

            setSuccess('Tahlil boshlandi! Natijalarni statistikalar sahifasida ko\'rishingiz mumkin.');

            // Redirect to stats page after 2 seconds
            setTimeout(() => {
                router.push('/stats');
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Tahlilni boshlashda xatolik yuz berdi');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Only allow upload if there are pending files with manager names
    const pendingFiles = files.filter((f) => f.status !== 'uploaded' && f.status !== 'analyzing');
    const canUpload = pendingFiles.length > 0 && pendingFiles.every((f) => !!f.managerId) && !isUploading && !isAnalyzing;
    const canAnalyze = files.some((f) => f.id && f.status === 'uploaded') && !isAnalyzing && !isUploading;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Audio Fayllarni Yuklash</h1>
                <p className="text-gray-600">
                    Audio fayllarni yuklang va har bir fayl uchun sotuv menejeri ismini kiriting
                </p>
            </div>

            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}
                `}
            >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                {isDragActive ? (
                    <p className="text-indigo-600 font-medium">Fayllarni bu yerga tashlang...</p>
                ) : (
                    <div>
                        <p className="text-gray-600 mb-2">
                            <span className="text-indigo-600 font-medium">Fayllarni yuklang</span>
                        </p>
                        <p className="text-sm text-gray-500">MP3, WAV, M4A, OGG formatlari qo'llab-quvvatlanadi</p>
                    </div>
                )}
            </div>

            {!isLoadingManagers && managers.length === 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    Menejerlar mavjud emas. Avval{' '}
                    <Link href="/managers" className="underline font-semibold text-yellow-900">
                        Menejerlar sahifasida
                    </Link>{' '}
                    menejer yarating va keyin yuklashni davom ettiring.
                </div>
            )}

            {/* Error/Success Messages */}
            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {success && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-green-800">{success}</p>
                </div>
            )}

            {/* File List */}
            {files.length > 0 && (
                <div className="mt-8 space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Yuklangan Fayllar ({files.length})
                    </h2>

                    <div className="space-y-3">
                        {files.map((fileWithManager, index) => (
                            <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-4"
                            >
                                <div className="flex-shrink-0 mt-1">
                                    <FileAudio className="h-6 w-6 text-indigo-600" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {fileWithManager.file.name}
                                        </p>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="text-gray-400 hover:text-red-600 transition-colors"
                                            disabled={isUploading || isAnalyzing}
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <p className="text-xs text-gray-500 mb-3">
                                        {(fileWithManager.file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-gray-400" />
                                        <div className="flex-1 relative">
                                            <select
                                                value={fileWithManager.managerId ?? ''}
                                                onChange={(e) => updateManagerId(index, e.target.value ? Number(e.target.value) : null)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:text-gray-500 disabled:bg-gray-50"
                                                disabled={isUploading || isAnalyzing || fileWithManager.status === 'uploaded' || managers.length === 0}
                                            >
                                                <option value="">Menejer tanlang</option>
                                                {managers.map((manager) => (
                                                    <option key={manager.id} value={manager.id}>
                                                        {manager.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {fileWithManager.status === 'uploaded' && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                                            <CheckCircle2 className="h-4 w-4" />
                                            <span>Yuklandi</span>
                                        </div>
                                    )}

                                    {fileWithManager.status === 'analyzing' && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-indigo-600">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Tahlil qilinmoqda...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {files.length > 0 && (
                <div className="mt-8 flex gap-4">
                    <button
                        onClick={handleUpload}
                        disabled={!canUpload}
                        className={`
                            flex-1 px-6 py-3 rounded-lg font-medium transition-colors
                            ${canUpload
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        {isUploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Yuklanmoqda...
                            </span>
                        ) : pendingFiles.length > 0 ? (
                            `Fayllarni Yuklash (${pendingFiles.length})`
                        ) : (
                            'Barcha fayllar yuklangan'
                        )}
                    </button>

                    <button
                        onClick={handleAnalyze}
                        disabled={!canAnalyze}
                        className={`
                            flex-1 px-6 py-3 rounded-lg font-medium transition-colors
                            ${canAnalyze
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        {isAnalyzing ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Tahlil boshlanmoqda...
                            </span>
                        ) : (
                            'Tahlilni Boshlash'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

