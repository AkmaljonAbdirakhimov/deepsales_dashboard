"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { AudioStats } from '@/services/statsService';
import { Category } from '@/services/categoryService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    ArrowLeft, Loader2, FileAudio, User, Calendar,
    TrendingUp, AlertCircle, MessageSquare, Clock,
    CheckCircle2, XCircle, AlertTriangle, Target
} from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { formatDate as formatDateUtil } from '@/utils/dateTime';

const COLORS = ['#4338ca', '#059669', '#dc2626', '#d97706', '#9333ea'];

export default function AudioStatsPage() {
    const params = useParams();
    const router = useRouter();
    const audioId = parseInt(params.id as string);

    const [stats, setStats] = useState<AudioStats | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Load categories
                const categoriesData = await api.getCategories();
                setCategories(categoriesData);

                // Load audio stats
                const statsData = await api.getAudioStats(audioId);
                setStats(statsData);
            } catch (err) {
                console.error('Error loading audio stats:', err);
                setError(err instanceof Error ? err.message : 'Failed to load audio stats');
            } finally {
                setLoading(false);
            }
        };

        if (audioId) {
            loadData();
        }
    }, [audioId]);

    const formatDate = (dateString: string) => {
        return formatDateUtil(dateString, 'uz-UZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-600';
        if (score >= 80) return 'text-blue-600';
        if (score >= 70) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-100';
        if (score >= 80) return 'bg-blue-100';
        if (score >= 70) return 'bg-yellow-100';
        return 'bg-red-100';
    };

    // Prepare criteria scores data (flattened for display)
    const criteriaScoresData = stats ? Object.entries(stats.criteria_scores || {})
        .flatMap(([category, criteria]) =>
            Object.entries(criteria).map(([name, score]) => ({
                category,
                name,
                score
            }))
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) : [];

    // Prepare mistakes data
    const mistakesData = stats ? Object.entries(stats.category_mistakes || {})
        .flatMap(([category, mistakes]) =>
            Object.entries(mistakes).map(([name, data]) => ({
                category,
                name,
                count: typeof data === 'number' ? data : data.count,
                recommendation: typeof data === 'object' && data.recommendation ? data.recommendation : ''
            }))
        )
        .sort((a, b) => b.count - a.count) : [];

    // Prepare complaints data - flatten to show actual objection texts
    const complaintsData = stats ? (() => {
        // First, collect all examples from all tags
        const allComplaints: Array<{ name: string; count: number; tag: string }> = [];

        Object.entries(stats.client_complaints || {}).forEach(([tag, data]) => {
            // Handle both old format (number) and new format (object with count and examples)
            const count = typeof data === 'number' ? data : ((data as any)?.count || 0);
            const examples = typeof data === 'object' && data !== null && Array.isArray((data as any).examples)
                ? (data as any).examples
                : [];

            // If we have examples, show each example as a separate complaint
            if (examples.length > 0) {
                examples.forEach((example: any) => {
                    if (example && example.trim()) {
                        allComplaints.push({
                            name: example.trim(), // Use actual objection text
                            count: 1, // Each example counts as 1 occurrence
                            tag: tag
                        });
                    }
                });
            } else if (count > 0) {
                // If no examples but we have a count, show the tag with count
                // This handles old format or cases where examples weren't captured
                allComplaints.push({
                    name: tag,
                    count: count,
                    tag: tag
                });
            }
        });

        // Group by objection text and sum counts (in case same text appears multiple times)
        const grouped: Record<string, { name: string; count: number; tag: string }> = {};
        allComplaints.forEach(complaint => {
            const key = complaint.name.toLowerCase().trim();
            if (grouped[key]) {
                grouped[key].count += complaint.count;
            } else {
                grouped[key] = { ...complaint };
            }
        });

        // Convert to array and sort
        return Object.values(grouped).sort((a, b) => {
            // Sort by count first (descending), then alphabetically by name
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name);
        });
    })() : [];

    // Transform flat criteria_scores to grouped by category
    // Backend returns: { "Criterion1": 85, "Criterion2": 90 }
    // We need: { "Category1": { "Criterion1": 85 }, "Category2": { "Criterion2": 90 } }
    const groupedCriteriaScores: Record<string, Record<string, number>> = {};

    if (stats && stats.criteria_scores && categories.length > 0) {
        // Build mapping from criterion name to category name
        const criterionToCategory: Record<string, string> = {};
        categories.forEach(cat => {
            if (cat.criteria && Array.isArray(cat.criteria)) {
                cat.criteria.forEach(criterion => {
                    criterionToCategory[criterion.name] = cat.name;
                });
            }
        });

        // Group criteria scores by category
        Object.entries(stats.criteria_scores).forEach(([criterionName, score]) => {
            const categoryName = criterionToCategory[criterionName];
            if (categoryName) {
                if (!groupedCriteriaScores[categoryName]) {
                    groupedCriteriaScores[categoryName] = {};
                }
                const numScore = typeof score === 'number' ? score : parseFloat(String(score)) || 0;
                groupedCriteriaScores[categoryName][criterionName] = numScore;
            }
        });
    }

    // Prepare criteria compliance data grouped by category
    const criteriaComplianceData = Object.entries(groupedCriteriaScores)
        .map(([category, criteria]) => {
            // Get database order for criteria from categories data
            const dbCategory = categories.find(cat => cat.name === category);
            const dbCriteriaOrder: string[] = [];
            if (dbCategory && dbCategory.criteria) {
                // Criteria are already ordered by id from the backend
                dbCriteriaOrder.push(...dbCategory.criteria.map(c => c.name));
            }

            // Build criteria list in database order
            const criteriaList: Array<{ name: string; score: number; status: string }> = [];
            const processedCriteria = new Set<string>();

            // First, add criteria in database order
            dbCriteriaOrder.forEach(criterionName => {
                if (criteria[criterionName] !== undefined) {
                    const numScore = typeof criteria[criterionName] === 'number' 
                        ? criteria[criterionName] as number 
                        : parseFloat(String(criteria[criterionName])) || 0;
                    criteriaList.push({
                        name: criterionName,
                        score: numScore,
                        status: numScore >= 80 ? 'good' : numScore >= 60 ? 'warning' : 'poor'
                    });
                    processedCriteria.add(criterionName);
                }
            });

            // Add any remaining criteria that weren't in the database (shouldn't happen, but just in case)
            Object.entries(criteria).forEach(([name, score]) => {
                if (!processedCriteria.has(name)) {
                    const numScore = typeof score === 'number' ? score : parseFloat(String(score)) || 0;
                    criteriaList.push({
                        name,
                        score: numScore,
                        status: numScore >= 80 ? 'good' : numScore >= 60 ? 'warning' : 'poor'
                    });
                }
            });

            const totalCriteria = criteriaList.length;
            const compliantCount = criteriaList.filter(c => c.status === 'good').length;
            const averageScore = totalCriteria > 0
                ? criteriaList.reduce((sum, c) => sum + c.score, 0) / totalCriteria
                : 0;

            return {
                category,
                criteria: criteriaList,
                totalCriteria,
                compliantCount,
                complianceRate: totalCriteria > 0 ? (compliantCount / totalCriteria) * 100 : 0,
                averageScore: Math.round(averageScore)
            };
        })
        .filter(categoryData => categoryData.totalCriteria > 0) // Filter out categories with no criteria
        .sort((a, b) => b.complianceRate - a.complianceRate);

    // Talk ratio data for pie chart
    const talkRatioData = stats && stats.talk_ratio ? [
        { name: 'Manager', value: stats.talk_ratio.manager },
        { name: 'Mijoz', value: stats.talk_ratio.customer }
    ] : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" />
                    <p className="mt-4 text-gray-600">Statistikalar yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                        <div>
                            <h3 className="text-lg font-semibold text-red-900">Xatolik</h3>
                            <p className="text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
                <Link
                    href="/audios"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Orqaga qaytish
                </Link>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <p className="text-yellow-800">Statistikalar topilmadi</p>
                </div>
                <Link
                    href="/audios"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Orqaga qaytish
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/audios"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <FileAudio className="h-8 w-8 text-indigo-600" />
                            Audio Statistikalar
                        </h1>
                        <p className="text-gray-600 mt-1">{stats.file.original_name}</p>
                    </div>
                </div>
            </div>

            {/* File Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="flex items-center gap-3">
                        <FileAudio className="h-5 w-5 text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-600">Fayl nomi</p>
                            <p className="font-medium text-gray-900">{stats.file.original_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-600">Manager</p>
                            <p className="font-medium text-gray-900">{stats.file.manager_name || 'Noma\'lum'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-600">Yuklangan sana</p>
                            <p className="font-medium text-gray-900">{formatDate(stats.file.upload_date)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <div>
                            <p className="text-sm text-gray-600">Davomiyligi</p>
                            <p className="font-medium text-gray-900">
                                {stats.duration ? `${Math.floor(stats.duration / 60)}:${(stats.duration % 60).toString().padStart(2, '0')}` : 'Noma\'lum'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overall Score Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Umumiy ball</h2>
                        <div className={clsx(
                            'inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold',
                            getScoreBgColor(stats.overall_score),
                            getScoreColor(stats.overall_score)
                        )}>
                            {stats.overall_score}%
                        </div>
                    </div>
                    <TrendingUp className="h-12 w-12 text-indigo-400" />
                </div>
            </div>

            {/* Criteria Scores */}
            {criteriaScoresData.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Mezon ballari (Top 10)</h2>
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={criteriaScoresData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={150}
                            />
                            <Tooltip />
                            <Bar dataKey="score" fill="#059669" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Mezonlarga rioya qilish (Criteria Compliance) */}
            {criteriaComplianceData.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Target className="h-6 w-6 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Mezonlarga rioya qilish</h2>
                    </div>
                    <div className="space-y-6">
                        {criteriaComplianceData.map((categoryData, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-md font-semibold text-gray-900">{categoryData.category}</h3>
                                        <span className={clsx(
                                            'text-xs font-medium px-2 py-1 rounded',
                                            Number(categoryData.complianceRate || 0) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                Number(categoryData.complianceRate || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                        )}>
                                            {Number(categoryData.complianceRate || 0).toFixed(0)}% rioya qilindi
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {categoryData.compliantCount} / {categoryData.totalCriteria} mezon
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-4">
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className={clsx(
                                                'h-2.5 rounded-full transition-all',
                                                Number(categoryData.complianceRate || 0) >= 80 ? 'bg-emerald-500' :
                                                    Number(categoryData.complianceRate || 0) >= 60 ? 'bg-yellow-500' :
                                                        'bg-red-500'
                                            )}
                                            style={{ width: `${categoryData.complianceRate}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Criteria list */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {categoryData.criteria.map((criterion, cIdx) => (
                                        <div
                                            key={cIdx}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {criterion.status === 'good' ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                                ) : criterion.status === 'warning' ? (
                                                    <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                                )}
                                                <span className="text-sm text-gray-700 truncate">{criterion.name}</span>
                                            </div>
                                            <span className={clsx(
                                                'text-sm font-semibold ml-2 flex-shrink-0',
                                                getScoreColor(criterion.score)
                                            )}>
                                                {criterion.score}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-6 w-6 text-yellow-600" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Mezonlarga rioya qilish</h2>
                            <p className="text-gray-600 mt-1">
                                {stats && stats.criteria_scores && Object.keys(stats.criteria_scores).length > 0
                                    ? 'Mezon ma\'lumotlari topildi, lekin kategoriyalar bilan moslashtirib bo\'lmadi. Kategoriyalar yuklanganligini tekshiring.'
                                    : 'Mezon ma\'lumotlari topilmadi. Tahlil jarayonida mezonlar baholanmagan bo\'lishi mumkin.'}
                            </p>
                            {stats && stats.criteria_scores && Object.keys(stats.criteria_scores).length > 0 && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Topilgan mezonlar: {Object.keys(stats.criteria_scores).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Talk Ratio */}
            {talkRatioData.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Gapirish nisbati</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={talkRatioData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {talkRatioData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Mistakes */}
            {mistakesData.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Xatolar</h2>
                    <div className="space-y-3">
                        {mistakesData.map((mistake, index) => (
                            <div
                                key={index}
                                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900">{mistake.name}</span>
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                {mistake.category}
                                            </span>
                                            <span className="text-sm font-semibold text-red-600">
                                                {mistake.count} marta
                                            </span>
                                        </div>
                                        {mistake.recommendation && (
                                            <p className="text-sm text-gray-600 mt-2">
                                                <span className="font-medium">Tavsiya:</span> {mistake.recommendation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mijoz e'tirozlari (Customer Complaints) */}
            {complaintsData.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Mijoz e'tirozlari</h2>
                        <span className="ml-auto text-sm text-gray-600 bg-red-50 text-red-700 px-3 py-1 rounded-full font-medium">
                            Jami: {complaintsData.reduce((sum, item) => sum + item.count, 0)} ta
                        </span>
                    </div>

                    {/* Detailed list */}
                    <div className="space-y-2">
                        {complaintsData.map((complaint, index) => {
                            const totalComplaints = complaintsData.reduce((sum, item) => sum + item.count, 0);
                            const percentage = totalComplaints > 0 ? (complaint.count / totalComplaints) * 100 : 0;

                            return (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white font-semibold text-sm">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{complaint.name}</p>
                                        </div>
                                    </div>
                                    <div className="w-32">
                                        <div className="w-full bg-red-200 rounded-full h-2">
                                            <div
                                                className="bg-red-600 h-2 rounded-full transition-all"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Show message if no complaints */}
            {complaintsData.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Mijoz e'tirozlari</h2>
                            <p className="text-gray-600 mt-1">Mijoz e'tirozlari topilmadi. Yaxshi ish!</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4">
                <Link
                    href={`/audios/${stats.file.id}/transcription`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <MessageSquare className="h-4 w-4" />
                    Transkripsiyani ko'rish
                </Link>
                <Link
                    href="/audios"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Orqaga qaytish
                </Link>
            </div>
        </div>
    );
}
