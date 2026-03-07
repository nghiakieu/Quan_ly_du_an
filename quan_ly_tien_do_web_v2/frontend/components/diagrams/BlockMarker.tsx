import React from 'react';

interface BlockMarkerProps {
    x: number;
    y: number;
    status: number; // 0: not started, 1: in progress, 2: completed
    code: string;
    categoryName?: string;
    onHover?: (code: string) => void;
    onClick?: (code: string) => void;
}

const STATUS_COLORS = {
    0: '#ef4444', // red - not started
    1: '#f59e0b', // yellow - in progress
    2: '#10b981', // green - completed
};

const STATUS_LABELS = {
    0: 'Chưa bắt đầu',
    1: 'Đang thực hiện',
    2: 'Hoàn thành',
};

export default function BlockMarker({
    x,
    y,
    status,
    code,
    categoryName,
    onHover,
    onClick,
}: BlockMarkerProps) {
    const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS[0];
    const radius = 6;

    return (
        <g
            className="block-marker"
            onMouseEnter={() => onHover?.(code)}
            onClick={() => onClick?.(code)}
            style={{ cursor: 'pointer' }}
        >
            {/* Outer circle for emphasis */}
            <circle
                cx={x}
                cy={y}
                r={radius + 2}
                fill="white"
                stroke={color}
                strokeWidth={1}
            />

            {/* Main status circle */}
            <circle
                cx={x}
                cy={y}
                r={radius}
                fill={color}
                className="transition-all duration-200 hover:scale-110"
            />

            {/* Label */}
            <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                fontSize="10"
                fill="#374151"
                className="font-medium"
            >
                {code}
            </text>
        </g>
    );
}

export { STATUS_COLORS, STATUS_LABELS };
