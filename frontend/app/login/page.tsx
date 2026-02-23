"use client";

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const router = useRouter();

    const API_URL = typeof window !== 'undefined'
        ? `http://${window.location.hostname}:8002/api/v1`
        : 'http://localhost:8002/api/v1';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isLogin) {
                // Handle Login
                const formData = new URLSearchParams();
                formData.append('username', username);
                formData.append('password', password);

                const res = await fetch(`${API_URL}/auth/login/access-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString(),
                });

                if (res.ok) {
                    const data = await res.json();
                    login(data.access_token);
                    router.push('/'); // Redirect to dashboard
                } else {
                    const errData = await res.json();
                    setError(errData.detail || 'Đăng nhập thất bại.');
                }
            } else {
                // Handle Register
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        username,
                        password,
                        role: "viewer"
                    }),
                });

                if (res.ok) {
                    setSuccess('Đăng ký thành công! Vui lòng chờ Admin phê duyệt tài khoản.');
                    // Switch back to login view after successful registration, but keep messages
                    setIsLogin(true);
                    setPassword('');
                } else {
                    const errData = await res.json();
                    setError(errData.detail || 'Đăng ký thất bại.');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối đến máy chủ.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    {isLogin ? 'Đăng nhập hệ thống' : 'Đăng ký tài khoản'}
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Quản lý Tiến độ Công trình V2
                </p>
                <div className="mt-4 flex justify-center space-x-4">
                    <button
                        onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${isLogin ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Đăng nhập
                    </button>
                    <button
                        onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${!isLogin ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Đăng ký
                    </button>
                </div>
            </div>

            <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Tài khoản
                            </label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Mật khẩu
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm font-medium bg-red-50 p-2 rounded-md">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="text-green-600 text-sm font-medium bg-green-50 p-2 rounded-md">
                                {success}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
