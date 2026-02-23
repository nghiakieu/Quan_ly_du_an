"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Upload, List, Users } from 'lucide-react';

import { useAuth } from '@/lib/auth';

export default function Navigation() {
    const pathname = usePathname();
    const { isAuthenticated, logout, user } = useAuth();

    const navItems = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/diagram', label: 'Sơ Đồ', icon: LayoutDashboard },
        { href: '/upload', label: 'Upload', icon: Upload },
        { href: '/blocks', label: 'Danh sách', icon: List },
        { href: '/admin/users', label: 'Người dùng', icon: Users },
    ];

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
                            <h1 className="text-xl font-bold text-blue-600">Quản Lý Dự Án</h1>
                        </div>

                        {/* Navigation Links */}
                        <div className="hidden md:ml-8 md:flex md:space-x-4">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;

                                // Hide Upload button if not authenticated
                                if (item.href === '/upload' && !isAuthenticated) return null;

                                // Hide Admin Users button if not admin
                                if (item.href === '/admin/users' && (!user || (user.role !== 'admin' && user.role !== 'editor'))) return null;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4 mr-2" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right side - specific project name & Auth */}
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="text-sm text-gray-600 whitespace-nowrap hidden sm:inline">Dự án:</span>
                            <input
                                type="text"
                                className="text-sm font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent px-1 transition-colors w-24 sm:w-32 lg:w-48 text-right sm:text-left"
                                defaultValue="Cầu Mẫu"
                                onBlur={(e) => {
                                    localStorage.setItem('currentProjectName', e.target.value);
                                }}
                                ref={(input) => {
                                    if (input && typeof window !== 'undefined') {
                                        input.value = localStorage.getItem('currentProjectName') || 'Cầu Mẫu';
                                    }
                                }}
                            />
                        </div>

                        {/* Auth Button */}
                        <div className="flex items-center">
                            {isAuthenticated ? (
                                <button
                                    onClick={logout}
                                    className="text-sm font-medium text-gray-700 hover:text-red-600 border border-gray-300 rounded px-3 py-1.5 transition-colors"
                                >
                                    Đăng xuất
                                </button>
                            ) : (
                                <Link
                                    href="/login"
                                    className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-1.5 transition-colors"
                                >
                                    Đăng nhập
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            <div className="md:hidden border-t border-gray-200">
                <div className="flex justify-around py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center px-3 py-2 text-xs font-medium rounded-md ${isActive
                                    ? 'text-blue-700'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="h-5 w-5 mb-1" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
