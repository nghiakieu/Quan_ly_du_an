import React from 'react';

interface ChartSlice {
    label: string;
    value: number;
    color: string;
    isEmpty?: boolean;
}

interface StatusPieChartProps {
    data: ChartSlice[];
    total: number;
    unit?: string;
}

const StatusPieChart: React.FC<StatusPieChartProps> = ({ data, total, unit = 'VND' }) => {
    // 1. Calculate Per-Slice Angles
    // Total is 100% (2 * PI)
    // We render paths manually

    const getPoint = (percent: number, radius: number = 100) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x * radius, y * radius];
    };

    let cumulativePercent = 0;

    // Filter valid slices
    const activeSlices = data.filter(d => d.value > 0);

    // Formatter
    const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const paths = activeSlices.map((slice, index) => {
        const percent = slice.value / total;

        // Start and end coordinates
        const [startX, startY] = getPoint(cumulativePercent);

        cumulativePercent += percent;

        const [endX, endY] = getPoint(cumulativePercent);

        // Large Arc Flag
        const largeArcFlag = percent > 0.5 ? 1 : 0;

        // Path Command
        // Move to Center (0,0) -> Line to Start -> Arc to End -> Line to Center
        // Note: Coordinates are relative to center 0,0. 
        // We will transform via SVG viewBox.

        const d = [
            `M 0 0`,
            `L ${startX} ${startY}`,
            `A 100 100 0 ${largeArcFlag} 1 ${endX} ${endY}`,
            `Z`
        ].join(' ');

        return { d, slice, percent };
    });

    return (
        <div className="flex flex-col items-center w-full p-2 bg-white rounded shadow-sm border mt-2">
            <h3 className="text-sm font-bold text-gray-700 mb-2 w-full text-center border-b pb-1">
                Biểu đồ giá trị thực hiện
            </h3>

            <div className="relative w-40 h-40 mb-2">
                <svg viewBox="-105 -105 210 210" className="w-full h-full transform -rotate-90">
                    {paths.map((p, i) => (
                        <path
                            key={i}
                            d={p.d}
                            fill={p.slice.isEmpty ? 'transparent' : p.slice.color}
                            stroke="none"
                            className="transition-opacity hover:opacity-80 cursor-default"
                        >
                            <title>{`${p.slice.label}: ${fmt(p.slice.value)} (${(p.percent * 100).toFixed(1)}%)`}</title>
                        </path>
                    ))}
                    {/* Global Outer Border Only */}
                    <circle cx="0" cy="0" r="100" fill="none" stroke="#4b5563" strokeWidth="1" />
                </svg>
            </div>

            {/* Legend */}
            <div className="w-full space-y-1 text-[11px]">
                {data.map((slice, i) => (
                    <div key={i} className="flex justify-between items-center px-1 py-0.5 rounded hover:bg-gray-50">
                        <div className="flex items-center gap-1.5">
                            <div
                                className={`w-2.5 h-2.5 rounded-full border ${slice.isEmpty ? 'border-gray-500 border-solid border' : 'border-transparent'}`}
                                style={{ backgroundColor: slice.isEmpty ? 'transparent' : slice.color }}
                            />
                            <span className="text-gray-600 truncate max-w-[80px]" title={slice.label}>{slice.label}</span>
                        </div>
                        <div className="text-right flex flex-col items-end leading-tight">
                            <span className="font-semibold">{fmt(slice.value)}</span>
                            <span className="text-[9px] text-gray-400">
                                {total > 0 ? `${((slice.value / total) * 100).toFixed(1)}%` : '0%'}
                            </span>
                        </div>
                    </div>
                ))}

                <div className="border-t pt-1 mt-1 flex justify-between items-center font-bold text-gray-800">
                    <span>TOTAL</span>
                    <span>{fmt(total)}</span>
                </div>
            </div>
        </div>
    );
};

export default StatusPieChart;
