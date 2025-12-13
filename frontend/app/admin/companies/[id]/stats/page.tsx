'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building2, ArrowLeft, BarChart3, Users, FileAudio, TrendingUp, Calendar, Filter } from 'lucide-react';
import axios from 'axios';
import { authService } from '@/services/authService';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Manager, VolumeDataPoint } from '@/services/statsService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatDate, formatDuration } from '@/utils/dateTime';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface CompanyStats {
    company: {
        id: number;
        name: string;
        database_name: string;
    };
    summary: {
        totalAudioFiles: number;
        completedAudioFiles: number;
        managers: number;
        analyses: number;
        categories: number;
        averageScore: number;
        totalDuration: number; // in seconds
    };
    managerStats: Manager[];
    volumeStats: VolumeDataPoint[];
}

export default function CompanyStatsPage() {
    const params = useParams();
    const router = useRouter();
    const companyId = params.id as string;

    const [stats, setStats] = useState<CompanyStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterPeriod, setFilterPeriod] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        fetchStats();
    }, [companyId, filterPeriod, customStartDate, customEndDate]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');
            const token = authService.getToken();

            const params = new URLSearchParams();
            params.append('period', filterPeriod);
            if (customStartDate) params.append('startDate', customStartDate);
            if (customEndDate) params.append('endDate', customEndDate);

            const response = await axios.get(
                `${API_URL}/api/companies/${companyId}/stats?${params.toString()}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStats(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch company stats');
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <ProtectedRoute allowedRoles={['super_admin']}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="mt-4 text-gray-600">Loading company statistics...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    if (error) {
        return (
            <ProtectedRoute allowedRoles={['super_admin']}>
                <div className="max-w-7xl mx-auto">
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                        {error}
                    </div>
                    <button
                        onClick={() => router.push('/admin/companies')}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                        <ArrowLeft size={16} className="inline mr-2" />
                        Back to Companies
                    </button>
                </div>
            </ProtectedRoute>
        );
    }

    if (!stats) {
        return null;
    }

    return (
        <ProtectedRoute allowedRoles={['super_admin']}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/admin/companies')}
                        className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft size={20} className="mr-2" />
                        Back to Companies
                    </button>
                    <div className="flex items-center gap-3">
                        <Building2 size={32} className="text-indigo-600" />
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{stats.company.name}</h1>
                            <p className="text-sm text-gray-500 mt-1">Company Statistics</p>
                        </div>
                    </div>
                </div>

                {/* Filter Section */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Filter size={18} className="text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">Period:</span>
                        </div>
                        <select
                            value={filterPeriod}
                            onChange={(e) => {
                                setFilterPeriod(e.target.value);
                                if (e.target.value !== 'custom') {
                                    setCustomStartDate('');
                                    setCustomEndDate('');
                                }
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        {filterPeriod === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="text-gray-500">to</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Audio Files</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.summary.totalAudioFiles}</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {stats.summary.completedAudioFiles} completed
                                </p>
                            </div>
                            <FileAudio size={40} className="text-indigo-600 opacity-20" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Time Analyzed</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">
                                    {formatDuration(stats.summary.totalDuration)}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {stats.summary.completedAudioFiles} audios
                                </p>
                            </div>
                            <Calendar size={40} className="text-indigo-600 opacity-20" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Managers</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.summary.managers}</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {stats.managerStats.length} active
                                </p>
                            </div>
                            <Users size={40} className="text-indigo-600 opacity-20" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Average Score</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.summary.averageScore}%</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    {stats.summary.analyses} analyses
                                </p>
                            </div>
                            <TrendingUp size={40} className="text-indigo-600 opacity-20" />
                        </div>
                    </div>
                </div>

                {/* Volume Chart */}
                {stats.volumeStats.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6 mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 size={24} />
                            Call Volume Over Time
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={stats.volumeStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(value) => formatDate(value)}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(value) => formatDate(value)}
                                    formatter={(value: number) => [value, 'Calls']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#4338ca"
                                    strokeWidth={2}
                                    dot={{ fill: '#4338ca', r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Manager Stats Table */}
                {stats.managerStats.length > 0 && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Users size={24} />
                                Manager Performance
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Manager
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Total Audios
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Average Score
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Hours Assigned
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Hours Used
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Hours Remaining
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {stats.managerStats.map((manager) => (
                                        <tr key={manager.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <Users size={18} className="text-gray-400 mr-2" />
                                                    <span className="text-sm font-medium text-gray-900">{manager.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-900">{manager.total_audios || 0}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${(manager.average_score || 0) >= 80 ? 'text-green-600' :
                                                    (manager.average_score || 0) >= 60 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                    }`}>
                                                    {manager.average_score || 0}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-900">
                                                    {manager.hours_assigned !== undefined ? Number(manager.hours_assigned).toFixed(1) : '--'}h
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${manager.hours_used !== undefined && manager.hours_assigned !== undefined
                                                    ? Number(manager.hours_used) >= Number(manager.hours_assigned)
                                                        ? 'text-red-600'
                                                        : Number(manager.hours_used) >= Number(manager.hours_assigned) * 0.8
                                                            ? 'text-yellow-600'
                                                            : 'text-gray-900'
                                                    : 'text-gray-900'
                                                    }`}>
                                                    {manager.hours_used !== undefined ? Number(manager.hours_used).toFixed(1) : '--'}h
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${manager.hours_remaining !== undefined
                                                    ? Number(manager.hours_remaining) <= 0
                                                        ? 'text-red-600'
                                                        : Number(manager.hours_remaining) <= Number(manager.hours_assigned || 0) * 0.2
                                                            ? 'text-yellow-600'
                                                            : 'text-green-600'
                                                    : 'text-gray-900'
                                                    }`}>
                                                    {manager.hours_remaining !== undefined ? Number(manager.hours_remaining).toFixed(1) : '--'}h
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {stats.managerStats.length === 0 && stats.volumeStats.length === 0 && (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600">No statistics available for this period.</p>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
