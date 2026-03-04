import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Save, Edit3, Eye, Trash2 } from 'lucide-react';

interface DiagramToolbarProps {
    mode: 'view' | 'edit';
    zoom: number;
    onModeChange: (mode: 'view' | 'edit') => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetView: () => void;
    onSave?: () => void;
    onDelete?: () => void;
    canDelete?: boolean;
}

export default function DiagramToolbar({
    mode,
    zoom,
    onModeChange,
    onZoomIn,
    onZoomOut,
    onResetView,
    onSave,
    onDelete,
    canDelete = false,
}: DiagramToolbarProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm mb-4">
            <div className="flex items-center justify-between">
                {/* Left: Mode toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 mr-2">Chế độ:</span>
                    <Button
                        variant={mode === 'view' ? 'default' : 'outline'}
                        onClick={() => onModeChange('view')}
                        size="sm"
                        className="gap-2"
                    >
                        <Eye className="h-4 w-4" />
                        Xem
                    </Button>
                    <Button
                        variant={mode === 'edit' ? 'default' : 'outline'}
                        onClick={() => onModeChange('edit')}
                        size="sm"
                        className="gap-2"
                    >
                        <Edit3 className="h-4 w-4" />
                        Chỉnh sửa
                    </Button>
                </div>

                {/* Center: Zoom controls */}
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-md">
                    <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8" title="Thu nhỏ">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center select-none">
                        {Math.round(zoom * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8" title="Phóng to">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-gray-300 mx-1" />
                    <Button variant="ghost" size="icon" onClick={onResetView} title="Mặc định" className="h-8 w-8">
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {mode === 'edit' && (
                        <>
                            {onDelete && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={onDelete}
                                    disabled={!canDelete}
                                    title="Xóa đối tượng đang chọn (Delete)"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            {onSave && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={onSave}
                                    className="gap-2"
                                >
                                    <Save className="h-4 w-4" />
                                    Lưu
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Help text */}
            <div className="mt-2 text-xs text-gray-500 flex justify-between px-1 border-t pt-2 mt-2 border-gray-100">
                <span>
                    {mode === 'edit'
                        ? '💡 Kéo thả trụ • Double-click chữ để sửa • Chọn & Delete để xóa'
                        : '💡 Click block xem chi tiết • Scroll để zoom • Giữ chuột giữa để pan'
                    }
                </span>
            </div>
        </div>
    );
}
