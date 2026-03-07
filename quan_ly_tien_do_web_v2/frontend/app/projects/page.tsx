"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FolderGit2, Plus, Calendar, Trash2, ChevronRight, Building2, Banknote, Clock, FileText } from 'lucide-react';
import { getProjects, createProject, deleteProject, getProjectProgress, type Project, type ProjectProgress } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export default function ProjectsDashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [progressMap, setProgressMap] = useState<Record<number, ProjectProgress>>({});
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        investor: '',
        total_budget: '',
        start_date: '',
        end_date: '',
    });
    const { isAuthenticated, user } = useAuth();

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const data = await getProjects();
            setProjects(data);
            // Fetch progress for all projects
            const progressResults: Record<number, ProjectProgress> = {};
            for (const p of data) {
                try {
                    const prog = await getProjectProgress(p.id);
                    progressResults[p.id] = prog;
                } catch {
                    // No progress data available
                }
            }
            setProgressMap(progressResults);
        } catch (err) {
            console.error("Failed to fetch projects", err);
            toast.error("Không thể tải danh sách dự án");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createProject({
                name: formData.name,
                description: formData.description || undefined,
                investor: formData.investor || undefined,
                total_budget: formData.total_budget ? parseFloat(formData.total_budget) : undefined,
                start_date: formData.start_date || undefined,
                end_date: formData.end_date || undefined,
                status: 'planning',
            });
            toast.success("Tạo dự án thành công!");
            setFormData({ name: '', description: '', investor: '', total_budget: '', start_date: '', end_date: '' });
            setShowForm(false);
            fetchProjects();
        } catch (err) {
            toast.error("Không thể tạo dự án. Vui lòng đăng nhập.");
        }
    };

    const handleDeleteProject = async (id: number, name: string) => {
        if (!confirm(`Bạn chắc chắn muốn xóa dự án "${name}"? Tất cả công trình liên quan sẽ bị xóa.`)) return;
        try {
            await deleteProject(id);
            toast.success("Đã xóa dự án!");
            fetchProjects();
        } catch (err) {
            toast.error("Không thể xóa dự án.");
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'active': return { label: 'Đang thi công', color: 'bg-green-100 text-green-700 border-green-200' };
            case 'on_hold': return { label: 'Tạm dừng', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
            case 'completed': return { label: 'Hoàn thành', color: 'bg-blue-100 text-blue-700 border-blue-200' };
            default: return { label: 'Đang lập kế hoạch', color: 'bg-gray-100 text-gray-600 border-gray-200' };
        }
    };

    const formatCurrency = (amount: number) => {
        if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)} tỷ`;
        if (amount >= 1e6) return `${(amount / 1e6).toFixed(0)} triệu`;
        return amount.toLocaleString('vi-VN') + ' đ';
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">Đang tải dự án...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Danh mục Dự án</h1>
                    <p className="text-sm text-gray-500 mt-1">{projects.length} dự án</p>
                </div>
                {isAuthenticated && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus className="h-4 w-4" />
                        Tạo Dự án mới
                    </button>
                )}
            </div>

            {/* Create Form */}
            {showForm && (
                <Card className="mb-8 border-blue-200 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                        <CardTitle className="text-lg text-blue-800">Tạo Dự án mới</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên Dự án *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        placeholder="Ví dụ: Gói XL1 - Mở rộng cao tốc Cam Lộ La Sơn"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        rows={2}
                                        placeholder="Mô tả ngắn gọn về dự án"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đầu tư</label>
                                    <input
                                        type="text"
                                        value={formData.investor}
                                        onChange={(e) => setFormData({ ...formData, investor: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        placeholder="Tên chủ đầu tư"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tổng vốn đầu tư (VNĐ)</label>
                                    <input
                                        type="number"
                                        value={formData.total_budget}
                                        onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày khởi công</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày dự kiến hoàn thành</label>
                                    <input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Tạo Dự án
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Projects Grid */}
            {projects.length === 0 ? (
                <div className="text-center py-20">
                    <FolderGit2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có dự án nào</h3>
                    <p className="text-sm text-gray-500">Bấm "Tạo Dự án mới" để bắt đầu</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => {
                        const statusConfig = getStatusConfig(project.status);
                        const progress = progressMap[project.id];
                        const progressPercent = progress?.progress_percent ?? 0;
                        const diagramCount = project.diagrams?.length ?? 0;

                        return (
                            <Link key={project.id} href={`/projects/${project.id}`}>
                                <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-gray-200 hover:border-blue-300 h-full flex flex-col">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-base font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                                    {project.name}
                                                </CardTitle>
                                                {project.description && (
                                                    <CardDescription className="mt-1 text-xs line-clamp-2">
                                                        {project.description}
                                                    </CardDescription>
                                                )}
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ml-2 ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="flex-1 pb-3">
                                        {/* Progress Bar */}
                                        <div className="mb-4">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-xs font-medium text-gray-500">Tiến độ</span>
                                                <span className="text-sm font-bold text-blue-700">{progressPercent}%</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                                    style={{
                                                        width: `${progressPercent}%`,
                                                        background: progressPercent >= 80
                                                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                                            : progressPercent >= 40
                                                                ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                                                : 'linear-gradient(90deg, #f59e0b, #d97706)'
                                                    }}
                                                />
                                            </div>
                                            {progress && (
                                                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                                        {progress.completed} xong
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                                        {progress.in_progress} đang
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                                        {progress.not_started} chưa
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Project Info */}
                                        <div className="space-y-1.5 text-xs text-gray-500">
                                            {project.investor && (
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span className="truncate">{project.investor}</span>
                                                </div>
                                            )}
                                            {project.total_budget && (
                                                <div className="flex items-center gap-2">
                                                    <Banknote className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span>{formatCurrency(project.total_budget)}</span>
                                                </div>
                                            )}
                                            {(project.start_date || project.end_date) && (
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                                    <span>
                                                        {project.start_date ? formatDate(project.start_date) : '?'} → {project.end_date ? formatDate(project.end_date) : '?'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span>{diagramCount} công trình</span>
                                            </div>
                                        </div>
                                    </CardContent>

                                    <CardFooter className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-xs text-gray-400">
                                            Cập nhật: {formatDate(project.updated_at)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {isAuthenticated && (user?.role === 'admin' || user?.role === 'editor') && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDeleteProject(project.id, project.name);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Xóa dự án"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </CardFooter>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
