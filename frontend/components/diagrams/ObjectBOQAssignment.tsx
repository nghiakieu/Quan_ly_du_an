import React, { useState, useEffect } from 'react';
import { BOQItem } from './BOQUploader';

interface ObjectBOQAssignmentProps {
    objectName: string;
    masterBoq: BOQItem[];
    initialData?: { [boqId: string]: number };
    onSave: (data: { [boqId: string]: number }) => void;
    onClose: () => void;
}

interface AssignedRow {
    id: string;
    order: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    isValid: boolean;
    error?: string;
}

export default function ObjectBOQAssignment({
    objectName,
    masterBoq,
    initialData = {},
    onSave,
    onClose
}: ObjectBOQAssignmentProps) {
    const [rows, setRows] = useState<AssignedRow[]>([]);
    const [pasteArea, setPasteArea] = useState('');

    // Load initial data
    useEffect(() => {
        if (Object.keys(initialData).length > 0) {
            const initialRows: AssignedRow[] = Object.entries(initialData).map(([id, qty]) => {
                const masterItem = masterBoq.find(m => m.id === id);
                return {
                    id,
                    order: masterItem ? String(masterItem.order) : '?',
                    name: masterItem ? masterItem.name : 'Unknown Item',
                    unit: masterItem ? masterItem.unit : '?',
                    quantity: qty,
                    unitPrice: masterItem ? masterItem.unitPrice : 0,
                    amount: (masterItem ? masterItem.unitPrice : 0) * qty,
                    isValid: !!masterItem,
                    error: masterItem ? undefined : 'ID not found in Master BOQ'
                };
            });
            setRows(initialRows);
        }
    }, [initialData, masterBoq]);

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        // Prevent default paste if we want to handle it manually (optional, but let's just use onChange or processing button)
        // Let's rely on a "Process" button to avoid double processing or complex textarea logic
    };

    const processPaste = () => {
        if (!pasteArea.trim()) return;

        const lines = pasteArea.trim().split('\n');
        const newRows: AssignedRow[] = [];

        lines.forEach(line => {
            const cols = line.split('\t');
            if (cols.length < 5) return; // Skip invalid lines

            const id = cols[0].trim();

            // Fix parsing for mismatched locals (VN vs EN)
            // If "1.234,56" (VN) -> remove points, swap comma to dot
            // If "1,234.56" (EN) -> remove commas
            // Heuristic: If comma appears AFTER the last dot, or comma exists but no dot -> assume VN style decimal
            let qtyStr = cols[4].trim();
            let quantity = 0;

            if (qtyStr) {
                // Check if it looks like VN format: contains comma, and if dots exist, comma is after or dots are used for thousands
                // E.g. "0,5" or "1.000,5"
                const hasComma = qtyStr.includes(',');
                const hasDot = qtyStr.includes('.');

                if (hasComma && (!hasDot || qtyStr.lastIndexOf(',') > qtyStr.lastIndexOf('.'))) {
                    // VN Format: "1.000,5" or "0,5"
                    // Remove thousands separator (.) and replace decimal (,) with (.)
                    const normalized = qtyStr.replace(/\./g, '').replace(/,/g, '.');
                    quantity = parseFloat(normalized);
                } else {
                    // EN Format: "1,000.5" or "0.5" or "1000"
                    // Remove thousands separator (,) 
                    const normalized = qtyStr.replace(/,/g, '');
                    quantity = parseFloat(normalized);
                }
            }

            if (isNaN(quantity)) quantity = 0;

            const masterItem = masterBoq.find(m => m.id === id);

            newRows.push({
                id,
                order: cols[1]?.trim() || '',
                name: cols[2]?.trim() || '',
                unit: cols[3]?.trim() || '',
                quantity,
                unitPrice: masterItem ? masterItem.unitPrice : 0,
                amount: (masterItem ? masterItem.unitPrice : 0) * quantity,
                isValid: !!masterItem,
                error: masterItem ? undefined : 'ID not found in Master BOQ (Prices will be 0)'
            });
        });

        setRows(newRows);
        setPasteArea('');
    };

    const handleDeleteRow = (index: number) => {
        setRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const dataToSave: { [id: string]: number } = {};
        rows.forEach(row => {
            if (row.id) dataToSave[row.id] = row.quantity;
        });
        onSave(dataToSave);
        onClose();
    };

    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h3 className="text-lg font-bold text-gray-800">
                        Gãn dữ liệu thi công: <span className="text-blue-600">{objectName}</span>
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-2xl font-bold">&times;</button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
                    {/* Paste Area */}
                    <div className="flex-shrink-0">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Paste Excel Data (Cột: ID | TT | Tên | ĐVT | Khối lượng thiết kế)
                        </label>
                        <div className="flex gap-2">
                            <textarea
                                className="flex-1 border rounded p-2 text-xs font-mono h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Paste dữ liệu từ Excel vào đây..."
                                value={pasteArea}
                                onChange={(e) => setPasteArea(e.target.value)}
                                onPaste={handlePaste}
                            />
                            <button
                                onClick={processPaste}
                                className="px-4 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex flex-col items-center justify-center"
                            >
                                <span>⬇️</span>
                                <span>Thêm</span>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto border rounded">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="p-2 border">ID</th>
                                    <th className="p-2 border w-10">TT</th>
                                    <th className="p-2 border">Tên hạng mục</th>
                                    <th className="p-2 border w-12 text-center">ĐVT</th>
                                    <th className="p-2 border text-right">Khối lượng</th>
                                    <th className="p-2 border text-right">Đơn giá (Master)</th>
                                    <th className="p-2 border text-right">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                                            Chưa có dữ liệu. Hãy paste từ Excel để thêm vào.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row, idx) => (
                                        <tr key={idx} className={`hover:bg-gray-50 ${!row.isValid ? 'bg-red-50' : ''}`}>
                                            <td className="p-2 border font-mono font-medium text-blue-700" title={row.error}>
                                                {row.id}
                                                {!row.isValid && <span className="text-red-500 ml-1">⚠️</span>}
                                            </td>
                                            <td className="p-2 border text-center">{row.order}</td>
                                            <td className="p-2 border">{row.name}</td>
                                            <td className="p-2 border text-center">{row.unit}</td>
                                            <td className="p-2 border text-right font-bold">{row.quantity.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                            <td className="p-2 border text-right text-gray-600">{row.unitPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                            <td className="p-2 border text-right font-semibold text-green-700">{Math.round(row.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Totals */}
                    <div className="flex-shrink-0 pt-2 border-t flex justify-end items-center gap-4 text-sm">
                        <div className="text-gray-600">
                            Số hạng mục: <span className="font-bold text-black">{rows.length}</span>
                        </div>
                        <div className="text-gray-800 text-lg">
                            Tổng giá trị: <span className="font-bold text-green-600">{Math.round(totalAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} VNĐ</span>
                        </div>
                        <div className="flex gap-2 ml-4">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border rounded hover:bg-gray-100 font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow"
                            >
                                Lưu Dữ Liệu
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
