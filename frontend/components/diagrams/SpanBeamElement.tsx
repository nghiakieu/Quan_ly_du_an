import React from 'react';
import EditableText from './EditableText';

interface Block {
    code: string;
    category_name: string;
    status: number;
}

interface SpanComponents {
    beam: {
        height: number;
        blockCodes: string[];
        label?: string;
    };
    deck: {
        height: number;
        blockCode: string;
        label?: string;
    };
    railing: {
        height: number;
        blockCode: string;
    };
}

interface SpanBeamElementProps {
    id: string;
    label: string;
    startX: number;
    endX: number;
    y: number;
    components: SpanComponents;
    blocks: Block[];
    onBlockClick?: (code: string) => void;
    mode?: 'view' | 'edit';
    onLabelChange?: (type: 'span' | 'beam' | 'deck', newLabel: string) => void;
}

const STATUS_COLORS = {
    0: '#ef4444',
    1: '#f59e0b',
    2: '#10b981',
};

export default function SpanBeamElement({
    id,
    label,
    startX,
    endX,
    y,
    components,
    blocks,
    onBlockClick,
    mode = 'view',
    onLabelChange,
}: SpanBeamElementProps) {
    const getBlockStatus = (blockCode: string) => {
        const block = blocks.find((b) =>
            b.code === blockCode ||
            b.code.startsWith(blockCode)
        );
        return block?.status ?? 0;
    };

    const getColor = (status: number) => {
        return (STATUS_COLORS as any)[status] || '#e5e7eb';
    };

    const spanWidth = endX - startX;
    const { beam, deck, railing } = components;

    // Beam status - check all beam blocks
    const beamStatuses = beam.blockCodes.map(getBlockStatus);
    const beamStatus = beamStatuses.includes(0) ? 0 : beamStatuses.includes(1) ? 1 : 2;
    const beamColor = getColor(beamStatus);

    const deckStatus = getBlockStatus(deck.blockCode);
    const deckColor = getColor(deckStatus);

    const railingStatus = getBlockStatus(railing.blockCode);
    const railingColor = getColor(railingStatus);

    return (
        <g className="span-beam-element">
            {/* Span label */}
            <EditableText
                x={(startX + endX) / 2}
                y={y - 85}
                value={label}
                fontSize={12}
                fontWeight="600"
                color="#374151"
                anchor="middle"
                editable={mode === 'edit'}
                onSave={(newVal) => onLabelChange?.('span', newVal)}
            />

            {/* Beam (Dầm chính) */}
            <g onClick={() => onBlockClick?.(beam.blockCodes[0])} style={{ cursor: 'pointer' }}>
                <rect
                    x={startX}
                    y={y}
                    width={spanWidth}
                    height={beam.height}
                    fill={beamColor}
                    stroke="#1f2937"
                    strokeWidth={2}
                    className="transition-all hover:opacity-80"
                />
                <EditableText
                    x={(startX + endX) / 2}
                    y={y + beam.height / 2 + 5}
                    value={beam.label || "Dầm chính"}
                    fontSize={11}
                    color="white"
                    fontWeight="600"
                    anchor="middle"
                    editable={mode === 'edit'}
                    onSave={(newVal) => onLabelChange?.('beam', newVal)}
                />
            </g>

            {/* Deck (Bản mặt cầu) */}
            <g onClick={() => onBlockClick?.(deck.blockCode)} style={{ cursor: 'pointer' }}>
                <rect
                    x={startX}
                    y={y - deck.height}
                    width={spanWidth}
                    height={deck.height}
                    fill={deckColor}
                    stroke="#1f2937"
                    strokeWidth={1.5}
                    className="transition-all hover:opacity-80"
                />
                <EditableText
                    x={(startX + endX) / 2}
                    y={y - deck.height / 2 + 5}
                    value={deck.label || "Bản mặt cầu"}
                    fontSize={9}
                    color="white"
                    fontWeight="600"
                    anchor="middle"
                    editable={mode === 'edit'}
                    onSave={(newVal) => onLabelChange?.('deck', newVal)}
                />
            </g>

            {/* Railing (Lan can) */}
            <g onClick={() => onBlockClick?.(railing.blockCode)} style={{ cursor: 'pointer' }}>
                {/* Left railing */}
                <rect
                    x={startX}
                    y={y - deck.height - railing.height}
                    width={8}
                    height={railing.height}
                    fill={railingColor}
                    stroke="#1f2937"
                    strokeWidth={1}
                    className="transition-all hover:opacity-80"
                />

                {/* Right railing */}
                <rect
                    x={endX - 8}
                    y={y - deck.height - railing.height}
                    width={8}
                    height={railing.height}
                    fill={railingColor}
                    stroke="#1f2937"
                    strokeWidth={1}
                    className="transition-all hover:opacity-80"
                />
            </g>
        </g>
    );
}
