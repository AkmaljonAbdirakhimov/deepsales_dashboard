'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Edit, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import { authService } from '@/services/authService';
import ProtectedRoute from '@/components/ProtectedRoute';

interface PricingPlan {
    id: number;
    name: string;
    description: string | null;
    price: number;
    max_managers: number;
    hours_per_manager: number;
    price_per_manager: number;
    price_per_hour: number;
    created_at: string;
    updated_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function PricingPage() {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        max_managers: '',
        hours_per_manager: '',
        price_per_manager: '',
        price_per_hour: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const token = authService.getToken();
            const response = await axios.get(`${API_URL}/api/pricing-plans`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPlans(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch pricing plans');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const token = authService.getToken();
            await axios.post(
                `${API_URL}/api/pricing-plans`,
                {
                    name: formData.name,
                    description: formData.description || null,
                    price: parseFloat(formData.price),
                    max_managers: parseInt(formData.max_managers),
                    hours_per_manager: parseFloat(formData.hours_per_manager),
                    price_per_manager: parseFloat(formData.price_per_manager),
                    price_per_hour: parseFloat(formData.price_per_hour)
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setShowCreateModal(false);
            resetForm();
            fetchPlans();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create pricing plan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (plan: PricingPlan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            description: plan.description || '',
            price: plan.price.toString(),
            max_managers: plan.max_managers.toString(),
            hours_per_manager: plan.hours_per_manager.toString(),
            price_per_manager: plan.price_per_manager.toString(),
            price_per_hour: plan.price_per_hour.toString()
        });
        setShowCreateModal(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPlan) return;
        setError('');
        setIsSubmitting(true);

        try {
            const token = authService.getToken();
            await axios.put(
                `${API_URL}/api/pricing-plans/${editingPlan.id}`,
                {
                    name: formData.name,
                    description: formData.description || null,
                    price: parseFloat(formData.price),
                    max_managers: parseInt(formData.max_managers),
                    hours_per_manager: parseFloat(formData.hours_per_manager),
                    price_per_manager: parseFloat(formData.price_per_manager),
                    price_per_hour: parseFloat(formData.price_per_hour)
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setShowCreateModal(false);
            setEditingPlan(null);
            resetForm();
            fetchPlans();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update pricing plan');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this pricing plan?')) {
            return;
        }

        setDeletingPlanId(id);
        try {
            const token = authService.getToken();
            await axios.delete(`${API_URL}/api/pricing-plans/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPlans();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete pricing plan');
        } finally {
            setDeletingPlanId(null);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            price: '',
            max_managers: '',
            hours_per_manager: '',
            price_per_manager: '',
            price_per_hour: ''
        });
        setEditingPlan(null);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditingPlan(null);
        resetForm();
    };

    return (
        <ProtectedRoute allowedRoles={['super_admin']}>
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Pricing Plans</h1>
                    <button
                        onClick={() => {
                            resetForm();
                            setShowCreateModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        <Plus size={20} />
                        Create Plan
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
                        {plans.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                No pricing plans found. Create your first plan to get started.
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Plan Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Price
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Max Managers
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Hours/Manager
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {plans.map((plan) => (
                                        <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <DollarSign size={20} className="text-gray-400 mr-2" />
                                                    <span className="text-sm font-medium text-gray-900">{plan.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-500">
                                                    {plan.description || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-gray-900">
                                                    ${Number(plan.price || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-900">{plan.max_managers}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-900">{Number(plan.hours_per_manager || 0)} hrs</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(plan)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                        title="Edit"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(plan.id)}
                                                        disabled={deletingPlanId === plan.id}
                                                        className="text-red-600 hover:text-red-900 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        title="Delete"
                                                    >
                                                        {deletingPlanId === plan.id ? (
                                                            <Loader2 size={18} className="animate-spin" />
                                                        ) : (
                                                            <Trash2 size={18} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="fixed inset-0"
                            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
                            onClick={handleCloseModal}
                        ></div>
                        <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingPlan ? 'Edit Pricing Plan' : 'Create Pricing Plan'}
                                </h2>
                                <button
                                    onClick={handleCloseModal}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={editingPlan ? handleUpdate : handleCreate}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Plan Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter plan name"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter plan description (optional)"
                                        rows={3}
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Price ($) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Number of Managers *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.max_managers}
                                        onChange={(e) => setFormData({ ...formData, max_managers: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter max managers"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Hours per Manager *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.1"
                                        value={formData.hours_per_manager}
                                        onChange={(e) => setFormData({ ...formData, hours_per_manager: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter hours per manager"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Price per Extra Manager ($) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price_per_manager}
                                        onChange={(e) => setFormData({ ...formData, price_per_manager: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Monthly price for each extra manager</p>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Price per Extra Hour ($) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price_per_hour}
                                        onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Price for each extra hour beyond plan allocation</p>
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
                                                {editingPlan ? 'Updating...' : 'Creating...'}
                                            </>
                                        ) : (
                                            editingPlan ? 'Update' : 'Create'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
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
            </div>
        </ProtectedRoute>
    );
}
