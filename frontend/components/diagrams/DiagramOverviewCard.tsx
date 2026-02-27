import React, { useState } from 'react';
import { Eye, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getDiagram, DiagramSummary, Diagram } from '@/lib/api';
import StatusPieChart from './StatusPieChart';
import ProgressDashboard from './ProgressDashboard';

interface DiagramOverviewCardProps {
    diagram: DiagramSummary;
    onOpen: () => void;
    onDelete: () => void;
    isAuthenticated: boolean;
    canEdit: boolean;
}

export default function DiagramOverviewCard({ diagram, onOpen, onDelete, isAuthenticated, canEdit }: DiagramOverviewCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [fullDiagram, setFullDiagram] = useState<Diagram | null>(null);
    const [loading, setLoading] = useState(false);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const handleExpandToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Ngăn việc bấm mở diagram full
        if (!isExpanded && !fullDiagram) {
            setLoading(true);
            try {
                const data = await getDiagram(diagram.id);
                setFullDiagram(data);
            } catch (err) {
                console.error("Lỗi khi tải dữ liệu công trình", err);
            }
            setLoading(false);
        }
        setIsExpanded(!isExpanded);
    };

    const renderCharts = () => {
        if (loading) {
            return <div className="p-4 text-center text-xs text-gray-500">Đang tải biểu đồ...</div>;
        }

        if (!fullDiagram) {
            return <div className="p-4 text-center text-xs text-red-500">Không tải được dữ liệu</div>;
        }

        const objects = JSON.parse(fullDiagram.objects || '[]');
        const boqData = JSON.parse(fullDiagram.boq_data || '[]');

        let totalContract = 0;
        let completed = 0;
        let planned = 0;

        boqData.forEach((item: any) => {
            totalContract += item.contractAmount || 0;
        });

        objects.forEach((obj: any) => {
            if (obj.boqIds) {
                Object.entries(obj.boqIds).forEach(([boqId, qty]) => {
                    const item = boqData.find((i: any) => i.id === boqId);
                    if (item) {
                        if (obj.status === 'completed') {
                            completed += (qty as number) * (item.unitPrice || 0);
                        } else if (obj.status === 'planned') {
                            planned += (qty as number) * (item.unitPrice || 0);
                        }
                    }
                });
            }
        });

        const assignedTotal = completed + planned;
        const remaining = Math.max(0, totalContract - assignedTotal);

        const chartData = [
            { label: 'Thực hiện', value: completed, color: '#10b981' },
            { label: 'Kế hoạch', value: planned, color: '#f59e0b' },
            { label: 'Còn lại', value: remaining, color: 'transparent', isEmpty: true }
        ];

        return (
            <div className="flex flex-col gap-4 mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                <div className="w-full">
                    <StatusPieChart data={chartData} total={totalContract} unit={boqData.length > 0 ? 'VND' : ''} />
                </div>
                <div className="w-full">
                    <ProgressDashboard objects={objects} />
                </div>
            </div>
        );
    };

    return (
        <div
            className={`group bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col`}
            onClick={onOpen}
        >
            <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                            {diagram.name}
                        </h3>
                        {diagram.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{diagram.description}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-1 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={handleExpandToggle}
                            className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                            title="Xem biểu đồ tiến độ"
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {isAuthenticated && canEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Xóa công trình"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {isExpanded && renderCharts()}

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
        </div>
    );
}
