"use client";

import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info, Download } from 'lucide-react';

interface BOQSyncReportProps {
    isOpen: boolean;
    onClose: () => void;
    reportData: {
        boq_count: number;
        blocks_synced: number;
        sync_report: {
            matched: { block_id: string, items_count: number, total_qty: number }[];
            excel_only: string[];
            diagram_only: string[];
            empty: string[];
        };
        boq_warnings: string[];
    } | null;
}

export default function BOQSyncReport({ isOpen, onClose, reportData }: BOQSyncReportProps) {
    if (!isOpen || !reportData) return null;

    const downloadLog = () => {
        const { sync_report, boq_warnings } = reportData;
        let logContent = `BÁO CÁO ĐỒNG BỘ BOQ CÔNG TRÌNH\n`;
        logContent += `================================\n\n`;
        logContent += `Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n`;

        logContent += `1. THÀNH CÔNG (${sync_report.matched.length} blocks)\n`;
        logContent += `--------------------------------\n`;
        if (sync_report.matched.length === 0) logContent += `(Không có)\n`;
        sync_report.matched.forEach(m => {
            logContent += `- Block ID: ${m.block_id} | Gán: ${m.items_count} hạng mục | Tổng KL: ${m.total_qty}\n`;
        });
        logContent += `\n`;

        logContent += `2. CẢNH BÁO: CÓ TRONG EXCEL NHƯNG KHÔNG CÓ TRÊN BẢN VẼ (${sync_report.excel_only.length} blocks)\n`;
        logContent += `--------------------------------\n`;
        if (sync_report.excel_only.length === 0) logContent += `(Không có)\n`;
        sync_report.excel_only.forEach(id => {
            logContent += `- Block ID: ${id}\n`;
        });
        logContent += `\n`;

        logContent += `3. CẢNH BÁO: CÓ TRÊN BẢN VẼ NHƯNG KHÔNG CÓ TRONG EXCEL (${sync_report.diagram_only.length} blocks)\n`;
        logContent += `--------------------------------\n`;
        if (sync_report.diagram_only.length === 0) logContent += `(Không có)\n`;
        sync_report.diagram_only.forEach(id => {
            logContent += `- Block ID: ${id}\n`;
        });
        logContent += `\n`;

        logContent += `4. THÔNG TIN: BLOCK TRONG EXCEL KHÔNG CÓ KHỐI LƯỢNG (${sync_report.empty.length} blocks)\n`;
        logContent += `--------------------------------\n`;
        if (sync_report.empty.length === 0) logContent += `(Không có)\n`;
        sync_report.empty.forEach(id => {
            logContent += `- Block ID: ${id}\n`;
        });
        logContent += `\n`;

        logContent += `5. LỖI DỮ LIỆU GỐC (${boq_warnings.length} lỗi)\n`;
        logContent += `--------------------------------\n`;
        if (boq_warnings.length === 0) logContent += `(Không có)\n`;
        boq_warnings.forEach(w => {
            logContent += `- ${w}\n`;
        });

        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `boq_sync_log_${Date.now()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const { sync_report, boq_warnings } = reportData;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50/80 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Info className="h-6 w-6 text-blue-600" />
                            Báo cáo kết quả đồng bộ BOQ
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-xl transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                            <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                                <CheckCircle2 className="h-5 w-5" /> Thành công
                            </div>
                            <div className="text-2xl font-bold text-green-800">{sync_report.matched.length}</div>
                            <div className="text-xs text-green-600">Blocks đã được gán khối lượng</div>
                        </div>
                        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                            <div className="flex items-center gap-2 text-yellow-700 font-semibold mb-1">
                                <AlertTriangle className="h-5 w-5" /> Chỉ có ở Excel
                            </div>
                            <div className="text-2xl font-bold text-yellow-800">{sync_report.excel_only.length}</div>
                            <div className="text-xs text-yellow-600">ID có cột nhưng ko có hình</div>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                            <div className="flex items-center gap-2 text-orange-700 font-semibold mb-1">
                                <AlertTriangle className="h-5 w-5" /> Chỉ có trên bản vẽ
                            </div>
                            <div className="text-2xl font-bold text-orange-800">{sync_report.diagram_only.length}</div>
                            <div className="text-xs text-orange-600">ID có hình nhưng ko có cột excel</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1">
                                <Info className="h-5 w-5" /> Trống
                            </div>
                            <div className="text-2xl font-bold text-gray-800">{sync_report.empty.length}</div>
                            <div className="text-xs text-gray-600">Blocks không có dữ liệu KL</div>
                        </div>
                    </div>

                    {/* Master BOQ Warnings */}
                    {boq_warnings.length > 0 && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                            <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-5 w-5" /> Cảnh báo: Lệch mã hạng mục BOQ Dự án
                            </h4>
                            <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                                {boq_warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    )}

                    {/* Detailed Lists */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Column 1 */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    Block đã gán thành công ({sync_report.matched.length})
                                </h4>
                                <div className="bg-white border rounded-xl max-h-[250px] overflow-y-auto">
                                    {sync_report.matched.length > 0 ? (
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="p-2 border-b">Block ID</th>
                                                    <th className="p-2 border-b text-center">Số hạng mục</th>
                                                    <th className="p-2 border-b text-right">Tổng khối lượng</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sync_report.matched.map((m, i) => (
                                                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                                                        <td className="p-2 font-mono text-blue-600 font-medium">{m.block_id}</td>
                                                        <td className="p-2 text-center">{m.items_count}</td>
                                                        <td className="p-2 text-right">{m.total_qty.toLocaleString('en-US')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-gray-500">Không có dữ liệu</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                    Excel có - Bản vẽ không có ({sync_report.excel_only.length})
                                </h4>
                                <div className="bg-white border rounded-xl max-h-[150px] overflow-y-auto p-2">
                                    {sync_report.excel_only.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {sync_report.excel_only.map((id, i) => (
                                                <span key={i} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded font-mono text-xs border border-yellow-200">{id}</span>
                                            ))}
                                        </div>
                                    ) : <div className="text-center text-sm text-gray-500 p-2">Tất cả đều khớp hoàn hảo</div>}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                    Bản vẽ có - Excel không có ({sync_report.diagram_only.length})
                                </h4>
                                <div className="bg-white border rounded-xl max-h-[150px] overflow-y-auto p-2">
                                    {sync_report.diagram_only.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {sync_report.diagram_only.map((id, i) => (
                                                <span key={i} className="px-2 py-1 bg-orange-100 text-orange-800 rounded font-mono text-xs border border-orange-200">{id}</span>
                                            ))}
                                        </div>
                                    ) : <div className="text-center text-sm text-gray-500 p-2">Mọi block trên bản vẽ đều có dữ liệu Excel</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={downloadLog}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" /> Tải Log File (.txt)
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
