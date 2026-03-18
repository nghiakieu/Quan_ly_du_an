"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Copy, ClipboardPaste, AlertCircle, Check, Save } from 'lucide-react';
import { toast } from 'sonner';

import { BoxObject } from './SimpleDragTest';

interface EditableBoxObject extends BoxObject {
    tempIdx: number;
}

interface WorkItemListModalProps {
    isOpen: boolean;
    onClose: () => void;
    objects: BoxObject[];
    onUpdateObjects: (updatedObjects: BoxObject[]) => void;
}

export default function WorkItemListModal({ isOpen, onClose, objects, onUpdateObjects }: WorkItemListModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [localObjects, setLocalObjects] = useState<EditableBoxObject[]>([]);
    const [isDirty, setIsDirty] = useState(false);

    // Initialize local state when modal opens
    useEffect(() => {
        if (isOpen) {
            // Sort by current ID to have a logical base order
            const sorted = [...objects].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            setLocalObjects(sorted.map((obj, i) => ({ ...obj, tempIdx: i + 1 })));
            setIsDirty(false);
        }
    }, [isOpen, objects]);

    const filteredObjects = useMemo(() => {
        return localObjects.filter(obj => 
            obj.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            obj.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [localObjects, searchTerm]);

    const handleCopyAll = () => {
        const header = "STT\tID Đối tượng\tTên (Label)\tTrạng thái\tSố lượng BOQ\n";
        const rows = localObjects.map(obj => {
            const boqCount = Object.keys(obj.boqIds || {}).length;
            return `${obj.tempIdx}\t${obj.id}\t${obj.label}\t${obj.status || 'not_started'}\t${boqCount}`;
        }).join('\n');
        
        navigator.clipboard.writeText(header + rows);
        toast.success("Đã copy dữ liệu vào Clipboard (bao gồm cột STT)");
    };

    const handlePasteFromExcel = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                toast.error("Clipboard trống");
                return;
            }

            const lines = text.trim().split(/\r?\n/);
            if (lines.length === 0) return;

            const rows = lines.map(line => line.split('\t'));
            
            // Skip header if present
            let startIdx = 0;
            if (rows[0][0].toLowerCase().includes('stt') || rows[0][0].toLowerCase().includes('id')) {
                startIdx = 1;
            }

            const newLocalObjects = [...localObjects];
            let updateCount = 0;

            for (let i = startIdx; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 1) continue;

                // Column 0: STT, Column 1: ID, Column 2: Label
                const sttValue = parseInt(row[0].trim());
                if (isNaN(sttValue)) continue;

                const targetIdx = newLocalObjects.findIndex(o => o.tempIdx === sttValue);
                if (targetIdx !== -1) {
                    const newId = row[1]?.trim();
                    const newLabel = row[2]?.trim();
                    
                    if (newId !== undefined || newLabel !== undefined) {
                        newLocalObjects[targetIdx] = { 
                            ...newLocalObjects[targetIdx],
                            id: newId || newLocalObjects[targetIdx].id,
                            label: newLabel || newLocalObjects[targetIdx].label
                        };
                        updateCount++;
                    }
                }
            }

            if (updateCount > 0) {
                setLocalObjects(newLocalObjects);
                setIsDirty(true);
                toast.success(`Đã cập nhật dữ liệu cho ${updateCount} dòng dựa trên STT`);
            } else {
                toast.warning("Không tìm thấy STT nào khớp để cập nhật");
            }
        } catch (err) {
            toast.error("Không thể đọc Clipboard.");
        }
    };

    const handleUpdateField = (tempIdx: number, field: 'id' | 'label', value: string) => {
        setLocalObjects(prev => prev.map(obj => 
            obj.tempIdx === tempIdx ? { ...obj, [field]: value } : obj
        ));
        setIsDirty(true);
    };

    const handleSave = () => {
        // Strip out tempIdx before saving back to parent
        const updatedObjects = localObjects.map(({ tempIdx, ...rest }) => rest as BoxObject);
        onUpdateObjects(updatedObjects);
        setIsDirty(false);
        toast.success("Đã lưu thay đổi vào sơ đồ");
        onClose();
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
                            <h2 className="text-xl font-bold text-gray-900">Danh mục Công việc (Nâng cao)</h2>
                            <p className="text-xs text-gray-500">Sửa trực tiếp hoặc Paste từ Excel theo cột STT</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDirty && (
                            <button 
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-bold shadow-lg shadow-green-200"
                            >
                                <Save className="h-4 w-4" />
                                Lưu thay đổi
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all">
                            <X className="h-6 w-6" />
                        </button>
                    </div>
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
                            title="Copy STT, ID, Label"
                        >
                            <Copy className="h-4 w-4" />
                            Copy sang Excel
                        </button>
                        <button
                            onClick={handlePasteFromExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-lg shadow-blue-200 active:scale-95"
                            title="Paste dữ liệu từ Excel (Cột 1: STT, Cột 2: ID, Cột 3: Label)"
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
                                    filteredObjects.map((obj) => (
                                        <tr key={obj.tempIdx} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-gray-400 font-bold">{obj.tempIdx}</td>
                                            <td className="px-6 py-2">
                                                <input 
                                                    type="text"
                                                    value={obj.id}
                                                    onChange={(e) => handleUpdateField(obj.tempIdx, 'id', e.target.value)}
                                                    className="w-full bg-transparent px-2 py-1 rounded font-mono text-xs border border-transparent hover:border-blue-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-blue-700"
                                                />
                                            </td>
                                            <td className="px-6 py-2">
                                                <input 
                                                    type="text"
                                                    value={obj.label}
                                                    onChange={(e) => handleUpdateField(obj.tempIdx, 'label', e.target.value)}
                                                    className="w-full bg-transparent px-2 py-1 rounded text-sm font-semibold border border-transparent hover:border-blue-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-gray-900"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-gray-400 capitalize">{obj.type}</span>
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
                                                <span className="text-sm font-medium text-gray-400">
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
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>Paste từ Excel 3 cột: [Cột 1: STT] [Cột 2: ID Mới] [Cột 3: Tên Label Mới]</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-amber-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Cột STT là mốc cố định kể cả khi lọc. Bạn nên Copy ra Excel trước để lấy file mẫu.</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-medium text-gray-400 uppercase tracking-widest mb-1">
                            {objects.length} Objects
                        </div>
                        {isDirty && <span className="text-amber-500 font-bold animate-pulse">Bạn có thay đổi chưa lưu!</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
