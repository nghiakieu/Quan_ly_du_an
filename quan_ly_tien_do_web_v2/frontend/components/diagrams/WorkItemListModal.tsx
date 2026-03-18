"use client";

import React, { useState, useMemo } from 'react';
import { X, Search, Copy, ClipboardPaste, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

import { BoxObject } from './SimpleDragTest';

interface WorkItemListModalProps {
    isOpen: boolean;
    onClose: () => void;
    objects: BoxObject[];
    onUpdateObjects: (updatedObjects: BoxObject[]) => void;
}

export default function WorkItemListModal({ isOpen, onClose, objects, onUpdateObjects }: WorkItemListModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [pasteMode, setPasteMode] = useState(false);

    const filteredObjects = useMemo(() => {
        return objects.filter(obj => 
            obj.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            obj.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [objects, searchTerm]);

    const handleCopyAll = () => {
        const header = "ID\tTên (Label)\tTrạng thái\tSố lượng BOQ\n";
        const rows = objects.map(obj => {
            const boqCount = Object.keys(obj.boqIds || {}).length;
            return `${obj.id}\t${obj.label}\t${obj.status || 'not_started'}\t${boqCount}`;
        }).join('\n');
        
        navigator.clipboard.writeText(header + rows);
        toast.success("Đã copy dữ liệu vào Clipboard (có thể dán vào Excel)");
    };

    const handlePasteFromExcel = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                toast.error("Clipboard trống");
                return;
            }

            const lines = text.trim().split(/\r?\n/);
            if (lines.length < 1) return;

            // Simple TSV parser
            // Expected format: ID\tLabel or Label\tID (we'll try to match by Label)
            const rows = lines.map(line => line.split('\t'));
            
            // If the first row looks like a header (contains "id" or "tên"), skip it
            let startIdx = 0;
            if (rows[0][0].toLowerCase().includes('id') || rows[0][1]?.toLowerCase().includes('tên')) {
                startIdx = 1;
            }

            const updatedObjects = [...objects];
            let updateCount = 0;

            for (let i = startIdx; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 2) continue;

                // We'll try to find the object by Label (column 2) and update its ID (column 1)
                // or if it's already there, we might need a more robust matching logic.
                // For now, let's assume Column 1 is ID and Column 2 is Label.
                const newId = row[0].trim();
                const label = row[1].trim();

                const objIndex = updatedObjects.findIndex(o => o.label === label);
                if (objIndex !== -1 && newId) {
                    updatedObjects[objIndex] = { ...updatedObjects[objIndex], id: newId };
                    updateCount++;
                }
            }

            if (updateCount > 0) {
                onUpdateObjects(updatedObjects);
                toast.success(`Đã cập nhật ID cho ${updateCount} đối tượng`);
            } else {
                toast.warning("Không tìm thấy đối tượng nào khớp với Tên (Label)");
            }
        } catch (err) {
            toast.error("Không thể đọc Clipboard. Vui lòng cấp quyền hoặc thử lại.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <ClipboardPaste className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Danh mục Công việc</h2>
                            <p className="text-xs text-gray-500">Quản lý và cập nhật ID hàng loạt cho các đối tượng trong sơ đồ</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo ID hoặc Tên..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyAll}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium shadow-sm active:scale-95"
                        >
                            <Copy className="h-4 w-4" />
                            Copy sang Excel
                        </button>
                        <button
                            onClick={handlePasteFromExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-lg shadow-blue-200 active:scale-95"
                        >
                            <ClipboardPaste className="h-4 w-4" />
                            Paste từ Excel
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto p-4 bg-gray-50/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                                    <th className="px-6 py-4 w-16">STT</th>
                                    <th className="px-6 py-4">ID Đối tượng</th>
                                    <th className="px-6 py-4">Tên (Label)</th>
                                    <th className="px-6 py-4">Loại</th>
                                    <th className="px-6 py-4">Trạng thái</th>
                                    <th className="px-6 py-4 text-right">BOQ Items</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredObjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2 text-gray-400">
                                                <Search className="h-10 w-10 opacity-20" />
                                                <p>Không tìm thấy đối tượng nào</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredObjects.map((obj, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-gray-500 font-medium">{idx + 1}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-xs border border-gray-200 group-hover:bg-white group-hover:border-blue-200 transition-all">
                                                    {obj.id}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{obj.label}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-gray-500 capitalize">{obj.type}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight shadow-sm ${
                                                    obj.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    obj.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {obj.status === 'completed' ? 'Hoàn thành' : 
                                                     obj.status === 'in_progress' ? 'Đang làm' : 'Chưa bắt đầu'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {Object.keys(obj.boqIds || {}).length}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer / Instructions */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>Cần copy 2 cột từ Excel: [Cột 1: ID Mới] [Cột 2: Tên Label]</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span>Mẹo: ID sẽ được khớp dựa trên Tên (Label)</span>
                        </div>
                    </div>
                    <div className="font-medium text-gray-400 uppercase tracking-widest">
                        Total: {objects.length} Objects
                    </div>
                </div>
            </div>
        </div>
    );
}
