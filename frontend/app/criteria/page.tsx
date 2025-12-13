"use client";

import React, { useState, useEffect } from 'react';
import { api, Category, Criterion } from '@/services/api';
import { Plus, Edit2, Trash2, X, Save, AlertCircle, Loader2 } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

export default function CriteriaPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

    // Category form state
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState('');

    // Criterion form state
    const [showCriterionForm, setShowCriterionForm] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [editingCriterion, setEditingCriterion] = useState<Criterion | null>(null);
    const [criterionName, setCriterionName] = useState('');
    const [criterionDescription, setCriterionDescription] = useState('');

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'category' | 'criterion';
        id: number;
        name: string;
    } | null>(null);

    // Loading states
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
    const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
    const [isCreatingCriterion, setIsCreatingCriterion] = useState(false);
    const [isUpdatingCriterion, setIsUpdatingCriterion] = useState(false);
    const [deletingCriterionId, setDeletingCriterionId] = useState<number | null>(null);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getCategories();
            setCategories(data);
            // Auto-select first category if none selected
            if (!selectedCategory && data.length > 0) {
                setSelectedCategory(data[0]);
            } else if (selectedCategory) {
                // Update selected category with fresh data
                const updated = data.find(c => c.id === selectedCategory.id);
                if (updated) setSelectedCategory(updated);
            }
        } catch (err: any) {
            setError(err.message || 'Ma\'lumotlarni yuklashda xatolik yuz berdi');
            console.error('Error loading categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryName.trim()) return;

        setIsCreatingCategory(true);
        try {
            setError(null);
            const newCategory = await api.createCategory(categoryName.trim());
            setCategoryName('');
            setShowCategoryForm(false);
            await loadCategories();
            // Select the newly created category
            setSelectedCategory(newCategory);
        } catch (err: any) {
            setError(err.message || 'Kategoriya yaratishda xatolik yuz berdi');
            console.error('Error creating category:', err);
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory || !categoryName.trim()) return;

        setIsUpdatingCategory(true);
        try {
            setError(null);
            await api.updateCategory(editingCategory.id, categoryName.trim());
            setEditingCategory(null);
            setCategoryName('');
            await loadCategories();
        } catch (err: any) {
            setError(err.message || 'Kategoriyani yangilashda xatolik yuz berdi');
            console.error('Error updating category:', err);
        } finally {
            setIsUpdatingCategory(false);
        }
    };

    const handleDeleteCategoryClick = (id: number, name: string) => {
        const category = categories.find(c => c.id === id);
        setConfirmModal({
            isOpen: true,
            type: 'category',
            id,
            name
        });
    };

    const handleDeleteCategory = async (id: number) => {
        setDeletingCategoryId(id);
        try {
            setError(null);
            await api.deleteCategory(id);
            // If deleted category was selected, clear selection or select first available
            if (selectedCategory?.id === id) {
                const remaining = categories.filter(c => c.id !== id);
                setSelectedCategory(remaining.length > 0 ? remaining[0] : null);
            }
            await loadCategories();
        } catch (err: any) {
            setError(err.message || 'Kategoriyani o\'chirishda xatolik yuz berdi');
            console.error('Error deleting category:', err);
        } finally {
            setDeletingCategoryId(null);
        }
    };

    const handleCreateCriterion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategoryId || !criterionName.trim()) return;

        setIsCreatingCriterion(true);
        try {
            setError(null);
            await api.createCriterion(
                selectedCategoryId,
                criterionName.trim(),
                criterionDescription.trim() || undefined
            );
            setCriterionName('');
            setCriterionDescription('');
            setShowCriterionForm(false);
            setSelectedCategoryId(null);
            await loadCategories();
        } catch (err: any) {
            setError(err.message || 'Mezon yaratishda xatolik yuz berdi');
            console.error('Error creating criterion:', err);
        } finally {
            setIsCreatingCriterion(false);
        }
    };

    const handleUpdateCriterion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCriterion || !criterionName.trim()) return;

        setIsUpdatingCriterion(true);
        try {
            setError(null);
            await api.updateCriterion(
                editingCriterion.id,
                criterionName.trim(),
                criterionDescription.trim() || undefined
            );
            setEditingCriterion(null);
            setCriterionName('');
            setCriterionDescription('');
            await loadCategories();
        } catch (err: any) {
            setError(err.message || 'Mezonni yangilashda xatolik yuz berdi');
            console.error('Error updating criterion:', err);
        } finally {
            setIsUpdatingCriterion(false);
        }
    };

    const handleDeleteCriterionClick = (id: number, name: string) => {
        setConfirmModal({
            isOpen: true,
            type: 'criterion',
            id,
            name
        });
    };

    const handleDeleteCriterion = async (id: number) => {
        setDeletingCriterionId(id);
        try {
            setError(null);
            await api.deleteCriterion(id);
            await loadCategories();
        } catch (err: any) {
            setError(err.message || 'Mezonni o\'chirishda xatolik yuz berdi');
            console.error('Error deleting criterion:', err);
        } finally {
            setDeletingCriterionId(null);
        }
    };

    const startEditCategory = (category: Category) => {
        setEditingCategory(category);
        setCategoryName(category.name);
        setShowCategoryForm(false);
    };

    const cancelEditCategory = () => {
        setEditingCategory(null);
        setCategoryName('');
    };

    const startEditCriterion = (criterion: Criterion) => {
        setEditingCriterion(criterion);
        setCriterionName(criterion.name);
        setCriterionDescription(criterion.description || '');
        setShowCriterionForm(false);
    };

    const cancelEditCriterion = () => {
        setEditingCriterion(null);
        setCriterionName('');
        setCriterionDescription('');
        setSelectedCategoryId(null);
    };

    const openCriterionForm = (categoryId: number) => {
        setSelectedCategoryId(categoryId);
        setShowCriterionForm(true);
        setEditingCriterion(null);
        setCriterionName('');
        setCriterionDescription('');
    };

    const handleCategorySelect = (category: Category) => {
        setSelectedCategory(category);
        setShowCriterionForm(false);
        setEditingCriterion(null);
        setEditingCategory(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-200px)]">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Me'zonlar</h1>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Two Column Layout */}
            <div className="flex gap-6 h-full">
                {/* Left Column - Categories */}
                <div className="w-80 flex-shrink-0">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col">
                        {/* Category Section Header */}
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Kategoriyalar</h2>
                            {!showCategoryForm && (
                                <button
                                    onClick={() => {
                                        setShowCategoryForm(true);
                                        setEditingCategory(null);
                                        setCategoryName('');
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                                >
                                    <Plus size={16} />
                                    Qo'shish
                                </button>
                            )}
                        </div>

                        {/* Category Form */}
                        {showCategoryForm && (
                            <div className="p-4 border-b border-gray-200">
                                <form onSubmit={handleCreateCategory} className="space-y-2">
                                    <input
                                        type="text"
                                        value={categoryName}
                                        onChange={(e) => setCategoryName(e.target.value)}
                                        placeholder="Kategoriya nomi"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 placeholder:text-gray-400"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={isCreatingCategory}
                                            className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isCreatingCategory ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Saqlanmoqda...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={16} />
                                                    Saqlash
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCategoryForm(false);
                                                setCategoryName('');
                                            }}
                                            disabled={isCreatingCategory}
                                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Categories List */}
                        <div className="flex-1 overflow-y-auto">
                            {categories.length === 0 ? (
                                <div className="p-6 text-center">
                                    <p className="text-sm text-gray-500">Hozircha kategoriyalar mavjud emas</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {categories.map((category) => (
                                        <div
                                            key={category.id}
                                            className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedCategory?.id === category.id
                                                ? 'bg-indigo-50 border-l-4 border-indigo-600'
                                                : ''
                                                }`}
                                            onClick={() => handleCategorySelect(category)}
                                        >
                                            {editingCategory?.id === category.id ? (
                                                <form
                                                    onSubmit={handleUpdateCategory}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="space-y-2"
                                                >
                                                    <input
                                                        type="text"
                                                        value={categoryName}
                                                        onChange={(e) => setCategoryName(e.target.value)}
                                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-900 placeholder:text-gray-400"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="submit"
                                                            disabled={isUpdatingCategory}
                                                            className="flex-1 px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            {isUpdatingCategory ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Save size={14} />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                cancelEditCategory();
                                                            }}
                                                            disabled={isUpdatingCategory}
                                                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="font-medium text-gray-900 text-sm">
                                                            {category.name}
                                                        </h3>
                                                        {category.criteria && category.criteria.length > 0 && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {category.criteria.length} mezon
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                startEditCategory(category);
                                                            }}
                                                            className="p-1 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteCategoryClick(category.id, category.name);
                                                            }}
                                                            disabled={deletingCategoryId === category.id}
                                                            className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            {deletingCategoryId === category.id ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Criteria */}
                <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-y-auto">
                    {selectedCategory ? (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedCategory.name}</h2>
                                    {selectedCategory.criteria && selectedCategory.criteria.length > 0 && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedCategory.criteria.length} ta mezon
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => openCriterionForm(selectedCategory.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus size={18} />
                                    Mezon qo'shish
                                </button>
                            </div>

                            {/* Criteria List */}
                            {selectedCategory.criteria && selectedCategory.criteria.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedCategory.criteria.map((criterion) => (
                                        <div
                                            key={criterion.id}
                                            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                            {editingCriterion?.id === criterion.id ? (
                                                <form onSubmit={handleUpdateCriterion} className="space-y-3">
                                                    <input
                                                        type="text"
                                                        value={criterionName}
                                                        onChange={(e) => setCriterionName(e.target.value)}
                                                        placeholder="Mezon nomi"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                                                        autoFocus
                                                    />
                                                    <textarea
                                                        value={criterionDescription}
                                                        onChange={(e) => setCriterionDescription(e.target.value)}
                                                        placeholder="Tavsif (ixtiyoriy)"
                                                        rows={3}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900 placeholder:text-gray-400"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="submit"
                                                            disabled={isUpdatingCriterion}
                                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            {isUpdatingCriterion ? (
                                                                <>
                                                                    <Loader2 size={16} className="animate-spin" />
                                                                    Saqlanmoqda...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Save size={16} />
                                                                    Saqlash
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelEditCriterion}
                                                            disabled={isUpdatingCriterion}
                                                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            Bekor qilish
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="font-medium text-gray-900 mb-1">
                                                            {criterion.name}
                                                        </h3>
                                                        {criterion.description && (
                                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                                                {criterion.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <button
                                                            onClick={() => startEditCriterion(criterion)}
                                                            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCriterionClick(criterion.id, criterion.name)}
                                                            disabled={deletingCriterionId === criterion.id}
                                                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                        >
                                                            {deletingCriterionId === criterion.id ? (
                                                                <Loader2 size={18} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={18} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 mb-4">Bu kategoriya uchun mezonlar mavjud emas</p>
                                    <button
                                        onClick={() => openCriterionForm(selectedCategory.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        <Plus size={18} />
                                        Birinchi mezonni qo'shish
                                    </button>
                                </div>
                            )}

                            {/* Criterion Form */}
                            {showCriterionForm && selectedCategoryId === selectedCategory.id && (
                                <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                    <form onSubmit={handleCreateCriterion} className="space-y-3">
                                        <input
                                            type="text"
                                            value={criterionName}
                                            onChange={(e) => setCriterionName(e.target.value)}
                                            placeholder="Mezon nomi"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 placeholder:text-gray-400"
                                            autoFocus
                                        />
                                        <textarea
                                            value={criterionDescription}
                                            onChange={(e) => setCriterionDescription(e.target.value)}
                                            placeholder="Tavsif (ixtiyoriy)"
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-900 placeholder:text-gray-400"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="submit"
                                                disabled={isCreatingCriterion}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {isCreatingCriterion ? (
                                                    <>
                                                        <Loader2 size={16} className="animate-spin" />
                                                        Saqlanmoqda...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save size={16} />
                                                        Saqlash
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowCriterionForm(false);
                                                    setSelectedCategoryId(null);
                                                    setCriterionName('');
                                                    setCriterionDescription('');
                                                }}
                                                disabled={isCreatingCriterion}
                                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                Bekor qilish
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <p className="text-gray-500 text-lg mb-2">Kategoriya tanlang</p>
                                <p className="text-sm text-gray-400">
                                    Mezonlarni ko'rish uchun chap tomondan kategoriyani tanlang
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmModal && (
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => {
                        if (confirmModal.type === 'category' && deletingCategoryId === null) {
                            setConfirmModal(null);
                        } else if (confirmModal.type === 'criterion' && deletingCriterionId === null) {
                            setConfirmModal(null);
                        }
                    }}
                    onConfirm={async () => {
                        if (confirmModal.type === 'category') {
                            await handleDeleteCategory(confirmModal.id);
                        } else {
                            await handleDeleteCriterion(confirmModal.id);
                        }
                        setConfirmModal(null);
                    }}
                    title={confirmModal.type === 'category' ? 'Kategoriyani o\'chirish' : 'Mezonni o\'chirish'}
                    message={
                        confirmModal.type === 'category'
                            ? `"${confirmModal.name}" kategoriyasini o'chirmoqchimisiz? Barcha mezonlar ham o'chiriladi.`
                            : `"${confirmModal.name}" mezonini o'chirmoqchimisiz?`
                    }
                    type="danger"
                    isLoading={
                        (confirmModal.type === 'category' && deletingCategoryId === confirmModal.id) ||
                        (confirmModal.type === 'criterion' && deletingCriterionId === confirmModal.id)
                    }
                />
            )}
        </div>
    );
}
