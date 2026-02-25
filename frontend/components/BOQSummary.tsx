"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';

interface BOQCategory {
    category: string;
    unit: string;
    design_qty: number;
    actual_qty: number;
    design_amount: number;
    actual_amount: number;
    unit_price: number;
    status_counts: { done: number; in_progress: number; todo: number };
}

interface BOQSummaryData {
    project_id: number;
    project_name: string;
    items: BOQCategory[];
    totals: {
        design_amount: number;
        actual_amount: number;
        variance: number;
        items_count: number;
    };
}

function formatCurrency(val: number): string {
    if (!val) return '0';
    if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    return val.toLocaleString('vi-VN');
}

export default function BOQSummary({ projectId }: { projectId: number | string }) {
    const [data, setData] = useState<BOQSummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/projects/${projectId}/boq-summary`)
            .then(res => setData(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [projectId]);

    if (loading) return null;
    if (!data || data.items.length === 0) return null;

    const { totals } = data;
    const variancePositive = totals.variance >= 0;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Tổng hợp Khối lượng</h3>
                    <span className="text-xs text-gray-400">({data.items.length} hạng mục)</span>
                </div>
            </div>

            {/* Totals summary row */}
            <div className="grid grid-cols-3 gap-0 border-b border-gray-100 text-center">
                <div className="py-3 border-r border-gray-100">
                    <div className="text-xs text-gray-400 mb-0.5">Giá trị KH</div>
                    <div className="text-sm font-bold text-gray-800">{formatCurrency(totals.design_amount)}</div>
                </div>
                <div className="py-3 border-r border-gray-100">
                    <div className="text-xs text-gray-400 mb-0.5">Giá trị TH</div>
                    <div className="text-sm font-bold text-blue-700">{formatCurrency(totals.actual_amount)}</div>
                </div>
                <div className="py-3">
                    <div className="text-xs text-gray-400 mb-0.5">Chênh lệch</div>
                    <div className={`text-sm font-bold flex items-center justify-center gap-1 ${variancePositive ? 'text-green-600' : 'text-red-600'}`}>
                        {variancePositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {formatCurrency(Math.abs(totals.variance))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2 font-medium">Hạng mục</th>
                            <th className="text-center px-3 py-2 font-medium">ĐVT</th>
                            <th className="text-right px-3 py-2 font-medium">KL TK</th>
                            <th className="text-right px-3 py-2 font-medium">KL TH</th>
                            <th className="text-right px-3 py-2 font-medium">GT Kế hoạch</th>
                            <th className="text-right px-3 py-2 font-medium">GT Thực hiện</th>
                            <th className="text-center px-3 py-2 font-medium">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.items.map((item, idx) => {
                            const done = item.status_counts.done;
                            const total = done + item.status_counts.in_progress + item.status_counts.todo;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                            return (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.category}</td>
                                    <td className="px-3 py-2.5 text-center text-gray-500">{item.unit}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-700">{item.design_qty?.toLocaleString()}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-700">{item.actual_qty?.toLocaleString()}</td>
                                    <td className="px-3 py-2.5 text-right text-gray-600">{formatCurrency(item.design_amount)}</td>
                                    <td className="px-3 py-2.5 text-right font-medium text-blue-700">{formatCurrency(item.actual_amount)}</td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 rounded-full"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-gray-500 w-8">{pct}%</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
