"use client";

import { useEffect, useState } from 'react';
import { api, AudioFile } from '@/services/api';
import { retryAnalysis } from '@/services/fileService';
import { MessageSquare, ExternalLink, Loader2, Calendar, User, FileAudio, Trash2, BarChart3, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { formatDate as formatDateUtil } from '@/utils/dateTime';
import ConfirmModal from '@/components/ConfirmModal';

export default function AudiosPage() {
    const [files, setFiles] = useState<AudioFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'processing' | 'pending' | 'error'>('all');
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [retryingId, setRetryingId] = useState<number | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; fileId: number | null; filename: string }>({
        isOpen: false,
        fileId: null,
        filename: ''
    });

    const loadFiles = async () => {
        try {
            setLoading(true);
            setError(null);
            const allFiles = await api.getFiles();
            setFiles(allFiles);
        } catch (err) {
            console.error('Error loading files:', err);
            setError(err instanceof Error ? err.message : 'Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();

        // Refresh every 5 seconds to check for updates
        const intervalId = setInterval(loadFiles, 5000);

        return () => {
            clearInterval(intervalId);
        };
    }, []);

    const filteredFiles = files.filter(file => {
        if (filterStatus === 'all') return true;
        return file.status === filterStatus;
    });

    const completedFiles = filteredFiles.filter(f => f.status === 'completed' && f.transcription_id);
    const processingFiles = filteredFiles.filter(f => f.status === 'processing' || f.status === 'pending');
    const errorFiles = filteredFiles.filter(f => f.status === 'error');

    const formatDate = (dateString: string) => {
        return formatDateUtil(dateString, 'uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            completed: { label: 'Tayyor', className: 'bg-green-100 text-green-800 border-green-200' },
            processing: { label: 'Tahlil qilinmoqda', className: 'bg-blue-100 text-blue-800 border-blue-200' },
            pending: { label: 'Kutmoqda', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
            error: { label: 'Xatolik', className: 'bg-red-100 text-red-800 border-red-200' }
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

        return (
            <span className={clsx(
                'px-2 py-1 text-xs font-medium rounded-full border',
                config.className
            )}>
                {config.label}
            </span>
        );
    };

    const handleDeleteClick = (id: number, filename: string) => {
        setDeleteModal({
            isOpen: true,
            fileId: id,
            filename
        });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.fileId) return;

        try {
            setDeletingId(deleteModal.fileId);
            setError(null);
            await api.deleteAudio(deleteModal.fileId);

            // Remove the file from the list
            setFiles((prev) => prev.filter((f) => f.id !== deleteModal.fileId));

            // Close modal
            setDeleteModal({ isOpen: false, fileId: null, filename: '' });
        } catch (err) {
            console.error('Error deleting file:', err);
            setError(err instanceof Error ? err.message : 'Faylni o\'chirishda xatolik yuz berdi');
        } finally {
            setDeletingId(null);
        }
    };

    const handleRetry = async (id: number) => {
        try {
            setRetryingId(id);
            setError(null);
            await retryAnalysis(id);

            // Update the file status to processing
            setFiles((prev) => prev.map((f) =>
                f.id === id ? { ...f, status: 'processing' as const } : f
            ));
        } catch (err) {
            console.error('Error retrying analysis:', err);
            setError(err instanceof Error ? err.message : 'Tahlilni qayta ishga tushirishda xatolik yuz berdi');
        } finally {
            setRetryingId(null);
        }
    };

    if (loading && files.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="mt-4 text-gray-600">Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <MessageSquare className="h-8 w-8 text-indigo-600" />
                        Audio fayllar
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Barcha yuklangan audio fayllar va ularning transkripsiyalari
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Jami fayllar</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{files.length}</p>
                        </div>
                        <FileAudio className="h-8 w-8 text-gray-400" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Tayyor</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{completedFiles.length}</p>
                        </div>
                        <MessageSquare className="h-8 w-8 text-green-400" />
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Tahlil qilinmoqda</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{processingFiles.length}</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 text-xs font-bold">{processingFiles.length}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Xatolik</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{errorFiles.length}</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="text-red-600 text-xs font-bold">!</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Filtr:</span>
                    <div className="flex gap-2">
                        {(['all', 'completed', 'processing', 'pending', 'error'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={clsx(
                                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    filterStatus === status
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                )}
                            >
                                {status === 'all' && 'Barchasi'}
                                {status === 'completed' && 'Tayyor'}
                                {status === 'processing' && 'Tahlil qilinmoqda'}
                                {status === 'pending' && 'Kutmoqda'}
                                {status === 'error' && 'Xatolik'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Files List */}
            {filteredFiles.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <FileAudio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Hech qanday fayl topilmadi</p>
                    <p className="text-gray-500 text-sm mt-2">
                        {filterStatus !== 'all'
                            ? 'Bu filtr bo\'yicha fayllar topilmadi'
                            : 'Audio fayllarni yuklash uchun "Yuklash" bo\'limiga o\'ting'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Fayl nomi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Manager
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Yuklangan sana
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Holat
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Ball
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                        Harakatlar
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredFiles.map((file) => (
                                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <FileAudio className="h-5 w-5 text-gray-400" />
                                                <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                                    {file.original_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-gray-400" />
                                                <span className="text-sm text-gray-700">{file.manager_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-gray-400" />
                                                <span className="text-sm text-gray-700">
                                                    {formatDate(file.upload_date)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(file.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {file.overall_score !== undefined && file.overall_score !== null ? (
                                                <span className={clsx(
                                                    'text-sm font-semibold',
                                                    file.overall_score >= 80 ? 'text-green-600' :
                                                        file.overall_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                )}>
                                                    {file.overall_score}%
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {file.status === 'completed' && file.transcription_id ? (
                                                    <>
                                                        <Link
                                                            href={`/audios/${file.id}/transcription`}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                                        >
                                                            <MessageSquare className="h-4 w-4" />
                                                            Transkripsiyani ko'rish
                                                        </Link>
                                                        {file.analysis_id && (
                                                            <Link
                                                                href={`/audios/${file.id}/stats`}
                                                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                                            >
                                                                <BarChart3 className="h-4 w-4" />
                                                                Statistikalar
                                                            </Link>
                                                        )}
                                                    </>
                                                ) : file.status === 'processing' || file.status === 'pending' ? (
                                                    <span className="text-sm text-gray-400">Tahlil qilinmoqda...</span>
                                                ) : file.status === 'error' ? (
                                                    <button
                                                        onClick={() => handleRetry(file.id)}
                                                        disabled={retryingId === file.id}
                                                        className={clsx(
                                                            'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                                                            retryingId === file.id
                                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                                : 'bg-orange-600 text-white hover:bg-orange-700'
                                                        )}
                                                        title="Tahlilni qayta ishga tushirish"
                                                    >
                                                        {retryingId === file.id ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Qayta ishga tushirilmoqda...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RotateCcw className="h-4 w-4" />
                                                                Qayta ishga tushirish
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm text-gray-400">Transkripsiya mavjud emas</span>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteClick(file.id, file.original_name)}
                                                    disabled={deletingId === file.id || retryingId === file.id}
                                                    className={clsx(
                                                        'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                                                        deletingId === file.id || retryingId === file.id
                                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                            : 'bg-red-600 text-white hover:bg-red-700'
                                                    )}
                                                    title="Faylni va barcha ma'lumotlarini o'chirish"
                                                >
                                                    {deletingId === file.id ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            O'chirilmoqda...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Trash2 className="h-4 w-4" />
                                                            O'chirish
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, fileId: null, filename: '' })}
                onConfirm={handleDeleteConfirm}
                title="Faylni o'chirish"
                message={`Haqiqatan ham "${deleteModal.filename}" faylini va uning barcha ma'lumotlarini (transkripsiya va statistikalar) o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`}
                confirmText="Ha, o'chirish"
                cancelText="Bekor qilish"
                type="danger"
            />
        </div>
    );
}

