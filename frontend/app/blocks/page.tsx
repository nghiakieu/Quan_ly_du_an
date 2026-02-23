"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBlocks, type Block } from '@/lib/api';
import { Search, Filter } from 'lucide-react';

export default function BlocksPage() {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [filteredBlocks, setFilteredBlocks] = useState<Block[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        fetchBlocks();
    }, []);

    useEffect(() => {
        filterBlocks();
    }, [blocks, searchTerm, statusFilter]);

    const fetchBlocks = async () => {
        try {
            setLoading(true);
            const data = await getBlocks({ limit: 1000 });
            setBlocks(data);
            setFilteredBlocks(data);
        } catch (error) {
            console.error('Error fetching blocks:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterBlocks = () => {
        let filtered = blocks;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(block =>
                block.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                block.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                block.pier?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(block => block.status === statusFilter);
        }

        setFilteredBlocks(filtered);
        setCurrentPage(1); // Reset to first page when filtering
    };

    // Pagination
    const totalPages = Math.ceil(filteredBlocks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentBlocks = filteredBlocks.slice(startIndex, endIndex);

    const getStatusBadge = (status: number) => {
        const styles = {
            0: 'bg-red-100 text-red-800',
            1: 'bg-amber-100 text-amber-800',
            2: 'bg-green-100 text-green-800',
        };
        const labels = { 0: 'Chưa', 1: 'Đang', 2: 'Xong' };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Danh Sách Công Việc</h1>
                    <p className="text-gray-600 mt-2">Quản lý và theo dõi tiến độ chi tiết</p>
                </div>

                {/* Filters */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Tìm Kiếm & Lọc</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo mã, loại hạng mục, trụ..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Status Filter */}
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                                >
                                    <option value="all">Tất cả trạng thái</option>
                                    <option value="0">Chưa bắt đầu</option>
                                    <option value="1">Đang thực hiện</option>
                                    <option value="2">Hoàn thành</option>
                                </select>
                            </div>

                            {/* Results count */}
                            <div className="flex items-center text-sm text-gray-600">
                                Tìm thấy <span className="font-semibold mx-1">{filteredBlocks.length}</span> kết quả
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Danh Sách Hạng Mục</CardTitle>
                        <CardDescription>
                            Trang {currentPage} / {totalPages || 1} ({filteredBlocks.length} hạng mục)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {currentBlocks.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500">Không tìm thấy kết quả phù hợp</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mã số</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại hạng mục</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trụ</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhịp</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Khối lượng</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đơn vị</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {currentBlocks.map((block) => (
                                            <tr key={block.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{block.code}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{block.category_name}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{block.pier || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{block.span || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-700 text-right">
                                                    {block.volume?.toFixed(2) || '0.00'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">{block.unit || 'm³'}</td>
                                                <td className="px-4 py-3 text-center">{getStatusBadge(block.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Trang trước
                                </Button>
                                <span className="text-sm text-gray-600">
                                    Trang {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Trang sau
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
