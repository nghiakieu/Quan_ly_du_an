"use client";

import { useState } from 'react';
import { api } from '@/lib/api';
import { FileDown, Loader2, CheckCircle2, Clock, AlertCircle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

interface ReportData {
    generated_at: string;
    project: {
        id: number;
        name: string;
        description?: string;
        investor?: string;
        total_budget?: number;
        status: string;
        start_date?: string;
        end_date?: string;
    };
    summary: {
        total_blocks: number;
        completed: number;
        in_progress: number;
        not_started: number;
        progress_percent: number;
        total_design_value: number;
        total_actual_value: number;
        diagram_count: number;
    };
    diagrams: Array<{
        id: number;
        name: string;
        boq_items: Array<{
            code: string;
            name: string;
            unit: string;
            design_qty: number;
            actual_qty: number;
            unit_price: number;
            design_amount: number;
            actual_amount: number;
            status: number;
        }>;
        boq_count: number;
    }>;
    tasks: { total: number; todo: number; in_progress: number; done: number };
}

function formatCurrency(amount: number): string {
    if (!amount) return '0';
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)} tỷ`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)} triệu`;
    return amount.toLocaleString('vi-VN');
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

const STATUS_MAP: Record<number, { label: string; icon: typeof CheckCircle2; color: string }> = {
    2: { label: 'Xong', icon: CheckCircle2, color: 'text-green-600' },
    1: { label: 'Đang làm', icon: Clock, color: 'text-blue-600' },
    0: { label: 'Chưa', icon: AlertCircle, color: 'text-gray-400' },
};

export default function ProjectReport({ projectId }: { projectId: number | string }) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showReport, setShowReport] = useState(false);

    const fetchAndShow = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/projects/${projectId}/report`);
            setReport(res.data);
            setShowReport(true);
        } catch {
            toast.error("Không thể tải dữ liệu báo cáo");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <button
                onClick={showReport ? handlePrint : fetchAndShow}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <FileDown className="h-4 w-4" />
                )}
                {showReport ? 'In / Xuất PDF' : 'Tạo Báo cáo'}
            </button>

            {showReport && report && (
                <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden print:border-0">
                    {/* Report Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-5 print:bg-indigo-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold">{report.project.name}</h2>
                                {report.project.investor && (
                                    <p className="text-indigo-200 text-sm mt-1">CĐT: {report.project.investor}</p>
                                )}
                            </div>
                            <div className="text-right text-xs text-indigo-200">
                                <div>Ngày tạo: {formatDate(report.generated_at)}</div>
                                {report.project.total_budget && (
                                    <div className="font-bold text-white text-sm mt-1">
                                        Tổng vốn: {formatCurrency(report.project.total_budget)} VNĐ
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-white space-y-5">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-700">{report.summary.progress_percent}%</div>
                                <div className="text-xs text-green-600">Tiến độ tổng</div>
                            </div>
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-700">{report.summary.completed}</div>
                                <div className="text-xs text-blue-600">Hạng mục xong</div>
                            </div>
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-orange-700">{report.summary.in_progress}</div>
                                <div className="text-xs text-orange-600">Đang thi công</div>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-gray-700">{report.summary.diagram_count}</div>
                                <div className="text-xs text-gray-500">Công trình</div>
                            </div>
                        </div>

                        {/* Value Summary */}
                        {report.summary.total_design_value > 0 && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Giá trị Thực hiện</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Kế hoạch:</span>
                                        <span className="ml-2 font-semibold">{formatCurrency(report.summary.total_design_value)} VNĐ</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Thực tế:</span>
                                        <span className="ml-2 font-semibold text-blue-700">{formatCurrency(report.summary.total_actual_value)} VNĐ</span>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded-full mt-3 overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full"
                                        style={{ width: `${Math.min(100, report.summary.progress_percent)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Tasks */}
                        {report.tasks.total > 0 && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <ListChecks className="h-4 w-4" />
                                    Công việc ({report.tasks.total})
                                </h4>
                                <div className="flex gap-3 text-xs">
                                    <span className="bg-gray-100 px-2 py-1 rounded">Cần làm: {report.tasks.todo}</span>
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Đang làm: {report.tasks.in_progress}</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Xong: {report.tasks.done}</span>
                                </div>
                            </div>
                        )}

                        {/* Diagrams BOQ */}
                        {report.diagrams.map((diagram) => (
                            diagram.boq_count > 0 && (
                                <div key={diagram.id}>
                                    <h4 className="text-sm font-semibold text-gray-800 mb-2 border-b pb-1">
                                        📐 {diagram.name}
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="text-left px-2 py-1.5 border border-gray-200">Hạng mục</th>
                                                    <th className="text-center px-2 py-1.5 border border-gray-200">ĐVT</th>
                                                    <th className="text-right px-2 py-1.5 border border-gray-200">KL TK</th>
                                                    <th className="text-right px-2 py-1.5 border border-gray-200">KL Thực tế</th>
                                                    <th className="text-right px-2 py-1.5 border border-gray-200">Giá TT (VNĐ)</th>
                                                    <th className="text-center px-2 py-1.5 border border-gray-200">TT</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {diagram.boq_items.map((item, idx) => {
                                                    const statusInfo = STATUS_MAP[item.status] || STATUS_MAP[0];
                                                    const Icon = statusInfo.icon;
                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-2 py-1.5 border border-gray-100">{item.name || item.code}</td>
                                                            <td className="px-2 py-1.5 border border-gray-100 text-center">{item.unit}</td>
                                                            <td className="px-2 py-1.5 border border-gray-100 text-right">{item.design_qty?.toLocaleString()}</td>
                                                            <td className="px-2 py-1.5 border border-gray-100 text-right">{item.actual_qty?.toLocaleString()}</td>
                                                            <td className="px-2 py-1.5 border border-gray-100 text-right">{formatCurrency(item.actual_amount)}</td>
                                                            <td className="px-2 py-1.5 border border-gray-100 text-center">
                                                                <Icon className={`h-3.5 w-3.5 inline ${statusInfo.color}`} />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
