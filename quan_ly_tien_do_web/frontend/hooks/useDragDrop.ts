import { useState, useCallback, MouseEvent } from 'react';

interface DragState {
    isDragging: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface UseDragDropReturn {
    isDragging: boolean;
    offset: { x: number; y: number };
    handleMouseDown: (e: MouseEvent, initialX: number, initialY: number) => void;
    handleMouseMove: (e: MouseEvent) => void;
    handleMouseUp: () => void;
}

export default function useDragDrop(
    onDragEnd?: (deltaX: number, deltaY: number) => void
): UseDragDropReturn {
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
    });

    const handleMouseDown = useCallback(
        (e: MouseEvent, initialX: number, initialY: number) => {
            // Only drag with left mouse button
            if (e.button === 0) {
                setDragState({
                    isDragging: true,
                    startX: e.clientX - initialX,
                    startY: e.clientY - initialY,
                    currentX: e.clientX,
                    currentY: e.clientY,
                });
                e.stopPropagation(); // Prevent pan
            }
        },
        []
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (dragState.isDragging) {
                setDragState((prev) => ({
                    ...prev,
                    currentX: e.clientX,
                    currentY: e.clientY,
                }));
            }
        },
        [dragState.isDragging]
    );

    const handleMouseUp = useCallback(() => {
        if (dragState.isDragging && onDragEnd) {
            const deltaX = dragState.currentX - dragState.startX;
            const deltaY = dragState.currentY - dragState.startY;
            onDragEnd(deltaX, deltaY);
        }
        setDragState((prev) => ({ ...prev, isDragging: false }));
    }, [dragState, onDragEnd]);

    const offset = {
        x: dragState.isDragging ? dragState.currentX - dragState.startX : 0,
        y: dragState.isDragging ? dragState.currentY - dragState.startY : 0,
    };

    return {
        isDragging: dragState.isDragging,
        offset,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
    };
}
