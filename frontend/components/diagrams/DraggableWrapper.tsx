import React, { ReactNode, useRef, useState, useEffect, MouseEvent as ReactMouseEvent } from 'react';

interface DraggableWrapperProps {
    id: string;
    x: number;
    y: number;
    children: ReactNode;
    enabled?: boolean;
    onPositionChange?: (id: string, newX: number, newY: number) => void;
    onSelect?: (id: string) => void;
    isSelected?: boolean;
    scale?: number;
    boundingBox?: { width: number; height: number };
    snapToGrid?: boolean;
    gridSize?: number;
}

export default function DraggableWrapper({
    id,
    x,
    y,
    children,
    enabled = false,
    onPositionChange,
    onSelect,
    isSelected = false,
    scale = 1,
    boundingBox,
    snapToGrid = true,
    gridSize = 20,
}: DraggableWrapperProps) {
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        startObjX: 0,
        startObjY: 0,
    });
    const gElementRef = useRef<SVGGElement>(null);

    const snapValue = (value: number) => {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    };

    // Document-level mouse move and up handlers
    useEffect(() => {
        if (!enabled) return;

        const handleDocumentMouseMove = (e: MouseEvent) => {
            if (!dragStateRef.current.isDragging) return;

            // Calculate delta
            const dx = (e.clientX - dragStateRef.current.startX) / scale;
            const dy = (e.clientY - dragStateRef.current.startY) / scale;

            const newX = dragStateRef.current.startObjX + dx;
            const newY = dragStateRef.current.startObjY + dy;

            // Update transform directly for smooth dragging
            if (gElementRef.current) {
                gElementRef.current.setAttribute('transform', `translate(${newX}, ${newY})`);
            }
        };

        const handleDocumentMouseUp = (e: MouseEvent) => {
            if (!dragStateRef.current.isDragging) return;

            // Calculate final position
            const dx = (e.clientX - dragStateRef.current.startX) / scale;
            const dy = (e.clientY - dragStateRef.current.startY) / scale;

            const rawX = dragStateRef.current.startObjX + dx;
            const rawY = dragStateRef.current.startObjY + dy;

            const newX = snapValue(rawX);
            const newY = snapValue(rawY);

            // Update state
            dragStateRef.current.isDragging = false;
            setIsDragging(false);

            // Notify parent
            onPositionChange?.(id, newX, newY);

            console.log('🔴 Drag ended', { id, newX, newY });
        };

        // Add listeners
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);

        // Cleanup
        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
        };
    }, [enabled, id, scale, snapToGrid, gridSize, onPositionChange]);

    const handleMouseDown = (e: ReactMouseEvent<SVGGElement>) => {
        if (!enabled || e.button !== 0) return;

        e.stopPropagation();
        e.preventDefault();

        console.log('🟢 Drag started', { id, x, y });

        dragStateRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            startObjX: x,
            startObjY: y,
        };

        setIsDragging(true);
        onSelect?.(id);
    };

    return (
        <g
            ref={gElementRef}
            transform={`translate(${x}, ${y})`}
            onMouseDown={handleMouseDown}
            style={{
                cursor: enabled ? (isDragging ? 'grabbing' : 'grab') : 'default',
                opacity: isDragging ? 0.7 : 1,
                transition: isDragging ? 'none' : 'opacity 0.2s',
            }}
        >
            {/* Selection highlight */}
            {isSelected && enabled && (
                <rect
                    x={-5}
                    y={-5}
                    width={boundingBox?.width ? boundingBox.width + 10 : 130}
                    height={boundingBox?.height ? boundingBox.height + 10 : 670}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={isDragging ? 2 : 3}
                    strokeDasharray="5 5"
                    rx={4}
                    pointerEvents="none"
                />
            )}

            {/* Drag shadow effect */}
            {isDragging && (
                <filter id={`shadow-${id}`}>
                    <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3" />
                </filter>
            )}

            {children}
        </g>
    );
}
