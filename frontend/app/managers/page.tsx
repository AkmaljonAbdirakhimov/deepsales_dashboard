"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Save, Edit, Trash2, Users, X } from 'lucide-react';
import { api, Manager, ManagerLimitInfo } from '@/services/api';

export default function ManagersPage() {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [limitInfo, setLimitInfo] = useState<ManagerLimitInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nameInput, setNameInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [managerList, limits] = await Promise.all([
                api.getManagers(),
                api.getManagerLimits()
            ]);
            setManagers(managerList);
            setLimitInfo(limits);
        } catch (err: any) {
            setError(err?.message || 'Ma\'lumotlarni yuklashda xatolik.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nameInput.trim()) return;
        if (limitInfo && !limitInfo.allowed) {
            setError(limitInfo.message || 'Tarif bo\'yicha menejer yaratib bo\'lmaydi.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            await api.createManager(nameInput.trim());
            setNameInput('');
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Menejer yaratishda xatolik.');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (manager: Manager) => {
        setEditingId(manager.id);
        setEditingName(manager.name);
    };

    const handleUpdate = async (id: number) => {
        if (!editingName.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await api.updateManager(id, editingName.trim());
            setEditingId(null);
            setEditingName('');
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Menejerni yangilashda xatolik.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        const manager = managers.find((m) => m.id === id);
        if (!manager) return;

        if (!window.confirm(`"${manager.name}" menejerini o'chirmoqchimisiz?`)) {
            return;
        }

        setDeletingId(id);
        setError(null);
        try {
            await api.deleteManager(id);
            await loadData();
        } catch (err: any) {
            setError(err?.message || 'Menejerni o\'chirishda xatolik.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Menejerlar</h1>
                    <p className="text-gray-600">Yuklashda tanlash uchun menejerlarni yarating va boshqaring.</p>
                </div>
                <Link
                    href="/upload"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100"
                >
                    <Users size={18} />
                    Yuklash sahifasiga o&apos;tish
                </Link>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <div className="col-span-2 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Mavjud menejerlar</h2>
                        <span className="text-sm text-gray-500">{managers.length} ta</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 text-gray-600">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Yuklanmoqda...
                        </div>
                    ) : managers.length === 0 ? (
                        <p className="text-sm text-gray-600">Hozircha menejer yo&apos;q. Yangi menejer qo&apos;shing.</p>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {managers.map((manager) => (
                                <div key={manager.id} className="py-3">
                                    {editingId === manager.id ? (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                            <button
                                                onClick={() => handleUpdate(manager.id)}
                                                disabled={saving}
                                                className="inline-flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                Saqlash
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setEditingName('');
                                                }}
                                                className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                            >
                                                <X className="h-4 w-4" />
                                                Bekor qilish
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">{manager.name}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => startEdit(manager)}
                                                        className="text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(manager.id)}
                                                        disabled={deletingId === manager.id}
                                                        className="text-red-600 hover:text-red-800 px-2 py-1 rounded disabled:opacity-60"
                                                    >
                                                        {deletingId === manager.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            {manager.hours_assigned !== undefined && (
                                                <div className="grid grid-cols-3 gap-4 mt-2 pt-2 border-t border-gray-100">
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Soatlar ajratilgan</p>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {Number(manager.hours_assigned || 0).toFixed(1)}h
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Ishlatilgan</p>
                                                        <p className={`text-sm font-medium ${manager.hours_used !== undefined && manager.hours_assigned !== undefined
                                                            ? Number(manager.hours_used) >= Number(manager.hours_assigned)
                                                                ? 'text-red-600'
                                                                : Number(manager.hours_used) >= Number(manager.hours_assigned) * 0.8
                                                                    ? 'text-yellow-600'
                                                                    : 'text-gray-900'
                                                            : 'text-gray-900'
                                                            }`}>
                                                            {manager.hours_used !== undefined ? Number(manager.hours_used).toFixed(1) : '0.0'}h
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 mb-1">Qolgan</p>
                                                        <p className={`text-sm font-medium ${manager.hours_remaining !== undefined
                                                            ? Number(manager.hours_remaining) <= 0
                                                                ? 'text-red-600'
                                                                : Number(manager.hours_remaining) <= Number(manager.hours_assigned || 0) * 0.2
                                                                    ? 'text-yellow-600'
                                                                    : 'text-green-600'
                                                            : 'text-gray-900'
                                                            }`}>
                                                            {manager.hours_remaining !== undefined ? Number(manager.hours_remaining).toFixed(1) : '0.0'}h
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Yangi menejer qo&apos;shish</h3>
                        <p className="text-sm text-gray-600">Tarifdagi limitlar bo&apos;yicha menejer yarating.</p>
                    </div>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Menejer ismi</label>
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Masalan: Ali Valiyev"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving || (limitInfo ? !limitInfo.allowed : false)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Menejer qo&apos;shish
                        </button>
                        {limitInfo && !limitInfo.allowed && (
                            <p className="text-sm text-red-600">
                                {limitInfo.message || 'Menejer limiti to\'lgan.'}
                            </p>
                        )}
                    </form>

                    <div className="border-t border-gray-200 pt-3 text-sm text-gray-700">
                        <div className="flex items-center justify-between">
                            <span>Joriy menejerlar</span>
                            <span className="font-semibold">{limitInfo ? limitInfo.current : '--'}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <span>Chegara</span>
                            <span className="font-semibold">
                                {limitInfo
                                    ? limitInfo.unlimited
                                        ? 'Cheksiz'
                                        : limitInfo.max ?? '--'
                                    : '--'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

