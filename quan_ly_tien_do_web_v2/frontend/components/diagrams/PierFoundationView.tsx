import React from 'react';

interface Block {
    code: string;
    category_name: string;
    status: number;
}

interface PileConfig {
    x: number;
    y: number;
    r: number;
    blockCode: string;
}

interface PierFoundationViewProps {
    pierId: string;
    label: string;
    x: number;
    piles: PileConfig[];
    blocks: Block[];
    onBlockClick?: (code: string) => void;
}

const STATUS_COLORS = {
    0: '#ef4444', // red
    1: '#f59e0b', // yellow
    2: '#10b981', // green
};

export default function PierFoundationView({
    pierId,
    label,
    x,
    piles,
    blocks,
    onBlockClick,
}: PierFoundationViewProps) {
    // Get status for a pile based on its block code
    const getStatus = (blockCode: string) => {
        const block = blocks.find((b) => b.code === blockCode || b.code.startsWith(blockCode));
        return block?.status ?? 0;
    };

    return (
        <g className="pier-foundation">
            {/* Pier label */}
            <text
                x={x + 60}
                y={10}
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill="#1f2937"
            >
                {label}
            </text>

            {/* Foundation outline box */}
            <rect
                x={x}
                y={15}
                width={120}
                height={70}
                fill="none"
                stroke="#9ca3af"
                strokeWidth={1}
                strokeDasharray="4 2"
                rx={4}
            />

            {/* Piles (circles) */}
            {piles.map((pile, index) => {
                const status = getStatus(pile.blockCode);
                const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS];

                return (
                    <g
                        key={index}
                        onClick={() => onBlockClick?.(pile.blockCode)}
                        style={{ cursor: 'pointer' }}
                    >
                        {/* Pile circle */}
                        <circle
                            cx={x + pile.x}
                            cy={20 + pile.y}
                            r={pile.r}
                            fill={color}
                            stroke="#374151"
                            strokeWidth={1.5}
                            className="transition-all hover:stroke-width-2"
                        />

                        {/* Pile center dot */}
                        <circle
                            cx={x + pile.x}
                            cy={20 + pile.y}
                            r={2}
                            fill="#1f2937"
                        />
                    </g>
                );
            })}

            {/* Foundation label */}
            <text
                x={x + 60}
                y={100}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
            >
                Cọc khoan nhồi
            </text>
        </g>
    );
}
