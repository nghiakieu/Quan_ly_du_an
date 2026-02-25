"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderGit2, LayoutGrid, Users, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function Navigation() {
    const pathname = usePathname();
    const { isAuthenticated, logout, user } = useAuth();

    const navItems = [
        { href: '/projects', label: 'Danh mục Dự án', icon: FolderGit2 },
        { href: '/diagram', label: 'Sơ đồ Thi công', icon: LayoutGrid },
        { href: '/admin/users', label: 'Người dùng', icon: Users, authOnly: true, adminOnly: true },
    ];

    return (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-14">
                    {/* Left: Logo + Nav */}
                    <div className="flex items-center">
                        <Link href="/projects" className="flex-shrink-0 flex items-center mr-8">
                            <h1 className="text-lg font-bold text-blue-600">Quản lý Dự Án</h1>
                        </Link>

                        <div className="hidden md:flex md:space-x-1">
                            {navItems.map((item) => {
                                // Hide admin-only items
                                if (item.adminOnly && (!user || (user.role !== 'admin' && user.role !== 'editor'))) return null;
                                if (item.authOnly && !isAuthenticated) return null;

                                const Icon = item.icon;
                                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isActive
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4 mr-1.5" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Auth */}
                    <div className="flex items-center">
                        {isAuthenticated ? (
                            <button
                                onClick={logout}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-600 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Đăng xuất
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-1.5 transition-colors"
                            >
                                <LogIn className="h-4 w-4" />
                                Đăng nhập
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            <div className="md:hidden border-t border-gray-100">
                <div className="flex justify-around py-2">
                    {navItems.map((item) => {
                        if (item.adminOnly && (!user || (user.role !== 'admin' && user.role !== 'editor'))) return null;
                        if (item.authOnly && !isAuthenticated) return null;

                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center px-3 py-1.5 text-xs font-medium rounded-md ${isActive
                                    ? 'text-blue-700'
                                    : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="h-5 w-5 mb-0.5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
