"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface User {
    id: number;
    email: string;
    username: string;
    role: string;
    is_active: boolean;
}

export default function AdminUsersPage() {
    const { user, isAuthenticated } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Simple client-side protection
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (user && user.role !== 'admin' && user.role !== 'editor') {
            router.push('/');
            return;
        }

        fetchUsers();
    }, [isAuthenticated, user, router]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users/');
            setUsers(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Lỗi khi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: number) => {
        try {
            await api.put(`/users/${userId}/approve`);
            // Refresh list after approval
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Lỗi khi phê duyệt');
        }
    };

    const handleDelete = async (userId: number) => {
        if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
        try {
            await api.delete(`/users/${userId}`);
            // Refresh list
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Lỗi khi xóa');
        }
    };

    const handleRoleChange = async (userId: number, newRole: string) => {
        try {
            await api.put(`/users/${userId}/role?role=${newRole}`);
            // Refresh list after role update
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Lỗi cập nhật vai trò');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold text-gray-900">Quản lý Người dùng</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Danh sách tất cả người dùng trong hệ thống. Admin có thể phê duyệt tài khoản mới.
                    </p>
                </div>
            </div>

            <div className="mt-8 flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">ID</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tài khoản</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vai trò</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Trạng thái</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Hành động</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{u.id}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.username}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{u.email}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {user?.role === 'admin' && u.id !== user.id ? (
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                        className="mt-1 block w-full py-1 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                    >
                                                        <option value="viewer">Viewer</option>
                                                        <option value="editor">Editor</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                ) : (
                                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'editor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                        {u.role}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {u.is_active ? (
                                                    <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">Hoạt động</span>
                                                ) : (
                                                    <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">Chờ duyệt</span>
                                                )}
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-3">
                                                {!u.is_active && user?.role === 'admin' && (
                                                    <button onClick={() => handleApprove(u.id)} className="text-blue-600 hover:text-blue-900">
                                                        Phê duyệt
                                                    </button>
                                                )}
                                                {user?.role === 'admin' && u.id !== user.id && (
                                                    <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-900 ml-2">
                                                        Xóa
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
