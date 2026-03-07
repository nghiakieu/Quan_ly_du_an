import React, { useRef } from 'react';
import * as XLSX from 'xlsx';

export interface BOQItem {
    id: string; // Cột 1: ID
    order: number; // Cột 2: TT
    name: string; // Cột 3: Tên công việc
    unit: string; // Cột 4: Đơn vị
    designQty: number; // Cột 5: Khối lượng thiết kế
    actualQty: number; // Cột 6: Khối lượng thực hiện
    planQty: number; // Cột 7: Khối lượng kế hoạch
    unitPrice: number; // Cột 8: Đơn giá
    contractAmount: number; // Cột 9: Giá trị hợp đồng
    actualAmount: number; // Cột 10: Giá trị thực hiện
    planAmount: number; // Cột 11: Giá trị kế hoạch
}

interface BOQUploaderProps {
    onDataLoaded: (data: BOQItem[]) => void;
}

export default function BOQUploader({ onDataLoaded }: BOQUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const arrayBuffer = evt.target?.result;
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];

            // Convert to JSON array of arrays (header: 1) to manually map columns
            const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

            // Skip header (Assuming row 0 is header)
            const dataRows = rawData.slice(1);

            const boqItems: BOQItem[] = dataRows
                .filter(row => row[0]) // Filter empty ID rows
                .map(row => ({
                    id: String(row[0] || ''),
                    order: Number(row[1]) || 0,
                    name: String(row[2] || ''),
                    unit: String(row[3] || ''),
                    designQty: Number(row[4]) || 0,
                    actualQty: Number(row[5]) || 0,
                    planQty: Number(row[6]) || 0,
                    unitPrice: Number(row[7]) || 0,
                    contractAmount: (Number(row[4]) || 0) * (Number(row[7]) || 0), // Calc: DesignQty * UnitPrice
                    actualAmount: Number(row[9]) || 0,
                    planAmount: Number(row[10]) || 0,
                }));

            console.log("Parsed BOQ Data:", boqItems);
            onDataLoaded(boqItems);
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="w-full">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls"
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-semibold flex items-center justify-center gap-1"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                </svg>
                Update BOQ
            </button>
        </div>
    );
}
