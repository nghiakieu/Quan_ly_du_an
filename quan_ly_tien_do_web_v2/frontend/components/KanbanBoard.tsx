"use client";

import { useEffect, useState, useCallback } from 'react';
import { api, type ProjectMember } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Plus, GripVertical, Trash2, User, Flag, Clock } from 'lucide-react';

// Task interface
interface KanbanTask {
    id: number;
    project_id: number;
    title: string;
    description?: string;
    status: string;
    priority: string;
    assigned_to?: number;
    assignee_name?: string;
    order_index: number;
    created_at: string;
    updated_at: string;
}

const COLUMNS = [
    { id: 'todo', label: 'Cần làm', color: 'bg-gray-100 border-gray-300', headerColor: 'text-gray-700', dotColor: 'bg-gray-400' },
    { id: 'in_progress', label: 'Đang thực hiện', color: 'bg-blue-50 border-blue-200', headerColor: 'text-blue-700', dotColor: 'bg-blue-500' },
    { id: 'done', label: 'Hoàn thành', color: 'bg-green-50 border-green-200', headerColor: 'text-green-700', dotColor: 'bg-green-500' },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    high: { label: 'Cao', color: 'text-red-600 bg-red-50' },
    medium: { label: 'TB', color: 'text-yellow-600 bg-yellow-50' },
    low: { label: 'Thấp', color: 'text-gray-500 bg-gray-50' },
};

export default function KanbanBoard({ projectId }: { projectId: number | string }) {
    const [tasks, setTasks] = useState<KanbanTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState('medium');
    const [draggedTask, setDraggedTask] = useState<KanbanTask | null>(null);
    const { isAuthenticated } = useAuth();

    const fetchTasks = useCallback(async () => {
        try {
            const res = await api.get(`/projects/${projectId}/tasks`);
            setTasks(res.data);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const handleAddTask = async (status: string) => {
        if (!newTaskTitle.trim()) return;
        try {
            await api.post(`/projects/${projectId}/tasks`, {
                title: newTaskTitle.trim(),
                status,
                priority: newTaskPriority,
            });
            setNewTaskTitle('');
            setNewTaskPriority('medium');
            setShowAddForm(null);
            fetchTasks();
            toast.success("Đã thêm công việc!");
        } catch {
            toast.error("Không thể thêm. Vui lòng đăng nhập.");
        }
    };

    const handleStatusChange = async (taskId: number, newStatus: string) => {
        try {
            await api.put(`/projects/${projectId}/tasks/${taskId}`, { status: newStatus });
            fetchTasks();
        } catch {
            toast.error("Không thể cập nhật trạng thái");
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!confirm("Xóa công việc này?")) return;
        try {
            await api.delete(`/projects/${projectId}/tasks/${taskId}`);
            fetchTasks();
            toast.success("Đã xóa!");
        } catch {
            toast.error("Không thể xóa");
        }
    };

    // Drag & Drop handlers
    const handleDragStart = (e: React.DragEvent, task: KanbanTask) => {
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        if (!draggedTask || draggedTask.status === targetStatus) {
            setDraggedTask(null);
            return;
        }
        await handleStatusChange(draggedTask.id, targetStatus);
        setDraggedTask(null);
    };

    const getColumnTasks = (status: string) =>
        tasks.filter(t => t.status === status).sort((a, b) => a.order_index - b.order_index);

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                    Bảng công việc ({tasks.length})
                </h3>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-3 gap-0 min-h-[300px]">
                {COLUMNS.map((col) => {
                    const colTasks = getColumnTasks(col.id);
                    return (
                        <div
                            key={col.id}
                            className={`${col.color} border-r last:border-r-0 p-3`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                                    <span className={`text-xs font-bold uppercase tracking-wide ${col.headerColor}`}>
                                        {col.label}
                                    </span>
                                    <span className="text-xs text-gray-400 bg-white/80 rounded-full px-1.5 py-0.5">
                                        {colTasks.length}
                                    </span>
                                </div>
                                {isAuthenticated && (
                                    <button
                                        onClick={() => setShowAddForm(showAddForm === col.id ? null : col.id)}
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-white rounded transition-colors"
                                        title="Thêm công việc"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Add Form */}
                            {showAddForm === col.id && (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-2">
                                    <input
                                        type="text"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask(col.id)}
                                        placeholder="Tên công việc..."
                                        className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none mb-2"
                                        autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={newTaskPriority}
                                            onChange={(e) => setNewTaskPriority(e.target.value)}
                                            className="text-xs px-2 py-1 border rounded bg-white"
                                        >
                                            <option value="high">🔴 Cao</option>
                                            <option value="medium">🟡 TB</option>
                                            <option value="low">⚪ Thấp</option>
                                        </select>
                                        <button
                                            onClick={() => handleAddTask(col.id)}
                                            className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                            Thêm
                                        </button>
                                        <button
                                            onClick={() => { setShowAddForm(null); setNewTaskTitle(''); }}
                                            className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Task Cards */}
                            <div className="space-y-2">
                                {colTasks.map((task) => {
                                    const prioConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                                    return (
                                        <div
                                            key={task.id}
                                            draggable={isAuthenticated}
                                            onDragStart={(e) => handleDragStart(e, task)}
                                            className={`group bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 p-3 transition-all cursor-grab active:cursor-grabbing ${draggedTask?.id === task.id ? 'opacity-40' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <GripVertical className={`h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0 ${isAuthenticated ? '' : 'hidden'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 leading-tight">
                                                        {task.title}
                                                    </p>
                                                    {task.description && (
                                                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${prioConfig.color}`}>
                                                            <Flag className="h-2.5 w-2.5" />
                                                            {prioConfig.label}
                                                        </span>
                                                        {task.assignee_name && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                                                                <User className="h-2.5 w-2.5" />
                                                                {task.assignee_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isAuthenticated && (
                                                    <button
                                                        onClick={() => handleDeleteTask(task.id)}
                                                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
