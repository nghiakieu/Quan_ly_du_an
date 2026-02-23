"use client";

import React, { useState, WheelEvent, MouseEvent } from 'react';
import PierFoundationView from './PierFoundationView';
import PierElement from './PierElement';
import SpanBeamElement from './SpanBeamElement';
import BlockPropertiesPanel from './BlockPropertiesPanel';
import DraggableWrapper from './DraggableWrapper';
import GridPattern from './GridPattern';
import type { Block } from '@/lib/api';


interface BridgeConfig {
    bridge: {
        name: string;
        views: {
            plan: { viewBox: { width: number; height: number }; enabled: boolean };
            elevation: { viewBox: { width: number; height: number }; enabled: boolean };
        };
        piers: any[];
        spans: any[];
    };
}

interface PanZoomHandlers {
    onWheel: (e: WheelEvent<SVGSVGElement>) => void;
    onMouseDown: (e: MouseEvent<SVGSVGElement>) => void;
    onMouseMove: (e: MouseEvent<SVGSVGElement>) => void;
    onMouseUp: () => void;
}

interface BridgeDiagramProps {
    blocks: Block[];
    config: BridgeConfig;
    mode?: 'view' | 'edit';
    transform?: string;
    zoom?: number;
    onConfigChange?: (newConfig: BridgeConfig) => void;
    selectedObjectId?: string | null;
    onSelectObject?: (id: string | null) => void;
    onBlockClick?: (block: Block) => void;
}

