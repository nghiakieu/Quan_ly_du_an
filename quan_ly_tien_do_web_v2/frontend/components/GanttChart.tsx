"use client";

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { BarChart3 } from 'lucide-react';

interface GanttTask {
    id: number;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
    todo: '#94a3b8',
    in_progress: '#3b82f6',
    done: '#22c55e',
};

const STATUS_LABELS: Record<string, string> = {
    todo: 'Cần làm',
    in_progress: 'Đang làm',
    done: 'Xong',
};

export default function GanttChart({ projectId }: { projectId: number | string }) {
    const [tasks, setTasks] = useState<GanttTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/projects/${projectId}/tasks`)
            .then(res => setTasks(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [projectId]);

    // Calculate timeline span
    const { startDate, endDate, totalDays, dayWidth } = useMemo(() => {
        if (tasks.length === 0) {
            const now = new Date();
            const start = new Date(now);
            start.setDate(start.getDate() - 3);
            const end = new Date(now);
            end.setDate(end.getDate() + 14);
            return { startDate: start, endDate: end, totalDays: 17, dayWidth: 40 };
        }
        const dates = tasks.flatMap(t => [new Date(t.created_at), new Date(t.updated_at)]);
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        // Add padding
        minDate.setDate(minDate.getDate() - 2);
        maxDate.setDate(maxDate.getDate() + 7);
        const days = Math.max(Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)), 7);
        return { startDate: minDate, endDate: maxDate, totalDays: days, dayWidth: 40 };
    }, [tasks]);

    // Generate day labels
    const dayLabels = useMemo(() => {
        const labels = [];
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            labels.push(d);
        }
        return labels;
    }, [startDate, totalDays]);

    const getBarPosition = (task: GanttTask) => {
        const created = new Date(task.created_at);
        const updated = new Date(task.updated_at);
        const startOffset = Math.max(0, (created.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const duration = Math.max(1, (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return { left: startOffset * dayWidth, width: Math.max(duration * dayWidth, dayWidth) };
    };

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <BarChart3 className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Biểu đồ Gantt</h3>
                </div>
                <p className="text-xs text-gray-400">Thêm công việc trong Bảng Kanban để xem biểu đồ tiến độ</p>
            </div>
        );
    }

    const todayOffset = Math.max(0, (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Biểu đồ Gantt</h3>
                    <div className="flex items-center gap-3 ml-4">
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <span key={key} className="flex items-center gap-1 text-[10px] text-gray-500">
                                <span className="w-2 h-2 rounded-sm" style={{ background: STATUS_COLORS[key] }} />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div style={{ minWidth: totalDays * dayWidth + 200 }}>
                    {/* Header - Days */}
                    <div className="flex border-b border-gray-100">
                        <div className="w-[200px] flex-shrink-0 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 border-r">
                            Công việc
                        </div>
                        <div className="flex relative">
                            {dayLabels.map((d, i) => {
                                const isToday = d.toDateString() === new Date().toDateString();
                                const isSunday = d.getDay() === 0;
                                return (
                                    <div
                                        key={i}
                                        className={`text-center border-r border-gray-50 py-2 ${isToday ? 'bg-blue-50' : isSunday ? 'bg-red-50/30' : ''}`}
                                        style={{ width: dayWidth }}
                                    >
                                        <div className={`text-[10px] ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                            {d.getDate()}/{d.getMonth() + 1}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Task rows */}
                    {tasks.map((task) => {
                        const { left, width } = getBarPosition(task);
                        const color = STATUS_COLORS[task.status] || '#94a3b8';
                        return (
                            <div key={task.id} className="flex border-b border-gray-50 hover:bg-gray-50/50 group">
                                <div className="w-[200px] flex-shrink-0 px-3 py-2.5 border-r border-gray-100">
                                    <p className="text-xs font-medium text-gray-800 truncate" title={task.title}>
                                        {task.title}
                                    </p>
                                </div>
                                <div className="flex-1 relative py-2" style={{ height: 36 }}>
                                    {/* Today line */}
                                    <div
                                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                                        style={{ left: todayOffset * dayWidth }}
                                    />
                                    {/* Task bar */}
                                    <div
                                        className="absolute top-1.5 h-5 rounded-md transition-all group-hover:shadow-md"
                                        style={{
                                            left,
                                            width,
                                            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                                        }}
                                    >
                                        <div className="h-full flex items-center px-1.5">
                                            <span className="text-[9px] text-white font-medium truncate">
                                                {task.title}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
