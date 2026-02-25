"use client";

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getProject, getProjectProgress, createDiagram, deleteDiagram, type Project, type ProjectProgress, type DiagramSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import SimpleDragTest from '@/components/diagrams/SimpleDragTest';
import ProjectMembers from '@/components/ProjectMembers';
import KanbanBoard from '@/components/KanbanBoard';
import GanttChart from '@/components/GanttChart';
import BOQSummary from '@/components/BOQSummary';
import ProjectReport from '@/components/ProjectReport';
import PresenceCursors from '@/components/PresenceCursors';
import { ArrowLeft, Plus, FileText, Trash2, Eye, Building2, Banknote, Clock, ChevronRight } from 'lucide-react';

export default function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const projectId = unwrappedParams.id;
    const searchParams = useSearchParams();
    const [project, setProject] = useState<Project | null>(null);
    const [progress, setProgress] = useState<ProjectProgress | null>(null);
    const [activeDiagramId, setActiveDiagramId] = useState<number | null>(() => {
        const diagramParam = searchParams.get('diagram');
        return diagramParam ? parseInt(diagramParam) : null;
    });
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newDiagramName, setNewDiagramName] = useState('');
    const [newDiagramDesc, setNewDiagramDesc] = useState('');
    const [loading, setLoading] = useState(true);
    const { isAuthenticated, user } = useAuth();
    const diagramContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchProjectDetail();
    }, [projectId]);

    const fetchProjectDetail = async () => {
        try {
            setLoading(true);
            const data = await getProject(projectId);
            setProject(data);
            // Store globally for Navigation
            if (typeof window !== 'undefined') {
                localStorage.setItem('currentProjectName', data.name);
            }
            // Fetch progress
            try {
                const prog = await getProjectProgress(projectId);
                setProgress(prog);
            } catch { /* No progress data */ }
        } catch (err) {
            console.error("Failed to fetch project detail", err);
            toast.error("Không thể tải thông tin dự án");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDiagram = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDiagramName.trim()) return;
        try {
            await createDiagram({
                name: newDiagramName,
                description: newDiagramDesc || undefined,
                project_id: parseInt(projectId),
                objects: '[]',
                boq_data: '[]',
            });
            toast.success("Tạo công trình thành công!");
            setNewDiagramName('');
            setNewDiagramDesc('');
            setShowCreateForm(false);
            fetchProjectDetail();
        } catch (err) {
            toast.error("Không thể tạo công trình. Vui lòng đăng nhập.");
        }
    };

    const handleDeleteDiagram = async (diagramId: number, diagramName: string) => {
        if (!confirm(`Xóa công trình "${diagramName}"? Dữ liệu sơ đồ sẽ bị mất.`)) return;
        try {
            await deleteDiagram(diagramId);
            toast.success("Đã xóa công trình!");
            if (activeDiagramId === diagramId) {
                setActiveDiagramId(null);
            }
            fetchProjectDetail();
        } catch (err) {
            toast.error("Không thể xóa công trình.");
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatCurrency = (amount?: number) => {
        if (!amount) return '';
        if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)} tỷ VNĐ`;
        if (amount >= 1e6) return `${(amount / 1e6).toFixed(0)} triệu VNĐ`;
        return amount.toLocaleString('vi-VN') + ' VNĐ';
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

    if (!project) {
        return (
            <div className="text-center py-20">
                <p className="text-gray-500">Không tìm thấy dự án</p>
                <Link href="/projects" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                    ← Quay lại danh sách
                </Link>
            </div>
        );
    }

    // If viewing a specific diagram editor
    if (activeDiagramId !== null) {
        return (
            <div className="w-full flex-1 flex flex-col">
                {/* Breadcrumb */}
                <div className="bg-white border-b px-4 py-2 flex items-center gap-2 text-sm">
                    <Link href="/projects" className="text-gray-500 hover:text-blue-600 transition-colors">
                        Dự án
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <button
                        onClick={() => setActiveDiagramId(null)}
                        className="text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        {project.name}
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-900 font-medium">
                        {project.diagrams?.find(d => d.id === activeDiagramId)?.name || 'Sơ đồ'}
                    </span>
                </div>
                <div ref={diagramContainerRef} className="relative flex-1 flex flex-col">
                    <SimpleDragTest projectId={projectId} diagramId={activeDiagramId} />
                    <PresenceCursors
                        diagramId={activeDiagramId}
                        containerRef={diagramContainerRef as React.RefObject<HTMLElement>}
                    />
                </div>
            </div>
        );
    }

    // Project overview with diagram list
    const progressPercent = progress?.progress_percent ?? 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumb + Report Button */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-sm">
                    <Link href="/projects" className="text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Dự án
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-900 font-medium">{project.name}</span>
                </div>
                <ProjectReport projectId={projectId} />
            </div>

            {/* Project Info Header */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                        {project.description && (
                            <p className="text-gray-500 mt-1 text-sm">{project.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                            {project.investor && (
                                <span className="flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {project.investor}
                                </span>
                            )}
                            {project.total_budget && (
                                <span className="flex items-center gap-1.5">
                                    <Banknote className="h-3.5 w-3.5" />
                                    {formatCurrency(project.total_budget)}
                                </span>
                            )}
                            {(project.start_date || project.end_date) && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatDate(project.start_date)} → {formatDate(project.end_date)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Progress Summary */}
                    <div className="w-full lg:w-64 flex-shrink-0">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-gray-500">Tiến độ tổng</span>
                            <span className="text-lg font-bold text-blue-700">{progressPercent}%</span>
                        </div>
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
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
                            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                                <div className="bg-green-50 rounded-lg py-1.5 px-2">
                                    <div className="text-sm font-bold text-green-700">{progress.completed}</div>
                                    <div className="text-xs text-green-600">Xong</div>
                                </div>
                                <div className="bg-blue-50 rounded-lg py-1.5 px-2">
                                    <div className="text-sm font-bold text-blue-700">{progress.in_progress}</div>
                                    <div className="text-xs text-blue-600">Đang</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg py-1.5 px-2">
                                    <div className="text-sm font-bold text-gray-600">{progress.not_started}</div>
                                    <div className="text-xs text-gray-500">Chưa</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Project Members */}
            <div className="mb-6">
                <ProjectMembers projectId={projectId} />
            </div>

            {/* Kanban Board */}
            <div className="mb-6">
                <KanbanBoard projectId={projectId} />
            </div>

            {/* Gantt Chart */}
            <div className="mb-6">
                <GanttChart projectId={projectId} />
            </div>

            {/* BOQ Summary (C4) */}
            <BOQSummary projectId={projectId} />

            {/* Diagrams Section Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Danh sách Công trình</h2>
                    <p className="text-xs text-gray-500">{project.diagrams?.length ?? 0} công trình trong dự án</p>
                </div>
                {isAuthenticated && (
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm Công trình
                    </button>
                )}
            </div>

            {/* Create Diagram Form */}
            {showCreateForm && (
                <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-6">
                    <form onSubmit={handleCreateDiagram} className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <input
                                type="text"
                                required
                                value={newDiagramName}
                                onChange={(e) => setNewDiagramName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                placeholder="Tên công trình (VD: Cầu Thạch Hãn - Km19+950)"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={newDiagramDesc}
                                onChange={(e) => setNewDiagramDesc(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                placeholder="Mô tả (tùy chọn)"
                            />
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                                Tạo
                            </button>
                            <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
                                Hủy
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Diagrams List */}
            {(!project.diagrams || project.diagrams.length === 0) ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-gray-700 mb-1">Chưa có công trình nào</h3>
                    <p className="text-sm text-gray-400">Bấm "Thêm Công trình" để tạo sơ đồ thi công đầu tiên</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {project.diagrams.map((diagram) => (
                        <div
                            key={diagram.id}
                            className="group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 p-5 cursor-pointer flex flex-col"
                            onClick={() => setActiveDiagramId(diagram.id)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                        {diagram.name}
                                    </h3>
                                    {diagram.description && (
                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{diagram.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                    {isAuthenticated && (user?.role === 'admin' || user?.role === 'editor') && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteDiagram(diagram.id, diagram.name);
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                            title="Xóa công trình"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                    {diagram.updated_at ? `Cập nhật: ${formatDate(diagram.updated_at)}` : 'Mới tạo'}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
                                    <Eye className="h-3.5 w-3.5" />
                                    Mở sơ đồ
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
