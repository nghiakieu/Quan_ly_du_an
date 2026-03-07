"use client";

import React, { useEffect, useState } from 'react';
import { getProjectBOQ } from '@/lib/api';
import { X, Calculator, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ProjectBOQViewerProps {
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
}

export default function ProjectBOQViewer({ projectId, isOpen, onClose }: ProjectBOQViewerProps) {
    const [boqData, setBoqData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchBOQ();
        }
    }, [isOpen, projectId]);

    const fetchBOQ = async () => {
        try {
            setLoading(true);
            const res = await getProjectBOQ(projectId);
            setBoqData(res.boq_data || []);
        } catch (error) {
            console.error('Fetch BOQ Error:', error);
            toast.error('Lỗi khi tải dữ liệu BOQ dự án');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const totalContract = boqData.reduce((sum, item) => sum + (item.contractAmount || 0), 0);

    const handleExportBOQ = () => {
        if (boqData.length === 0) return;

        const header = [
            'Mã hiệu', 'TT', 'Nội dung công việc', 'ĐVT',
            'KL Thiết kế', 'KL Thực hiện', 'KL Kế hoạch',
            'Đơn giá (VND)', 'Giá trị Hợp đồng (VND)', 'GT Thực hiện (VND)', 'GT Kế hoạch (VND)'
        ];

        const rows = boqData.map((item, idx) => [
            item.id,
            item.order || idx + 1,
            item.name,
            item.unit,
            item.designQty || 0,
            item.actualQty || 0,
            item.planQty || 0,
            item.unitPrice || 0,
            item.contractAmount || 0,
            item.actualAmount || 0,
            item.planAmount || 0
        ]);

        const totalDesignQty = boqData.reduce((sum, item) => sum + (item.designQty || 0), 0);
        const totalActualQty = boqData.reduce((sum, item) => sum + (item.actualQty || 0), 0);
        const totalPlanQty = boqData.reduce((sum, item) => sum + (item.planQty || 0), 0);
        const totalActualAmount = boqData.reduce((sum, item) => sum + (item.actualAmount || 0), 0);
        const totalPlanAmount = boqData.reduce((sum, item) => sum + (item.planAmount || 0), 0);

        rows.push([
            'TỔNG CỘNG', '', '', '',
            totalDesignQty,
            totalActualQty,
            totalPlanQty,
            '',
            totalContract,
            totalActualAmount,
            totalPlanAmount
        ]);

        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master BOQ");
        XLSX.writeFile(wb, `Project_${projectId}_Master_BOQ.xlsx`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50/80 rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Calculator className="h-6 w-6 text-blue-600" />
                            Bảng Tổng Hợp Khối Lượng (BOQ) - Toàn Dự Án
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Tổng cộng: <span className="font-bold text-gray-700">{boqData.length}</span> hạng mục |
                            Tổng giá trị: <span className="font-bold text-green-700 ml-1">{totalContract.toLocaleString('en-US')} VND</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {boqData.length > 0 && (
                            <button
                                onClick={handleExportBOQ}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                            >
                                <Download className="h-4 w-4" />
                                Export Excel
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-xl transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden bg-white p-4 flex flex-col">
                    {loading ? (
                        <div className="h-full flex items-center justify-center flex-col gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <p className="text-gray-500">Đang tải dữ liệu BOQ...</p>
                        </div>
                    ) : boqData.length === 0 ? (
                        <div className="h-full flex items-center justify-center flex-col text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Calculator className="h-8 w-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-medium text-gray-900 mb-1">Chưa có dữ liệu BOQ</h4>
                            <p className="text-gray-500">Vui lòng sử dụng chức năng Update BOQ để tải file Excel lên.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto bg-white relative border border-gray-200 rounded-xl shadow-sm">
                            <table className="w-full text-xs border-collapse border border-gray-300">
                                <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="border p-2 bg-gray-100 text-left w-24">Mã hiệu</th>
                                        <th className="border p-2 bg-gray-100 text-center w-12">TT</th>
                                        <th className="border p-2 bg-gray-100">Nội dung công việc</th>
                                        <th className="border p-2 bg-gray-100 text-center w-16">ĐVT</th>
                                        <th className="border p-2 bg-gray-100 text-right w-24">KL Tkế</th>
                                        <th className="border p-2 bg-gray-100 text-right w-24">KL THiện</th>
                                        <th className="border p-2 bg-gray-100 text-right w-24">KL KHoạch</th>
                                        <th className="border p-2 bg-gray-100 text-right w-28">Đơn giá</th>
                                        <th className="border p-2 bg-gray-100 text-right w-32">Giá trị HĐ</th>
                                        <th className="border p-2 bg-gray-100 text-right w-32">GT THiện</th>
                                        <th className="border p-2 bg-gray-100 text-right w-32">GT KHoạch</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {boqData.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="border p-1 font-mono text-gray-500">{item.id}</td>
                                            <td className="border p-1 text-center font-semibold text-gray-600">{item.order || index + 1}</td>
                                            <td className="border p-1">{item.name}</td>
                                            <td className="border p-1 text-center">{item.unit}</td>
                                            <td className="border p-1 text-right">
                                                {item.designQty?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 0}
                                            </td>
                                            <td className="border p-1 text-right font-semibold text-blue-600">
                                                {item.actualQty?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 0}
                                            </td>
                                            <td className="border p-1 text-right text-orange-600">
                                                {item.planQty?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || 0}
                                            </td>
                                            <td className="border p-1 text-right">
                                                {item.unitPrice?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0}
                                            </td>
                                            <td className="border p-1 text-right text-black">
                                                {item.contractAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0}
                                            </td>
                                            <td className="border p-1 text-right font-bold text-green-600">
                                                {item.actualAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0}
                                            </td>
                                            <td className="border p-1 text-right text-orange-600 font-bold">
                                                {item.planAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Final Total Row */}
                                    <tr className="bg-gray-200 font-bold sticky bottom-0 z-20 shadow-[0_-1px_2px_rgba(0,0,0,0.1)]">
                                        <td colSpan={4} className="border p-2 text-center bg-gray-200 uppercase">Tổng Cộng</td>
                                        <td className="border p-2 text-right bg-gray-200">
                                            {boqData.reduce((sum, item) => sum + (item.designQty || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border p-2 text-right text-blue-700 bg-gray-200">
                                            {boqData.reduce((sum, item) => sum + (item.actualQty || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border p-2 text-right text-orange-700 bg-gray-200">
                                            {boqData.reduce((sum, item) => sum + (item.planQty || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border p-2 text-right bg-gray-200"></td>
                                        <td className="border p-2 text-right text-black bg-gray-200">
                                            {totalContract.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border p-2 text-right text-green-700 bg-gray-200">
                                            {boqData.reduce((sum, item) => sum + (item.actualAmount || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border p-2 text-right text-orange-700 bg-gray-200">
                                            {boqData.reduce((sum, item) => sum + (item.planAmount || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
