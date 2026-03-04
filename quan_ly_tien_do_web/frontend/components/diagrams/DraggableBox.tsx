import React, { useRef, useState, useEffect } from 'react';

interface DraggableBoxProps {
    id: string;
    x: number;
    y: number;
    label: string;
    color?: string;
    type?: 'rectangle' | 'circle' | 'text';
    width?: number;
    height?: number;
    diameter?: number;
    // Text properties
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    // Status
    status?: 'not_started' | 'in_progress' | 'completed' | 'planned';
    isSelected?: boolean;
    onDrag: (id: string, newX: number, newY: number) => void;
    // Replace onClick/onDragStart with onMouseDown to handle selection start + stop propagation
    onMouseDown?: (e: React.MouseEvent) => void;
    onDoubleClick?: (e: React.MouseEvent) => void;
    scale?: number;
}

// Status workflow colors (same as SimpleDragTest)
const STATUS_COLORS = {
    not_started: '#9ca3af',    // Gray
    in_progress: '#3b82f6',    // Blue
    completed: '#10b981',      // Green
    planned: '#f59e0b',        // Orange
};

const DraggableBox = ({
    id,
    x,
    y,
    label,
    color = '#10b981',
    type = 'rectangle',
    width = 100,
    height = 100,
    diameter = 100,
    text = '',
    fontSize = 16,
    fontFamily = 'Arial',
    fontColor = '#000000',
    fontWeight = 'normal',
    fontStyle = 'normal',
    status = 'not_started',
    isSelected = false,
    onDrag,
    onMouseDown,
    onDoubleClick,
    scale = 1,
}: DraggableBoxProps) => {
    const [isDragging, setIsDragging] = useState(false);

    // Store drag state in ref to avoid re-renders during move
    const dragState = useRef({
        startX: 0,
        startY: 0,
        startObjX: 0,
        startObjY: 0,
    });

    const gElementRef = useRef<SVGGElement>(null);
    const lastClickTimeRef = useRef(0);

    // Keep latest props in ref to avoid stale closures in event handlers
    const propsRef = useRef({ onDrag, onDoubleClick, scale, id, x, y });
    useEffect(() => {
        propsRef.current = { onDrag, onDoubleClick, scale, id, x, y };
    });

    // --- Optimized Drag Handlers (Only active during drag) ---

    // We use useRef for handlers to keep their identity stable (for removeEventListener)
    // BUT they must read from propsRef to get fresh data
    const handleDocumentMouseMove = useRef((e: MouseEvent) => {
        const { scale, onDrag, id } = propsRef.current;
        const currentScale = scale || 1;

        // Calculate Delta
        // Invert Y because of scale(1, -1) context
        const dx = (e.clientX - dragState.current.startX) / currentScale;
        const dy = -(e.clientY - dragState.current.startY) / currentScale;

        const newX = dragState.current.startObjX + dx;
        const newY = dragState.current.startObjY + dy;

        // LIVE UPDATE: Call parent onDrag immediately to trigger re-render
        if (onDrag) {
            onDrag(id, newX, newY);
        }
    }).current;

    const handleDocumentMouseUp = useRef((e: MouseEvent) => {
        // 1. Clean up listeners
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);

        // 2. Finalize Drag
        setIsDragging(false);
        if (document.body.style.cursor === 'grabbing') {
            document.body.style.cursor = '';
        }

        // 3. Commit change to Parent State
        const { scale, onDrag, id } = propsRef.current;
        const currentScale = scale || 1;
        const dx = (e.clientX - dragState.current.startX) / currentScale;
        const dy = -(e.clientY - dragState.current.startY) / currentScale;

        const rawX = dragState.current.startObjX + dx;
        const rawY = dragState.current.startObjY + dy;

        // Only trigger final drag update if there was actual movement (avoid snapping on simple clicks)
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            if (onDrag) {
                onDrag(id, rawX, rawY);
                console.log('🔴 Drag ended', { id, x: rawX, y: rawY });
            }
        }
    }).current;

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only Left Click

        e.stopPropagation();

        // Double Click Detection
        const now = Date.now();
        if (now - lastClickTimeRef.current < 300) {
            console.log('🟡 DraggableBox: Manual Double Click', { id });
            if (onDoubleClick) {
                onDoubleClick(e);
                return;
            }
        }
        lastClickTimeRef.current = now;

        // Start Drag
        console.log('🟢 DraggableBox: Mouse Down', { id });

        dragState.current = {
            startX: e.clientX,
            startY: e.clientY,
            startObjX: x,
            startObjY: y,
        };

        setIsDragging(true);

        // Attach Global Listeners
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);

        // Notify Parent (Selection)
        onMouseDown?.(e);
    };

    // Calculate bounding box for selection highlight
    const selectionBox = type === 'circle'
        ? { x: -diameter / 2 - 5, y: -diameter / 2 - 5, width: diameter + 10, height: diameter + 10 }
        : type === 'text'
            ? { x: -(text || '').length * fontSize * 0.3 - 5, y: -fontSize * 0.6 - 5, width: (text || '').length * fontSize * 0.6 + 10, height: fontSize * 1.2 + 10 }
            : { x: -width / 2 - 5, y: -height / 2 - 5, width: width + 10, height: height + 10 };

    return (
        <g
            transform={`translate(${x}, ${y})`}
            onMouseDown={handleMouseDown}
            onDoubleClick={(e) => {
                console.log('🟡 DraggableBox: Double Click', { id });
                e.stopPropagation();
                if (onDoubleClick) {
                    onDoubleClick(e);
                } else {
                    console.warn('⚠️ DraggableBox: No onDoubleClick handler provided', { id });
                }
            }}
            style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.7 : 1,
            }}
        >
            {/* Selection highlight */}
            {isSelected && (
                <rect
                    x={selectionBox.x}
                    y={selectionBox.y}
                    width={selectionBox.width}
                    height={selectionBox.height}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    rx={type === 'circle' ? selectionBox.width / 2 : 4}
                    pointerEvents="none"
                />
            )}

            {/* Shape rendering */}
            {type === 'text' ? (
                /* Text object */
                <>
                    {/* Invisible hitbox for selection */}
                    <rect
                        x={-(text || '').length * fontSize * 0.3}
                        y={-fontSize * 0.6}
                        width={(text || '').length * fontSize * 0.6}
                        height={fontSize * 1.2}
                        fill="white"
                        fillOpacity={0}
                        stroke="none"
                    />
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={fontColor}
                        fontSize={fontSize}
                        fontFamily={fontFamily}
                        fontWeight={fontWeight}
                        fontStyle={fontStyle}
                        pointerEvents="none"
                        transform="scale(1, -1)"
                    >
                        {text}
                    </text>
                </>
            ) : type === 'rectangle' ? (
                <>
                    {/* Transparent background for click handling */}
                    <rect
                        x={-width / 2}
                        y={-height / 2}
                        width={width}
                        height={height}
                        fill="white"
                        fillOpacity={0}
                        stroke="none"
                    />
                    <rect
                        x={-width / 2}
                        y={-height / 2}
                        width={width}
                        height={height}
                        fill={
                            isDragging
                                ? '#3b82f6'
                                : status === 'not_started'
                                    ? 'none'  // Not started: outline only
                                    : STATUS_COLORS[status] || color
                        }
                        stroke={status === 'not_started' ? '#000' : "#000"}  // Black for all
                        strokeWidth={2}
                        pointerEvents="none"
                    />
                    {/* Label */}
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={status === 'not_started' ? '#000' : "white"}  // Black for not_started, white for others
                        fontSize="14"
                        fontWeight="bold"
                        pointerEvents="none"
                        transform="scale(1, -1)"
                    >
                        {label}
                    </text>
                </>
            ) : (
                <>
                    {/* Transparent background for click handling */}
                    <circle
                        cx={0}
                        cy={0}
                        r={diameter / 2}
                        fill="white"
                        fillOpacity={0}
                        stroke="none"
                    />
                    <circle
                        cx={0}
                        cy={0}
                        r={diameter / 2}
                        fill={
                            isDragging
                                ? '#3b82f6'
                                : status === 'not_started'
                                    ? 'none'  // Not started: outline only
                                    : STATUS_COLORS[status] || color
                        }
                        stroke={status === 'not_started' ? '#000' : "#000"}  // Black for all
                        strokeWidth={2}
                    />
                    {/* Label */}
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={status === 'not_started' ? '#000' : "white"}  // Black for not_started, white for others
                        fontSize="14"
                        fontWeight="bold"
                        pointerEvents="none"
                        transform="scale(1, -1)"
                    >
                        {label}
                    </text>
                </>
            )}
        </g>
    );
}

export default React.memo(DraggableBox, (prev, next) => {
    // Custom comparison to avoid re-renders on every parent update
    // We ignore function props (onDrag, onMouseDown) because they are often recreated but logic is stable
    return (
        prev.id === next.id &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.label === next.label &&
        prev.color === next.color &&
        prev.type === next.type &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.diameter === next.diameter &&
        prev.text === next.text &&
        prev.fontSize === next.fontSize &&
        prev.fontFamily === next.fontFamily &&
        prev.fontColor === next.fontColor &&
        prev.fontWeight === next.fontWeight &&
        prev.fontStyle === next.fontStyle &&
        prev.isSelected === next.isSelected &&
        prev.scale === next.scale &&
        prev.status === next.status
    );
});