export default function BridgeDiagram({
    blocks,
    config,
    mode = 'view',
    transform = '',
    zoom = 1,
    onConfigChange,
    selectedObjectId,
    onSelectObject,
}: BridgeDiagramProps) {
    // Local state for block properties viewing
    const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);

    const { piers, spans, views } = config.bridge;
    const combinedViewBox = {
        width: views.elevation.viewBox.width,
        height: views.plan.viewBox.height + views.elevation.viewBox.height + 50,
    };

    const handleBlockClick = (code: string) => {
        const block = blocks.find((b) =>
            b.code === code ||
            b.code.startsWith(code) ||
            code.includes(b.code)
        );
        setSelectedBlock(block || null);
    };

    const handlePierPositionChange = (pierId: string, newX: number, newY: number) => {
        if (!onConfigChange) return;

        const updatedConfig = {
            ...config,
            bridge: {
                ...config.bridge,
                piers: config.bridge.piers.map((pier) =>
                    pier.id === pierId ? { ...pier, x: newX } : pier
                ),
            },
        };
        onConfigChange(updatedConfig);
    };

    const handleLabelChange = (
        pierId: string,
        type: 'pier' | 'footing' | 'shaft' | 'cap',
        index: number | null,
        newLabel: string
    ) => {
        if (!onConfigChange) return;

        const updatedConfig = {
            ...config,
            bridge: {
                ...config.bridge,
                piers: config.bridge.piers.map((pier) => {
                    if (pier.id !== pierId) return pier;

                    const newPier = { ...pier };

                    if (type === 'pier') {
                        newPier.label = newLabel;
                    } else if (type === 'footing') {
                        newPier.components.footing.label = newLabel;
                    } else if (type === 'shaft' && index !== null) {
                        const newBlocks = [...newPier.components.shaft.blocks];
                        newBlocks[index] = { ...newBlocks[index], label: newLabel };
                        newPier.components.shaft.blocks = newBlocks;
                    } else if (type === 'cap' && index !== null) {
                        const newBlocks = [...newPier.components.cap.blocks];
                        newBlocks[index] = { ...newBlocks[index], label: newLabel };
                        newPier.components.cap.blocks = newBlocks;
                    }

                    return newPier;
                }),
            },
        };
        onConfigChange(updatedConfig);
    };

    const handleSpanLabelChange = (
        spanId: string,
        type: 'span' | 'beam' | 'deck',
        newLabel: string
    ) => {
        if (!onConfigChange) return;

        const updatedConfig = {
            ...config,
            bridge: {
                ...config.bridge,
                spans: config.bridge.spans.map((span) => {
                    if (span.id !== spanId) return span;

                    const newSpan = { ...span };
                    if (type === 'span') {
                        newSpan.label = newLabel;
                    } else if (type === 'beam') {
                        newSpan.components.beam.label = newLabel;
                    } else if (type === 'deck') {
                        newSpan.components.deck.label = newLabel;
                    }
                    return newSpan;
                }),
            },
        };
        onConfigChange(updatedConfig);
    };



    const handleSpanPositionChange = (spanId: string, newX: number, newY: number) => {
        if (!onConfigChange) return;

        const updatedConfig = {
            ...config,
            bridge: {
                ...config.bridge,
                spans: config.bridge.spans.map((span) =>
                    span.id === spanId
                        ? { ...span, y: newY }
                        : span
                ),
            },
        };
        onConfigChange(updatedConfig);
    };

    return (
        <div className="relative w-full">
            <svg
                viewBox={`0 0 ${combinedViewBox.width} ${combinedViewBox.height}`}
                className="w-full h-auto bg-gray-50"
                style={{ minHeight: '600px' }}
            >
                {/* Grid Pattern for Edit Mode */}
                <GridPattern show={mode === 'edit'} gridSize={20} />

                {/* Pan/Zoom transform group */}
                <g transform={transform}>
                    {/* Plan view at top */}
                    <g transform="translate(0, 0)">
                        <text
                            x={combinedViewBox.width / 2}
                            y={20}
                            textAnchor="middle"
                            fontSize="18"
                            fontWeight="bold"
                            fill="#1f2937"
                        >
                            MẶT BẰNG CỌC KHOAN NHỒI
                        </text>
                        {piers.map((pier: any) => (
                            <PierFoundationView
                                key={`plan-${pier.id}`}
                                pierId={pier.id}
                                label={pier.label}
                                x={pier.x}
                                piles={pier.components.foundation.piles}
                                blocks={blocks}
                                onBlockClick={handleBlockClick}
                            />
                        ))}
                    </g>

                    {/* Elevation view below */}
                    <g transform={`translate(0, ${views.plan.viewBox.height + 50})`}>
                        <text
                            x={combinedViewBox.width / 2}
                            y={20}
                            textAnchor="middle"
                            fontSize="18"
                            fontWeight="bold"
                            fill="#1f2937"
                        >
                            MẶT ĐỨNG KẾT CẤU CẦU
                        </text>

                        {piers.map((pier: any) => {
                            const pierElement = (
                                <PierElement
                                    id={pier.id}
                                    label={pier.label}
                                    x={0}
                                    components={pier.components}
                                    blocks={blocks}
                                    onBlockClick={handleBlockClick}
                                    mode={mode}
                                    onLabelChange={(type, index, newLabel) =>
                                        handleLabelChange(pier.id, type, index, newLabel)
                                    }
                                />
                            );

                            // Wrap in DraggableWrapper only in edit mode
                            return mode === 'edit' ? (
                                <DraggableWrapper
                                    key={`drag-${pier.id}`}
                                    id={pier.id}
                                    x={pier.x}
                                    y={0}
                                    enabled={true}
                                    scale={zoom}
                                    onPositionChange={(id, newX) => handlePierPositionChange(id, newX, 0)}
                                    onSelect={(id) => onSelectObject?.(id)}
                                    isSelected={selectedObjectId === pier.id}
                                >
                                    {pierElement}
                                </DraggableWrapper>
                            ) : (
                                <g key={`static-${pier.id}`} transform={`translate(${pier.x}, 0)`}>
                                    {pierElement}
                                </g>
                            );
                        })}

                        {spans.map((span: any) => {
                            const spanElement = (
                                <SpanBeamElement
                                    id={span.id}
                                    label={span.label}
                                    startX={span.startPierX}
                                    endX={span.endPierX}
                                    y={span.y}
                                    components={span.components}
                                    blocks={blocks}
                                    onBlockClick={handleBlockClick}
                                    mode={mode}
                                    onLabelChange={(type, newLabel) =>
                                        handleSpanLabelChange(span.id, type, newLabel)
                                    }
                                />
                            );

                            return mode === 'edit' ? (
                                <DraggableWrapper
                                    key={`drag-${span.id}`}
                                    id={span.id}
                                    x={span.startPierX}
                                    y={span.y}
                                    enabled={true}
                                    scale={zoom}
                                    onPositionChange={handleSpanPositionChange}
                                    onSelect={(id) => onSelectObject?.(id)}
                                    isSelected={selectedObjectId === span.id}
                                    boundingBox={{
                                        width: span.endPierX - span.startPierX,
                                        height: 100
                                    }}
                                >
                                    {spanElement}
                                </DraggableWrapper>
                            ) : (
                                <g key={span.id}>{spanElement}</g>
                            );
                        })}
                    </g>
                </g>
            </svg>

            {/* Properties Panel */}
            {mode === 'view' && (
                <BlockPropertiesPanel
                    block={selectedBlock}
                    onClose={() => setSelectedBlock(null)}
                />
            )}
        </div>
    );
}
