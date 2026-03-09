import React, { useRef, useState, useEffect } from 'react';

interface DraggableBoxProps {
    id: string;
    x: number;
    y: number;
    label: string;
    color?: string;
    type?: 'rectangle' | 'circle' | 'text' | 'slice';
    width?: number;
    height?: number;
    diameter?: number;
    // Slice properties
    parts?: number;
    totalQuantity?: number;
    actualQuantity?: number;
    inProgressQuantity?: number;
    planQuantity?: number;
    orient?: 'horizontal' | 'vertical';
    direction?: 'ltr' | 'rtl' | 'ttb' | 'btt';
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
    parts = 10,
    totalQuantity = 100,
    actualQuantity = 0,
    inProgressQuantity = 0,
    planQuantity = 0,
    orient = 'horizontal',
    direction = 'ltr',
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
            : { x: -width / 2 - 5, y: -height / 2 - 5, width: width + 10, height: height + 10 }; // rectangle and slice

    // Compute ratios for stacked bar slice
    const computeSlices = () => {
        const total = Math.max(0.0001, totalQuantity || 1); // Tránh chia cho 0
        const doneRatio = Math.min(Math.max((actualQuantity || 0) / total, 0), 1);
        const inProgRatio = Math.min(Math.max((inProgressQuantity || 0) / total, 0), 1 - doneRatio);
        const planRatio = Math.min(Math.max((planQuantity || 0) / total, 0), 1 - doneRatio - inProgRatio);

        return { doneRatio, inProgRatio, planRatio };
    };
    const { doneRatio, inProgRatio, planRatio } = type === 'slice' ? computeSlices() : { doneRatio: 0, inProgRatio: 0, planRatio: 0 };

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
            ) : type === 'slice' ? (
                <>
                    {/* Transparent background for click handling */}
                    <rect x={-width / 2} y={-height / 2} width={width} height={height} fill="white" fillOpacity={0} stroke="none" />
                    <g transform={`translate(${-width / 2}, ${-height / 2})`}>
                        {(() => {
                            // Stacked Bar rendering
                            // Trình tự vẽ: done -> inProg -> plan, còn lại là background trắng x=-width/2 phía dưới
                            const ltr = direction === 'ltr' || direction === 'ttb'; // 'ttb' giống 'ltr' nếu hiểu theo trục tịnh tiến
                            const isHoriz = orient === 'horizontal';

                            const lengthDone = doneRatio * (isHoriz ? width : height);
                            const lengthInProg = inProgRatio * (isHoriz ? width : height);
                            const lengthPlan = planRatio * (isHoriz ? width : height);

                            // Vị trí (x hoặc y) bắt đầu của từng khối
                            const startDone = ltr ? 0 : (isHoriz ? width - lengthDone : height - lengthDone);
                            const startInProg = ltr ? lengthDone : startDone - lengthInProg;
                            const startPlan = ltr ? lengthDone + lengthInProg : startInProg - lengthPlan;

                            return (
                                <>
                                    {/* Done phase */}
                                    {lengthDone > 0 && (
                                        <rect
                                            x={isHoriz ? startDone : 0}
                                            y={isHoriz ? 0 : startDone}
                                            width={isHoriz ? lengthDone : width}
                                            height={isHoriz ? height : lengthDone}
                                            fill={STATUS_COLORS['completed']}
                                            stroke="none" pointerEvents="none"
                                        />
                                    )}
                                    {/* In Progress phase */}
                                    {lengthInProg > 0 && (
                                        <rect
                                            x={isHoriz ? startInProg : 0}
                                            y={isHoriz ? 0 : startInProg}
                                            width={isHoriz ? lengthInProg : width}
                                            height={isHoriz ? height : lengthInProg}
                                            fill={STATUS_COLORS['in_progress']}
                                            stroke="none" pointerEvents="none"
                                        />
                                    )}
                                    {/* Plan phase */}
                                    {lengthPlan > 0 && (
                                        <rect
                                            x={isHoriz ? startPlan : 0}
                                            y={isHoriz ? 0 : startPlan}
                                            width={isHoriz ? lengthPlan : width}
                                            height={isHoriz ? height : lengthPlan}
                                            fill={STATUS_COLORS['planned']}
                                            stroke="none" pointerEvents="none"
                                        />
                                    )}
                                </>
                            );
                        })()}
                    </g>
                    <rect x={-width / 2} y={-height / 2} width={width} height={height} fill="none" stroke={isDragging ? '#3b82f6' : "#000"} strokeWidth={isDragging ? 3 : 2} pointerEvents="none" />
                    {/* Label & Progress Text */}
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={"white"}
                        fontSize="12"
                        fontWeight="bold"
                        pointerEvents="none"
                        transform="scale(1, -1)"
                        style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}
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
                                    ? 'none'
                                    : STATUS_COLORS[status] || color
                        }
                        stroke={status === 'not_started' ? '#000' : "#000"}
                        strokeWidth={2}
                    />
                    {/* Label */}
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={status === 'not_started' ? '#000' : "white"}
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
        prev.parts === next.parts &&
        prev.totalQuantity === next.totalQuantity &&
        prev.actualQuantity === next.actualQuantity &&
        prev.inProgressQuantity === next.inProgressQuantity &&
        prev.planQuantity === next.planQuantity &&
        prev.orient === next.orient &&
        prev.direction === next.direction &&
        prev.text === next.text &&
        prev.fontSize === next.fontSize &&
        prev.fontFamily === next.fontFamily &&
        prev.fontColor === next.fontColor &&
        prev.fontWeight === next.fontWeight &&
        prev.fontStyle === next.fontStyle &&
        prev.parts === next.parts &&
        prev.totalQuantity === next.totalQuantity &&
        prev.actualQuantity === next.actualQuantity &&
        prev.orient === next.orient &&
        prev.direction === next.direction &&
        prev.isSelected === next.isSelected &&
        prev.scale === next.scale &&
        prev.status === next.status
    );
});
