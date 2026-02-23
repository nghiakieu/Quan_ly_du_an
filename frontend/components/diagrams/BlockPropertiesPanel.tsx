import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Block } from '@/lib/api';


interface BlockProperty {
    label: string;
    value: string | number;
    editable?: boolean;
}

interface BlockPropertiesPanelProps {
    block: Block | null;
    onClose: () => void;
    onUpdate?: (blockId: number, updates: Partial<Block>) => void;
}

const STATUS_LABELS = {
    0: 'Chưa bắt đầu',
    1: 'Đang thực hiện',
    2: 'Hoàn thành',
};

const STATUS_COLORS = {
    0: '#ef4444',
    1: '#f59e0b',
    2: '#10b981',
};

export default function BlockPropertiesPanel({
    block,
    onClose,
    onUpdate,
}: BlockPropertiesPanelProps) {
    if (!block) return null;

    const properties: BlockProperty[] = [
        { label: 'Mã hạng mục', value: block.code },
        { label: 'Loại hạng mục', value: block.category_name },
        { label: 'Trụ', value: block.pier || 'N/A' },
        { label: 'Nhịp', value: block.span || 'N/A' },
        { label: 'Đoạn', value: block.segment || 'N/A' },
        { label: 'Khối lượng', value: block.volume !== undefined ? `${block.volume} ${block.unit || ''}` : 'N/A' },
        { label: 'Đơn giá', value: block.unit_price ? `${block.unit_price.toLocaleString()} VNĐ` : 'N/A' },
        { label: 'Tổng giá trị', value: block.total_value ? `${block.total_value.toLocaleString()} VNĐ` : 'N/A' },
        { label: 'Ghi chú', value: block.notes || 'Không có' },
    ];

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto">
            <Card className="h-full border-0 rounded-none">
                <CardHeader className="border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">Thông Tin Block</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">
                                Chi tiết hạng mục công việc
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 w-8 p-0"
                        >
                            ✕
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                    {/* Status indicator */}
                    <div className="p-4 rounded-lg" style={{ backgroundColor: `${STATUS_COLORS[block.status as keyof typeof STATUS_COLORS]}20` }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: STATUS_COLORS[block.status as keyof typeof STATUS_COLORS] }}
                            >
                                <span className="text-white text-lg font-bold">
                                    {block.status === 2 ? '✓' : block.status === 1 ? '◷' : '○'}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600">Trạng thái</p>
                                <p className="font-semibold text-gray-900">
                                    {STATUS_LABELS[block.status as keyof typeof STATUS_LABELS]}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Properties table */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                            Thuộc tính
                        </h3>
                        <div className="space-y-3">
                            {properties.map((prop, index) => (
                                <div
                                    key={index}
                                    className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0"
                                >
                                    <span className="text-sm text-gray-600 w-1/2">
                                        {prop.label}:
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 w-1/2 text-right break-words">
                                        {prop.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Technical info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                            Thông tin kỹ thuật
                        </h3>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Block ID:</span>
                                <span className="font-mono text-gray-900">#{block.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Vị trí:</span>
                                <span className="text-gray-900">
                                    {block.pier || 'N/A'} · {block.span || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-200 space-y-2">
                        <Button variant="outline" className="w-full" disabled>
                            <span className="mr-2">✏️</span>
                            Chỉnh sửa (Sắp có)
                        </Button>
                        <Button variant="outline" className="w-full" disabled>
                            <span className="mr-2">📊</span>
                            Lịch sử thay đổi (Sắp có)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
