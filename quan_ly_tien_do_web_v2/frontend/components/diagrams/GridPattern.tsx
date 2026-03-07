import React from 'react';

interface GridPatternProps {
    gridSize?: number;
    strokeColor?: string;
    show?: boolean;
}

export default function GridPattern({
    gridSize = 20,
    strokeColor = '#e5e7eb',
    show = true,
}: GridPatternProps) {
    if (!show) return null;

    return (
        <>
            <defs>
                <pattern
                    id="grid-pattern"
                    width={gridSize}
                    height={gridSize}
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="0.5"
                    />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" opacity="0.5" />
        </>
    );
}
