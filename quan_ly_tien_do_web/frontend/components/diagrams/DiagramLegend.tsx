import React from 'react';
import { STATUS_COLORS, STATUS_LABELS } from './BlockMarker';

export default function DiagramLegend() {
    const legendItems = [
        { status: 2, color: STATUS_COLORS[2], label: STATUS_LABELS[2] },
        { status: 1, color: STATUS_COLORS[1], label: STATUS_LABELS[1] },
        { status: 0, color: STATUS_COLORS[0], label: STATUS_LABELS[0] },
    ];

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Chú thích</h3>
            <div className="space-y-2">
                {legendItems.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                        <span
                            className="inline-block w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-gray-700">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
