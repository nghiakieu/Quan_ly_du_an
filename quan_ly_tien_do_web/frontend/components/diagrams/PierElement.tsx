import React from 'react';
import EditableText from './EditableText';

interface Block {
    code: string;
    category_name: string;
    status: number;
}

interface ComponentBlock {
    height?: number;
    width?: number;
    xOffset?: number;
    blockCode: string;
    label: string;
}

interface PierComponents {
    footing: {
        x: number;
        y: number;
        width: number;
        height: number;
        blockCode: string;
        label: string;
    };
    shaft: {
        x: number;
        y: number;
        width: number;
        blocks: ComponentBlock[];
    };
    cap: {
        x: number;
        y: number;
        blocks: ComponentBlock[];
    };
}

interface PierElementProps {
    id: string;
    label: string;
    x: number;
    components: PierComponents;
    blocks: Block[];
    onBlockClick?: (code: string) => void;
    mode?: 'view' | 'edit';
    onLabelChange?: (type: 'pier' | 'footing' | 'shaft' | 'cap', index: number | null, newLabel: string) => void;
}

const STATUS_COLORS = {
    0: '#ef4444',
    1: '#f59e0b',
    2: '#10b981',
};

export default function PierElement({
    id,
    label,
    x,
    components,
    blocks,
    onBlockClick,
    mode = 'view',
    onLabelChange,
}: PierElementProps) {
    const getBlockStatus = (code: string) => {
        const block = blocks.find((b) => b.code === code);
        return block ? block.status : 0;
    };

    const getStatusColor = (status: number) => {
        return (STATUS_COLORS as any)[status] || '#e5e7eb';
    };

    const handleBlockClick = (e: React.MouseEvent, code: string) => {
        e.stopPropagation();
        if (onBlockClick) onBlockClick(code);
    };

    // Calculate total height for positioning
    const footingHeight = components.footing.height;
    const shaftHeight = components.shaft.blocks.reduce(
        (sum, b) => sum + (b.height || 0),
        0
    );
    const capHeight = components.cap.blocks.reduce(
        (sum, b) => sum + (b.height || 0),
        0
    );

    let currentY = 0;

    return (
        <g className="pier-element" transform={`translate(${x}, 0)`}>
            {/* Pier Label */}
            <EditableText
                x={0}
                y={capHeight + shaftHeight + footingHeight + 40}
                value={label}
                fontSize={16}
                fontWeight="bold"
                anchor="middle"
                editable={mode === 'edit'}
                onSave={(newVal) => onLabelChange?.('pier', null, newVal)}
            />

            {/* Cap (Xà mũ) - Drawn from top down */}
            {components.cap.blocks.map((block, index) => {
                const blockHeight = block.height || 0;
                const blockWidth = block.width || 0;
                const xOffset = block.xOffset || 0;
                const yPos = currentY;
                currentY += blockHeight;

                const status = getBlockStatus(block.blockCode);

                return (
                    <g
                        key={`cap-${index}`}
                        onClick={(e) => handleBlockClick(e, block.blockCode)}
                        className="cursor-pointer hover:opacity-90"
                    >
                        <rect
                            x={-blockWidth / 2 + xOffset}
                            y={yPos}
                            width={blockWidth}
                            height={blockHeight}
                            fill={getStatusColor(status)}
                            stroke="#374151"
                            strokeWidth="1"
                        />
                        <EditableText
                            x={xOffset}
                            y={yPos + blockHeight / 2 + 5}
                            value={block.label}
                            fontSize={10}
                            color="white"
                            anchor="middle"
                            editable={mode === 'edit'}
                            onSave={(newVal) => onLabelChange?.('cap', index, newVal)}
                        />
                    </g>
                );
            })}

            {/* Shaft (Thân trụ) */}
            {components.shaft.blocks.map((block, index) => {
                const blockHeight = block.height || 0;
                const blockWidth = components.shaft.width;
                const yPos = currentY;
                currentY += blockHeight; // Stack downwards

                const status = getBlockStatus(block.blockCode);

                return (
                    <g
                        key={`shaft-${index}`}
                        onClick={(e) => handleBlockClick(e, block.blockCode)}
                        className="cursor-pointer hover:opacity-90"
                    >
                        <rect
                            x={-blockWidth / 2}
                            y={yPos}
                            width={blockWidth}
                            height={blockHeight}
                            fill={getStatusColor(status)}
                            stroke="#374151"
                            strokeWidth="1"
                        />
                        <EditableText
                            x={0}
                            y={yPos + blockHeight / 2 + 5}
                            value={block.label}
                            fontSize={10}
                            color="white"
                            anchor="middle"
                            editable={mode === 'edit'}
                            onSave={(newVal) => onLabelChange?.('shaft', index, newVal)}
                        />
                    </g>
                );
            })}

            {/* Footing (Bệ trụ) */}
            <g
                onClick={(e) => handleBlockClick(e, components.footing.blockCode)}
                className="cursor-pointer hover:opacity-90"
            >
                <rect
                    x={-components.footing.width / 2}
                    y={currentY}
                    width={components.footing.width}
                    height={components.footing.height}
                    fill={getStatusColor(getBlockStatus(components.footing.blockCode))}
                    stroke="#374151"
                    strokeWidth="1"
                />
                <EditableText
                    x={0}
                    y={currentY + components.footing.height / 2 + 5}
                    value={components.footing.label}
                    fontSize={10}
                    color="white"
                    anchor="middle"
                    editable={mode === 'edit'}
                    onSave={(newVal) => onLabelChange?.('footing', null, newVal)}
                />
            </g>
        </g>
    );
}
