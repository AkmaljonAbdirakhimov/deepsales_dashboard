"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { BarChart3, Upload, MessageSquare, CheckSquare, Building2, LogOut, Users, KeyRound, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import ConfirmModal from './ConfirmModal';

export default function Layout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout, isSuperAdmin } = useAuth();
    const router = useRouter();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Don't show layout on login page
    if (pathname === '/login') {
        return <>{children}</>;
    }

    const companyNavItems = [
        { name: 'Yuklash', href: '/upload', icon: Upload },
        { name: 'Menejerlar', href: '/managers', icon: Users },
        { name: 'Statistikalar', href: '/stats', icon: BarChart3 },
        { name: 'Audiolar', href: '/audios', icon: MessageSquare },
        { name: "Me'zonlar", href: '/criteria', icon: CheckSquare },
    ];

    const adminNavItems = [
        { name: 'Companies', href: '/admin/companies', icon: Building2 },
        { name: 'Pricing', href: '/admin/pricing', icon: DollarSign },
    ];

    const navItems = isSuperAdmin ? adminNavItems : companyNavItems;

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <ProtectedRoute>
            <div className="flex h-screen bg-gray-50">
                {/* Sidebar */}
                <aside className={clsx(
                    "bg-white border-r border-gray-200 hidden md:flex flex-col transition-all duration-300 ease-in-out relative",
                    isSidebarCollapsed ? "w-20" : "w-64"
                )}>
                    <div className={clsx(
                        "border-b border-gray-200 transition-all duration-300",
                        isSidebarCollapsed ? "p-4" : "p-6"
                    )}>
                        {!isSidebarCollapsed && (
                            <>
                                <h1 className="text-2xl font-bold text-indigo-600">DeepSales</h1>
                                {user && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        {isSuperAdmin ? 'Super Admin' : user.companyName || 'Company'}
                                    </p>
                                )}
                            </>
                        )}
                        {isSidebarCollapsed && (
                            <h1 className="text-xl font-bold text-indigo-600 text-center">DS</h1>
                        )}
                    </div>
                    <nav className={clsx(
                        "flex-1 transition-all duration-300",
                        isSidebarCollapsed ? "p-2" : "p-4"
                    )}>
                        <div className={clsx(
                            "space-y-2",
                            isSidebarCollapsed ? "space-y-3" : ""
                        )}>
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={clsx(
                                            'flex items-center rounded-lg text-sm font-medium transition-colors group relative',
                                            isSidebarCollapsed
                                                ? 'justify-center px-3 py-3'
                                                : 'gap-3 px-4 py-3',
                                            isActive
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        )}
                                        title={isSidebarCollapsed ? item.name : undefined}
                                    >
                                        <Icon size={20} />
                                        {!isSidebarCollapsed && (
                                            <span>{item.name}</span>
                                        )}
                                        {isSidebarCollapsed && (
                                            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                                {item.name}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                    <div className={clsx(
                        "border-t border-gray-200 transition-all duration-300",
                        isSidebarCollapsed ? "p-2" : "p-4"
                    )}>
                        {!isSidebarCollapsed && (
                            <div className="px-4 py-2 text-sm text-gray-600 mb-2">
                                {user?.username}
                            </div>
                        )}
                        <Link
                            href="/change-password"
                            className={clsx(
                                'flex items-center rounded-lg text-sm font-medium transition-colors mb-2 group relative',
                                isSidebarCollapsed
                                    ? 'justify-center px-3 py-2'
                                    : 'gap-3 px-4 py-2',
                                pathname === '/change-password'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-gray-700 hover:bg-gray-100'
                            )}
                            title={isSidebarCollapsed ? "Change Password" : undefined}
                        >
                            <KeyRound size={20} />
                            {!isSidebarCollapsed && <span>Change Password</span>}
                            {isSidebarCollapsed && (
                                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    Change Password
                                </span>
                            )}
                        </Link>
                        <button
                            onClick={handleLogout}
                            className={clsx(
                                "w-full flex items-center rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors group relative",
                                isSidebarCollapsed ? "justify-center px-3 py-2" : "gap-3 px-4 py-2"
                            )}
                            title={isSidebarCollapsed ? "Logout" : undefined}
                        >
                            <LogOut size={20} />
                            {!isSidebarCollapsed && <span>Logout</span>}
                            {isSidebarCollapsed && (
                                <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    Logout
                                </span>
                            )}
                        </button>
                    </div>
                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors z-10"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isSidebarCollapsed ? (
                            <ChevronRight size={16} className="text-gray-600" />
                        ) : (
                            <ChevronLeft size={16} className="text-gray-600" />
                        )}
                    </button>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    <header className="bg-white border-b border-gray-200 p-4 md:hidden flex items-center justify-between">
                        <h1 className="text-xl font-bold text-indigo-600">DeepSales</h1>
                        {user && (
                            <button
                                onClick={handleLogout}
                                className="p-2 text-gray-600 hover:text-gray-900"
                            >
                                <LogOut size={20} />
                            </button>
                        )}
                    </header>
                    <div className="p-8">
                        {children}
                    </div>
                </main>
                <ConfirmModal
                    isOpen={showLogoutConfirm}
                    onClose={() => setShowLogoutConfirm(false)}
                    onConfirm={confirmLogout}
                    title="Chiqishni tasdiqlash"
                    message="Haqiqatan ham tizimdan chiqmoqchimisiz?"
                    confirmText="Ha, chiqish"
                    cancelText="Bekor qilish"
                    type="warning"
                />
            </div>
        </ProtectedRoute>
    );
}

