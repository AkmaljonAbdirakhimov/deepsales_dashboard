'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Trash2, Edit, BarChart3, Eye, EyeOff, Loader2 } from 'lucide-react';
import axios from 'axios';
import { authService } from '@/services/authService';
import ProtectedRoute from '@/components/ProtectedRoute';
import ConfirmModal from '@/components/ConfirmModal';

interface CompanyUsage {
    currentManagers: number;
    currentHours: number;
    maxManagers: number;
    maxHours: number;
    managersUsed: number;
    hoursUsed: number;
    isOverManagersLimit: boolean;
    isOverHoursLimit: boolean;
}

interface Company {
    id: number;
    name: string;
    database_name: string;
    plan_id: number | null;
    plan_name: string | null;
    plan_price: number | null;
    max_managers: number | null;
    hours_per_manager: number | null;
    price_per_manager: number | null;
    price_per_hour: number | null;
    extra_managers: number;
    extra_hours: number;
    created_at: string;
    user_count: number;
    usage?: CompanyUsage | null;
}

interface PricingPlan {
    id: number;
    name: string;
    description: string | null;
    price: number;
    max_managers: number;
    hours_per_manager: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function CompaniesPage() {
    const router = useRouter();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingCompanyId, setDeletingCompanyId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        adminUsername: '',
        adminPassword: '',
        plan_id: '',
        extra_managers: '',
        extra_hours: ''
    });

    useEffect(() => {
        fetchCompanies();
        fetchPricingPlans();
    }, []);

    const calculateTotalMonthlyPrice = (company: Company): number => {
        if (!company.plan_price) return 0;

        let total = Number(company.plan_price);

        // Add cost for extra managers
        if (Number(company.extra_managers || 0) > 0 && company.price_per_manager) {
            total += Number(company.extra_managers) * Number(company.price_per_manager);
        }

        // Add cost for extra hours
        if (Number(company.extra_hours || 0) > 0 && company.price_per_hour) {
            total += Number(company.extra_hours) * Number(company.price_per_hour);
        }

        return total;
    };

    const fetchCompanies = async () => {
        try {
            const token = authService.getToken();
            const response = await axios.get(`${API_URL}/api/companies?includeUsage=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompanies(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch companies');
        } finally {
            setLoading(false);
        }
    };

    const fetchPricingPlans = async () => {
        try {
            const token = authService.getToken();
            const response = await axios.get(`${API_URL}/api/pricing-plans`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPricingPlans(response.data);
        } catch (err: any) {
            console.error('Failed to fetch pricing plans:', err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const token = authService.getToken();
            await axios.post(
                `${API_URL}/api/companies`,
                {
                    ...formData,
                    plan_id: formData.plan_id ? parseInt(formData.plan_id) : null,
                    extra_managers: formData.extra_managers ? parseInt(formData.extra_managers) : 0,
                    extra_hours: formData.extra_hours ? parseFloat(formData.extra_hours) : 0
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setShowCreateModal(false);
            resetForm();
            fetchCompanies();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create company');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (company: Company) => {
        setEditingCompany(company);
        setFormData({
            name: company.name,
            adminUsername: '',
            adminPassword: '',
            plan_id: company.plan_id?.toString() || '',
            extra_managers: company.extra_managers?.toString() || '0',
            extra_hours: company.extra_hours?.toString() || '0'
        });
        setShowCreateModal(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCompany) return;
        setError('');
        setIsSubmitting(true);

        try {
            const token = authService.getToken();
            await axios.put(
                `${API_URL}/api/companies/${editingCompany.id}`,
                {
                    name: formData.name,
                    plan_id: formData.plan_id ? parseInt(formData.plan_id) : null,
                    extra_managers: formData.extra_managers ? parseInt(formData.extra_managers) : 0,
                    extra_hours: formData.extra_hours ? parseFloat(formData.extra_hours) : 0
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setShowCreateModal(false);
            setEditingCompany(null);
            resetForm();
            fetchCompanies();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update company');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', adminUsername: '', adminPassword: '', plan_id: '', extra_managers: '', extra_hours: '' });
        setEditingCompany(null);
        setShowAdminPassword(false);
    };

    const handleDeleteClick = (e: React.MouseEvent, company: Company) => {
        e.stopPropagation(); // Prevent row click
        setCompanyToDelete(company);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!companyToDelete) return;

        setDeletingCompanyId(companyToDelete.id);
        try {
            const token = authService.getToken();
            await axios.delete(`${API_URL}/api/companies/${companyToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowDeleteModal(false);
            setCompanyToDelete(null);
            fetchCompanies();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete company');
            setShowDeleteModal(false);
            setCompanyToDelete(null);
        } finally {
            setDeletingCompanyId(null);
        }
    };

    const handleRowClick = (companyId: number) => {
        router.push(`/admin/companies/${companyId}/stats`);
    };

    return (
        <ProtectedRoute allowedRoles={['super_admin']}>
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        <Plus size={20} />
                        Create Company
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Database
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Plan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Usage
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Users
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {companies.map((company) => (
                                    <tr
                                        key={company.id}
                                        onClick={() => handleRowClick(company.id)}
                                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Building2 size={20} className="text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{company.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-500">{company.database_name}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {company.plan_name ? (
                                                <div className="text-sm">
                                                    <div>
                                                        <span className="font-medium text-gray-900">{company.plan_name}</span>
                                                        <span className="text-gray-500 ml-2">${company.plan_price ? Number(company.plan_price).toFixed(2) : '0.00'}</span>
                                                    </div>
                                                    {Number(company.extra_managers || 0) > 0 || Number(company.extra_hours || 0) > 0 ? (
                                                        <div className="text-xs text-indigo-600 mt-1">
                                                            +{company.extra_managers || 0} managers, +{company.extra_hours || 0} hrs
                                                        </div>
                                                    ) : null}
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Total: {(company.max_managers || 0) + (company.extra_managers || 0)} managers,
                                                        {((company.max_managers || 0) + (company.extra_managers || 0)) * (company.hours_per_manager || 0) + (company.extra_hours || 0)} hrs
                                                    </div>
                                                    <div className="text-xs font-semibold text-indigo-600 mt-1">
                                                        Monthly: ${calculateTotalMonthlyPrice(company).toFixed(2)}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">No plan</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {company.usage ? (
                                                <div className="text-sm">
                                                    <div className="mb-1">
                                                        <span className="text-gray-600">Managers: </span>
                                                        <span className={company.usage.isOverManagersLimit ? 'font-semibold text-red-600' : 'font-medium text-gray-900'}>
                                                            {company.usage.currentManagers} / {company.usage.maxManagers}
                                                        </span>
                                                        {company.usage.isOverManagersLimit && (
                                                            <span className="ml-1 text-xs text-red-600">⚠️ Over limit</span>
                                                        )}
                                                    </div>
                                                    <div className="mb-1">
                                                        <span className="text-gray-600">Hours: </span>
                                                        <span className={company.usage.isOverHoursLimit ? 'font-semibold text-red-600' : 'font-medium text-gray-900'}>
                                                            {Number(company.usage.currentHours || 0).toFixed(1)} / {Number(company.usage.maxHours || 0).toFixed(1)}
                                                        </span>
                                                        {company.usage.isOverHoursLimit && (
                                                            <span className="ml-1 text-xs text-red-600">⚠️ Over limit</span>
                                                        )}
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                                        <div
                                                            className={`h-1.5 rounded-full ${company.usage.hoursUsed > 100
                                                                ? 'bg-red-600'
                                                                : company.usage.hoursUsed > 80
                                                                    ? 'bg-yellow-500'
                                                                    : 'bg-indigo-600'
                                                                }`}
                                                            style={{ width: `${Math.min(company.usage.hoursUsed, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Loading...</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{company.user_count}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-500">
                                                {new Date(company.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div
                                                className="flex items-center justify-end gap-2"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEdit(company);
                                                    }}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                    title="Edit"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRowClick(company.id);
                                                    }}
                                                    className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                                                    title="View Stats"
                                                >
                                                    <BarChart3 size={18} />
                                                    <span className="hidden sm:inline">Stats</span>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(e, company)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="fixed inset-0"
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
                            onClick={() => {
                                setShowCreateModal(false);
                                resetForm();
                            }}
                        ></div>
                        <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-200">
                            <h2 className="text-xl font-bold mb-4 text-gray-900">
                                {editingCompany ? 'Edit Company' : 'Create Company'}
                            </h2>
                            <form onSubmit={editingCompany ? handleUpdate : handleCreate}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Company Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter company name"
                                    />
                                </div>
                                {!editingCompany && (
                                    <>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Admin Username
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.adminUsername}
                                                onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="Enter admin username"
                                            />
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Admin Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showAdminPassword ? 'text' : 'password'}
                                                    required
                                                    value={formData.adminPassword}
                                                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                                                    className="w-full pr-10 px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="Enter admin password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAdminPassword((prev) => !prev)}
                                                    className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                                                    aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                                                >
                                                    {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Pricing Plan
                                    </label>
                                    <select
                                        value={formData.plan_id}
                                        onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        <option value="">No plan</option>
                                        {pricingPlans.map((plan) => (
                                            <option key={plan.id} value={plan.id.toString()}>
                                                {plan.name} - ${Number(plan.price || 0).toFixed(2)} ({plan.max_managers} managers, {Number(plan.hours_per_manager || 0)} hrs/manager)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Extra Managers
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.extra_managers}
                                        onChange={(e) => setFormData({ ...formData, extra_managers: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Additional managers beyond plan limit</p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Extra Hours
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={formData.extra_hours}
                                        onChange={(e) => setFormData({ ...formData, extra_hours: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0.0"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Additional hours beyond plan allocation</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {editingCompany ? 'Updating...' : 'Creating...'}
                                            </>
                                        ) : (
                                            editingCompany ? 'Update' : 'Create'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            resetForm();
                                        }}
                                        disabled={isSubmitting}
                                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <ConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => {
                        if (!deletingCompanyId) {
                            setShowDeleteModal(false);
                            setCompanyToDelete(null);
                        }
                    }}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Company"
                    message={`Are you sure you want to delete "${companyToDelete?.name}"? This action will permanently delete the company and its database. This cannot be undone.`}
                    confirmText="Delete"
                    cancelText="Cancel"
                    type="danger"
                    isLoading={deletingCompanyId !== null}
                />
            </div>
        </ProtectedRoute>
    );
}
