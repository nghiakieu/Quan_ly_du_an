import { useState, useCallback, WheelEvent, MouseEvent } from 'react';

interface PanZoomState {
    zoom: number;
    pan: { x: number; y: number };
}

interface UsePanZoomReturn {
    zoom: number;
    pan: { x: number; y: number };
    transform: string;
    handleWheel: (e: WheelEvent<SVGSVGElement>) => void;
    handleMouseDown: (e: MouseEvent<SVGSVGElement>) => void;
    handleMouseMove: (e: MouseEvent<SVGSVGElement>) => void;
    handleMouseUp: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
}

export default function usePanZoom(
    initialZoom: number = 1,
    minZoom: number = 0.5,
    maxZoom: number = 3
): UsePanZoomReturn {
    const [state, setState] = useState<PanZoomState>({
        zoom: initialZoom,
        pan: { x: 0, y: 0 },
    });

    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Zoom with mouse wheel at cursor position
    const handleWheel = useCallback(
        (e: WheelEvent<SVGSVGElement>) => {
            e.preventDefault();

            const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
            const newZoom = Math.max(minZoom, Math.min(maxZoom, state.zoom * delta));

            // Get mouse position relative to SVG
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate new pan to keep mouse position fixed
            // Formula: new_pan = old_pan - mouse_pos * (new_zoom - old_zoom) / old_zoom
            const zoomRatio = newZoom / state.zoom - 1;
            const newPanX = state.pan.x - (mouseX - state.pan.x) * zoomRatio;
            const newPanY = state.pan.y - (mouseY - state.pan.y) * zoomRatio;

            setState({
                zoom: newZoom,
                pan: { x: newPanX, y: newPanY },
            });
        },
        [state.zoom, state.pan, minZoom, maxZoom]
    );

    // Start panning
    const handleMouseDown = useCallback((e: MouseEvent<SVGSVGElement>) => {
        // Pan with middle mouse button (button === 1)
        if (e.button === 1) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - state.pan.x, y: e.clientY - state.pan.y });
            e.preventDefault();
        }
    }, [state.pan]);

    // Pan while dragging
    const handleMouseMove = useCallback(
        (e: MouseEvent<SVGSVGElement>) => {
            if (isPanning) {
                setState((prev) => ({
                    ...prev,
                    pan: {
                        x: e.clientX - panStart.x,
                        y: e.clientY - panStart.y,
                    },
                }));
            }
        },
        [isPanning, panStart]
    );

    // Stop panning
    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Zoom in button
    const zoomIn = useCallback(() => {
        setState((prev) => ({
            ...prev,
            zoom: Math.min(maxZoom, prev.zoom * 1.2),
        }));
    }, [maxZoom]);

    // Zoom out button
    const zoomOut = useCallback(() => {
        setState((prev) => ({
            ...prev,
            zoom: Math.max(minZoom, prev.zoom / 1.2),
        }));
    }, [minZoom]);

    // Reset to initial view
    const resetView = useCallback(() => {
        setState({
            zoom: initialZoom,
            pan: { x: 0, y: 0 },
        });
    }, [initialZoom]);

    // Generate SVG transform string
    const transform = `translate(${state.pan.x}, ${state.pan.y}) scale(${state.zoom})`;

    return {
        zoom: state.zoom,
        pan: state.pan,
        transform,
        handleWheel,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        zoomIn,
        zoomOut,
        resetView,
    };
}
