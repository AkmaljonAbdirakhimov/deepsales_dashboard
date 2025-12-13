"use client";

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning';
    isLoading?: boolean;
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Ha, o\'chirish',
    cancelText = 'Bekor qilish',
    type = 'danger',
    isLoading = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const handleConfirm = async () => {
        const result = onConfirm();
        if (result instanceof Promise) {
            await result;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="fixed inset-0"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
                onClick={isLoading ? () => { } : onClose}
            ></div>
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-full ${type === 'danger' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                            <AlertCircle
                                size={24}
                                className={type === 'danger' ? 'text-red-600' : 'text-yellow-600'}
                            />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    </div>
                    <p className="text-gray-700 mb-6">{message}</p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${type === 'danger'
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-yellow-600 hover:bg-yellow-700'
                                }`}
                        >
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
