"use client";

import React, { useState } from 'react';
import DraggableBox from './DraggableBox';
import ObjectBOQAssignment from './ObjectBOQAssignment';
import StatusPieChart from './StatusPieChart';
import ProgressDashboard from './ProgressDashboard';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth';
import { syncDiagramBOQ, extractErrorMessage, getDiagrams, getDiagram, createDiagram, updateDiagram } from '@/lib/api';
import BOQSyncReport from '../BOQSyncReport';
import { toast } from 'sonner';

/** Segment for progressType 'segments' (e.g. trụ thi công theo đợt) */
export interface BoxObjectSegment {
    id: string;
    name: string;
    weight: number; // 0..1, tỉ trọng
    status: 'not_started' | 'in_progress' | 'completed';
}

interface BoxObject {
    id: string;
    x: number;
    y: number;
    label: string;
    color: string;
    type: 'rectangle' | 'circle' | 'text' | 'slice';
    width?: number;  // For rectangle/slice
    height?: number; // For rectangle/slice
    diameter?: number; // For circle
    // Slice properties
    parts?: number;
    totalQuantity?: number;
    actualQuantity?: number;
    inProgressQuantity?: number;
    planQuantity?: number;
    // History array for completed quantity
    actualHistory?: { id: string; date: string; quantity: number }[];
    isHistoryOpen?: boolean; // UI state for collapsing history panel
    orient?: 'horizontal' | 'vertical';
    direction?: 'ltr' | 'rtl' | 'ttb' | 'btt';
    // Text properties
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    // Status for workflow (rect/circle/slice only)
    status?: 'not_started' | 'in_progress' | 'completed' | 'planned';
    completionDate?: string; // YYYY-MM-DD
    // BIM Data
    boqIds?: { [boqId: string]: number }; // Map BOQ ID -> Quantity for this object
}

import { BOQItem } from './BOQUploader';

/** Resolve effective status and progress % from BoxObject (percentage / segments / none). */
function resolveBoxProgress(obj: BoxObject): { status: 'not_started' | 'in_progress' | 'completed' | 'planned'; progressPct: number } {
    const s = obj.status || 'not_started';
    const pct = s === 'completed' ? 100 : s === 'in_progress' ? 50 : 0;
    return { status: s, progressPct: pct };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];

// Status workflow colors
const STATUS_COLORS = {
    not_started: '#9ca3af',    // Gray - outline only
    in_progress: '#3b82f6',    // Blue
    completed: '#10b981',      // Green
    planned: '#f59e0b',        // Orange
};

/**
 * Check if two objects collide
 */
function checkCollision(obj1: BoxObject, obj2: BoxObject): boolean {
    const getBox = (obj: BoxObject) => {
        if (obj.type === 'circle') {
            const r = (obj.diameter || 100) / 2;
            return { x: obj.x - r, y: obj.y - r, width: obj.diameter || 100, height: obj.diameter || 100 };
        } else if (obj.type === 'text') {
            const w = (obj.text || '').length * (obj.fontSize || 16) * 0.6;
            const h = (obj.fontSize || 16) * 1.2;
            return { x: obj.x - w / 2, y: obj.y - h / 2, width: w, height: h };
        } else {
            return {
                x: obj.x - (obj.width || 100) / 2,
                y: obj.y - (obj.height || 100) / 2,
                width: obj.width || 100,
                height: obj.height || 100
            };
        }
    };

    const box1 = getBox(obj1);
    const box2 = getBox(obj2);

    return !(box1.x + box1.width < box2.x ||
        box2.x + box2.width < box1.x ||
        box1.y + box1.height < box2.y ||
        box2.y + box2.height < box1.y);
}

/**
 * PHASE 4: Shapes với Customizable Dimensions
 * - Rectangle và Circle shapes
 * - Editable dimensions
 * - Compact properties panel
 */
export default function SimpleDragTest({ projectId, diagramId: propDiagramId, diagramName }: { projectId?: string; diagramId?: number | null; diagramName?: string }) {
    const { isAuthenticated, user } = useAuth();
    const isAuthorized = isAuthenticated && (user?.role === 'admin' || user?.role === 'editor');

    const [objects, setObjects] = useState<BoxObject[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Keep selectedId for backward compatibility where single logic is used, or helper
    const primarySelectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

    const isDraggingRef = React.useRef(false);

    // Selection Box State
    const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number, isCrossing: boolean } | null>(null);
    const selectionStartRef = React.useRef<{ x: number, y: number } | null>(null);

    const [snapLines, setSnapLines] = useState<{ x1: number, y1: number, x2: number, y2: number }[]>([]);

    // Viewport state (Zoom & Pan)
    const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
    const svgRef = React.useRef<SVGSVGElement>(null);

    // BOQ Sync State
    const boqFileInputRef = React.useRef<HTMLInputElement>(null);
    const [isSyncingBOQ, setIsSyncingBOQ] = useState(false);
    const [syncReport, setSyncReport] = useState<any>(null);
    const [showSyncReport, setShowSyncReport] = useState(false);

    const panState = React.useRef({ isPanning: false, startX: 0, startY: 0, viewStartX: 0, viewStartY: 0 });
    const touchState = React.useRef({ isTouching: false, type: 'none', startDist: 0, lastX: 0, lastY: 0, startViewX: 0, startViewY: 0, startScale: 1 });
    const lastMiddleClickTime = React.useRef(0);
    const [isPanelOpen, setIsPanelOpen] = useState(false); // Mobile sidebar toggle state

    // Helper: Get Bounding Box
    const getObjBounds = (obj: BoxObject) => {
        let w = 0, h = 0;
        if (obj.type === 'circle') {
            w = h = obj.diameter || 100;
        } else if (obj.type === 'text') {
            w = (obj.text?.length || 5) * (obj.fontSize || 16) * 0.6;
            h = (obj.fontSize || 16) * 1.5;
        } else {
            w = obj.width || 100;
            h = obj.height || 100;
        }
        return {
            minX: obj.x - w / 2,
            maxX: obj.x + w / 2,
            minY: obj.y - h / 2,
            maxY: obj.y + h / 2,
            centerX: obj.x,
            centerY: obj.y
        };
    };

    // Helper: Convert Screen to Data Coords
    const screenToData = (sx: number, sy: number) => {
        return {
            x: (sx - viewState.x) / viewState.scale,
            y: (sy - viewState.y) / viewState.scale // Simplified - check Y inversion later if needed
        };
    };

    // Handle Zoom (Wheel) - Non-passive to prevent scroll
    React.useEffect(() => {
        const svgEl = svgRef.current;
        if (!svgEl) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();

            // Smooth Zoom Logic (Zoom to Cursor)
            const zoomSensitivity = 0.001;
            const delta = -e.deltaY * zoomSensitivity;
            const oldScale = viewState.scale;
            const newScale = Math.min(Math.max(0.1, oldScale + delta), 5); // Limit scale 0.1x to 5x

            // Calculate mouse position relative to SVG Container (0,0 is top-left of SVG)
            const rect = svgEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Current World Point under mouse
            // ScreenX = WorldX * scale + ViewX  => WorldX = (ScreenX - ViewX) / scale
            const worldX = (mouseX - viewState.x) / oldScale;
            const worldY = (mouseY - viewState.y) / oldScale;

            // New ViewX to keep WorldX under mouseX
            // mouseX = worldX * newScale + newViewX => newViewX = mouseX - worldX * newScale
            const newViewX = mouseX - worldX * newScale;
            const newViewY = mouseY - worldY * newScale;

            setViewState({ scale: newScale, x: newViewX, y: newViewY });
        };

        // Use passive: false to allow preventDefault (block scroll)
        svgEl.addEventListener('wheel', onWheel, { passive: false });

        // --- TOUCH EVENTS FOR MOBILE ZOOM & PAN ---
        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1 || e.touches.length === 2) {
                if (e.cancelable) e.preventDefault();
            }

            if (e.touches.length === 1) {
                touchState.current = {
                    ...touchState.current,
                    isTouching: true,
                    type: 'pan',
                    startDist: 0,
                    lastX: e.touches[0].clientX,
                    lastY: e.touches[0].clientY,
                    startViewX: viewState.x,
                    startViewY: viewState.y,
                    startScale: viewState.scale
                };
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                touchState.current = {
                    ...touchState.current,
                    isTouching: true,
                    type: 'zoom',
                    startDist: dist,
                    lastX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    lastY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                    startViewX: viewState.x,
                    startViewY: viewState.y,
                    startScale: viewState.scale
                };
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!touchState.current.isTouching) return;
            if (e.cancelable) e.preventDefault();

            if (touchState.current.type === 'pan' && e.touches.length === 1) {
                const dx = e.touches[0].clientX - touchState.current.lastX;
                const dy = e.touches[0].clientY - touchState.current.lastY;
                setViewState({
                    ...viewState,
                    x: touchState.current.startViewX + dx,
                    y: touchState.current.startViewY + dy
                });
            } else if (touchState.current.type === 'zoom' && e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const currentDist = Math.sqrt(dx * dx + dy * dy);

                const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const scaleFactor = currentDist / touchState.current.startDist;
                const newScale = Math.min(Math.max(0.1, touchState.current.startScale * scaleFactor), 5);

                const rect = svgEl.getBoundingClientRect();
                const mouseX = touchState.current.lastX - rect.left;
                const mouseY = touchState.current.lastY - rect.top;

                const worldX = (mouseX - touchState.current.startViewX) / touchState.current.startScale;
                const worldY = (mouseY - touchState.current.startViewY) / touchState.current.startScale;

                const panX = currentMidX - touchState.current.lastX;
                const panY = currentMidY - touchState.current.lastY;

                const newViewX = mouseX - worldX * newScale + panX;
                const newViewY = mouseY - worldY * newScale + panY;

                setViewState({ scale: newScale, x: newViewX, y: newViewY });
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length === 0) {
                touchState.current.isTouching = false;
                touchState.current.type = 'none';
            } else if (e.touches.length === 1 && touchState.current.type === 'zoom') {
                touchState.current = {
                    ...touchState.current,
                    type: 'pan',
                    lastX: e.touches[0].clientX,
                    lastY: e.touches[0].clientY,
                    startViewX: viewState.x,
                    startViewY: viewState.y
                };
            }
        };

        svgEl.addEventListener('touchstart', onTouchStart, { passive: false });
        svgEl.addEventListener('touchmove', onTouchMove, { passive: false });
        svgEl.addEventListener('touchend', onTouchEnd, { passive: false });
        svgEl.addEventListener('touchcancel', onTouchEnd, { passive: false });

        return () => {
            svgEl.removeEventListener('wheel', onWheel);
            svgEl.removeEventListener('touchstart', onTouchStart);
            svgEl.removeEventListener('touchmove', onTouchMove);
            svgEl.removeEventListener('touchend', onTouchEnd);
            svgEl.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [viewState]);

    // Handle Pan (Middle Click / Shift+Click)
    const handlePanStart = (e: React.MouseEvent) => {
        // Detect Double Middle Click (button 1)
        if (e.button === 1) {
            const now = Date.now();
            if (now - lastMiddleClickTime.current < 300) {
                // Double click detected!
                e.preventDefault();
                handleFitToScreen(objects);
                lastMiddleClickTime.current = 0; // Reset
                return;
            }
            lastMiddleClickTime.current = now;
        }

        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            e.preventDefault();
            e.stopPropagation();
            panState.current = {
                isPanning: true,
                startX: e.clientX,
                startY: e.clientY,
                viewStartX: viewState.x,
                viewStartY: viewState.y
            };
        }
    };

    const handlePanMove = (e: React.MouseEvent) => {
        if (!panState.current.isPanning) return;

        e.preventDefault();
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;

        setViewState(prev => ({
            ...prev,
            x: panState.current.viewStartX + dx,
            y: panState.current.viewStartY + dy
        }));
    };

    const handlePanEnd = () => {
        panState.current.isPanning = false;
    };

    // Fit to Screen (Double Middle Click)
    const handleFitToScreen = (objsOverride?: BoxObject[]) => {
        const targetObjects = objsOverride || objects;
        if (targetObjects.length === 0) {
            setViewState({ scale: 1, x: 0, y: 0 });
            return;
        }

        // 1. Calculate Bounding Box of objects in Data Coordinates
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        targetObjects.forEach(obj => {
            // Estimate size based on type
            let w = 0, h = 0;
            if (obj.type === 'circle') {
                w = h = obj.diameter || 100;
            } else if (obj.type === 'text') {
                w = (obj.text?.length || 5) * (obj.fontSize || 16) * 0.6;
                h = (obj.fontSize || 16) * 1.5;
            } else {
                w = obj.width || 100;
                h = obj.height || 100;
            }

            // Object origin is usually center or top-left?
            // Checking DraggableBox: rect is drawn from x-w/2, y-h/2 (centered)?
            // Let's check DraggableBox render.
            // Assuming centered:
            minX = Math.min(minX, obj.x - w / 2);
            maxX = Math.max(maxX, obj.x + w / 2);
            // Y is inverted in render logic (900-y), but here we calculate in Data Space.
            // Let's keep data logic consistent.
            minY = Math.min(minY, obj.y - h / 2);
            maxY = Math.max(maxY, obj.y + h / 2);
        });

        // 2. Calculate Viewport Size
        const svgEl = svgRef.current;
        if (!svgEl) return;
        const { width: viewportW, height: viewportH } = svgEl.getBoundingClientRect();

        const dataW = maxX - minX;
        const dataH = maxY - minY;

        // Add padding
        const padding = 50;

        // 3. Determine Scale
        const scaleX = (viewportW - padding * 2) / dataW;
        // Logic Y inversion is handled in render transform `translate(0, 900) scale(1, -1)`.
        // Visually, vertical span is same magnitude.
        const scaleY = (viewportH - padding * 2) / dataH;

        const newScale = Math.min(scaleX, scaleY, 2); // Cap max zoom

        // 4. Center
        // Center of Data BBox
        const dataCenterX = minX + dataW / 2;
        const dataCenterY = minY + dataH / 2;

        // We want dataCenter to be at viewportCenter
        // ScreenX = DataX * Scale + ViewX
        // ViewX = ScreenX - DataX * Scale
        const newViewX = (viewportW / 2) - (dataCenterX * newScale);

        // For Y: ScreenY = (900 - DataY) * Scale + ViewY
        // ViewY = ScreenY - (900 - DataY) * Scale
        const newViewY = (viewportH / 2) - ((900 - dataCenterY) * newScale);

        setViewState({ scale: newScale, x: newViewX, y: newViewY });
    };


    const [copiedObjects, setCopiedObjects] = useState<BoxObject[]>([]);
    const importFileRef = React.useRef<HTMLInputElement>(null);

    // Keyboard navigation & Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            // COPY: Ctrl+C
            if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                if (selectedIds.size > 0) {
                    const objsToCopy = objects.filter(obj => selectedIds.has(obj.id));
                    if (objsToCopy.length > 0) {
                        setCopiedObjects(objsToCopy);
                        console.log("Copied", objsToCopy.length, "objects");
                    }
                }
                return;
            }

            // PASTE: Ctrl+V
            if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
                if (copiedObjects.length > 0) {
                    const newIds = new Set<string>();
                    const newObjs = copiedObjects.map(obj => {
                        const newId = `${obj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        newIds.add(newId);
                        return {
                            ...obj,
                            id: newId,
                            x: obj.x + 20,
                            y: obj.y - 20, // Offset slightly
                            label: obj.label
                        };
                    });

                    setObjects(prev => [...prev, ...newObjs]);
                    setSelectedIds(newIds); // Select pasted objects
                }
                return;
            }

            if (selectedIds.size === 0) return;

            // Arrow keys to move object
            const step = e.shiftKey ? 10 : 1; // Hold Shift for 10px steps
            let dx = 0;
            let dy = 0;
            let handled = false;

            switch (e.key) {
                case 'Delete':
                case 'Backspace':
                    setObjects(prev => prev.filter(obj => !selectedIds.has(obj.id)));
                    setSelectedIds(new Set());
                    return; // Exit early as object is deleted
                case 'ArrowLeft':
                    dx = -step;
                    handled = true;
                    break;
                case 'ArrowRight':
                    dx = step;
                    handled = true;
                    break;
                case 'ArrowUp':
                    dy = step; // Y inverted? No, based on previous logic ArrowUp increased Y? Let's check. 
                    // Previous: newY += step for ArrowUp. 
                    // If Y is inverted (900-y), then +y moves Up. 
                    handled = true;
                    break;
                case 'ArrowDown':
                    dy = -step;
                    handled = true;
                    break;
            }

            if (handled) {
                e.preventDefault();
                setObjects(prev =>
                    prev.map(obj =>
                        selectedIds.has(obj.id) ? { ...obj, x: obj.x + dx, y: obj.y + dy } : obj
                    )
                );
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, objects, copiedObjects]); // Added copiedObjects dependency

    // DEBUG: Early return position 2 REMOVED

    // Auto-Save LogicedObjects dependency

    // --- Interaction Handlers ---

    // 1. Canvas Mouse Down (Pan or Marquee)
    // 1. Canvas Mouse Down (Pan or Marquee)
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // Middle Click or Space+Drag -> Pan
        if (e.button === 1 || (e.button === 0 && e.shiftKey && !e.ctrlKey)) {
            handlePanStart(e);
            return;
        }

        // Left Click on Empty Space -> Start Marquee or Deselect
        if (e.button === 0) {
            // If not holding Control, clear selection
            if (!e.ctrlKey) {
                setSelectedIds(new Set());
            }

            // Start Marquee
            selectionStartRef.current = { x: e.clientX, y: e.clientY }; // Store screen coords for rect drawing
            // However, marquee rect should probably be in screen coords for overlay?
            // Let's use screen coords for the selectionBox state
            setSelectionBox({ x: e.clientX, y: e.clientY, w: 0, h: 0, isCrossing: false });
        }
    };

    const handleBoxMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Stop canvas from handling this

        // Multi-select logic
        if (e.ctrlKey || e.shiftKey) {
            // Toggle selection
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
        } else {
            if (!selectedIds.has(id)) {
                setSelectedIds(new Set([id]));
            }
        }

        if (isAuthorized) {
            isDraggingRef.current = true;
        }
    };

    // 3. Global Mouse Move    // --- Marquee Selection & Pan ---
    const handleGlobalMouseMove = (e: React.MouseEvent) => {
        // Handle Pan
        if (panState.current.isPanning) {
            handlePanMove(e);
            return;
        }

        // Handle Marquee
        if (selectionStartRef.current && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const startX = selectionStartRef.current.x - rect.left;
            const startY = selectionStartRef.current.y - rect.top;
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            const isCrossing = currentX < startX; // Right to Left -> Crossing

            setSelectionBox({
                x: Math.min(startX, currentX), // Store as relative coords
                y: Math.min(startY, currentY),
                w: Math.abs(currentX - startX),
                h: Math.abs(currentY - startY),
                isCrossing
            });
        }
    };

    // 4. Global Mouse Up
    const handleGlobalMouseUp = (e: React.MouseEvent) => {
        handlePanEnd();

        if (isDraggingRef.current) {
            isDraggingRef.current = false;
        }

        // Finalize Marquee
        if (selectionStartRef.current && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const startX = selectionStartRef.current.x - rect.left;
            const startY = selectionStartRef.current.y - rect.top;
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            // Recalculate exact box to avoid state lag
            const sbX = Math.min(startX, currentX);
            const sbY = Math.min(startY, currentY);
            const sbW = Math.abs(currentX - startX);
            const sbH = Math.abs(currentY - startY);
            const isCrossing = currentX < startX;

            // Threshold to distinguish click vs drag
            if (sbW > 2 || sbH > 2) {
                const newSelected = new Set(e.ctrlKey ? selectedIds : []);

                objects.forEach(obj => {
                    // Calculate Object Bounds in Screen Space (Relative to SVG Container)
                    // obj.x is World Coordinate.
                    // viewState.x is Pan Offset (in Screen Pixels).
                    const objScreenCenterX = obj.x * viewState.scale + viewState.x;
                    const objScreenCenterY = (900 - obj.y) * viewState.scale + viewState.y;

                    // Estimate Object Width/Height in Screen Pixels
                    let objW = 0, objH = 0;
                    if (obj.type === 'circle') {
                        objW = objH = (obj.diameter || 100) * viewState.scale;
                    } else if (obj.type === 'text') {
                        // Improved Text Estimation for Arial
                        // Average char width is ~0.6em. 
                        // We use 0.55 to be slightly more forgiving (smaller box -> easier to select)
                        objW = ((obj.text || '').length * (obj.fontSize || 16) * 0.55) * viewState.scale;
                        objH = ((obj.fontSize || 16) * 1.0) * viewState.scale; // tighter height
                    } else {
                        objW = (obj.width || 100) * viewState.scale;
                        objH = (obj.height || 100) * viewState.scale;
                    }

                    // Calculate Object Bounding Box (Top-Left based)
                    const objMinX = objScreenCenterX - objW / 2;
                    const objMaxX = objScreenCenterX + objW / 2;
                    const objMinY = objScreenCenterY - objH / 2;
                    const objMaxY = objScreenCenterY + objH / 2;

                    // Selection Box Bounds
                    const selMinX = sbX;
                    const selMaxX = sbX + sbW;
                    const selMinY = sbY;
                    const selMaxY = sbY + sbH;

                    let isSelected = false;

                    if (isCrossing) {
                        // Crossing Selection (Green): Any Intersection
                        const noOverlap = objMinX > selMaxX || objMaxX < selMinX || objMinY > selMaxY || objMaxY < selMinY;
                        isSelected = !noOverlap;
                    } else {
                        // Window Selection (Blue): Fully Inside
                        // Use a tiny epsilon for float comparison safety
                        const EPSILON = 1.0;
                        isSelected = (objMinX >= selMinX - EPSILON) &&
                            (objMaxX <= selMaxX + EPSILON) &&
                            (objMinY >= selMinY - EPSILON) &&
                            (objMaxY <= selMaxY + EPSILON);
                    }

                    if (isSelected) {
                        newSelected.add(obj.id);
                    }
                });
                setSelectedIds(newSelected);
            }

            setSelectionBox(null);
            selectionStartRef.current = null;
        }

        isDraggingRef.current = false;
        setSnapLines([]); // Clear guides on mouse up
    };


    const handleDrag = (id: string, newX: number, newY: number) => {
        // Find moving object
        const movingObj = objects.find(o => o.id === id);
        if (!movingObj) return;

        // Calculate delta for the LEADER object
        let finalX = newX;
        let finalY = newY; // Note: newY is already rounded from DraggableBox

        // SNAP LOGIC (Only if single object dragging for now, or use leader for group snap)
        // Let's allow group snap based on the one being dragged.

        const SNAP_THRESHOLD = 5 / viewState.scale; // 5 screen pixels converted to world units? 
        // Actually, snap threshold should be constant in SCREEN pixels usually, 
        // but here coordinates are World. 
        // If zoomed out (scale small), 5px screen is huge world distance.
        // If zoomed in (scale large), 5px screen is tiny world distance.
        // Let's use constant 5 WORLD units for stability or Scale dependent?
        // Let's use Scale dependent: 10 / scale.
        const THRESHOLD = 10 / viewState.scale;

        const newLines: { x1: number, y1: number, x2: number, y2: number }[] = [];

        // Temporarily construct the "proposed" object to check fit
        // Note: Dimensions might need to be passed if dynamic?
        // We reuse getObjBounds with proposed X/Y.
        const proposedObj = { ...movingObj, x: finalX, y: finalY };
        const myBounds = getObjBounds(proposedObj);

        let snappedX = finalX;
        let snappedY = finalY;
        let isSnappedX = false;
        let isSnappedY = false;

        // Check against other objects
        // We only verify against unselected objects to avoid snapping to self-group
        const others = objects.filter(o => !selectedIds.has(o.id));

        for (const other of others) {
            const otherBounds = getObjBounds(other);

            // Horizontal Snapping (X-axis alignment) -> Vertical Lines
            if (!isSnappedX) {
                // Center to Center
                if (Math.abs(myBounds.centerX - otherBounds.centerX) < THRESHOLD) {
                    snappedX = otherBounds.centerX;
                    isSnappedX = true;
                    newLines.push({ x1: otherBounds.centerX, y1: Math.min(myBounds.minY, otherBounds.minY) - 20, x2: otherBounds.centerX, y2: Math.max(myBounds.maxY, otherBounds.maxY) + 20 });
                }
                // Left to Left
                else if (Math.abs(myBounds.minX - otherBounds.minX) < THRESHOLD) {
                    snappedX = otherBounds.minX + (myBounds.centerX - myBounds.minX); // shift center
                    isSnappedX = true;
                    newLines.push({ x1: otherBounds.minX, y1: Math.min(myBounds.minY, otherBounds.minY) - 20, x2: otherBounds.minX, y2: Math.max(myBounds.maxY, otherBounds.maxY) + 20 });
                }
                // Right to Right
                else if (Math.abs(myBounds.maxX - otherBounds.maxX) < THRESHOLD) {
                    snappedX = otherBounds.maxX - (myBounds.maxX - myBounds.centerX);
                    isSnappedX = true;
                    newLines.push({ x1: otherBounds.maxX, y1: Math.min(myBounds.minY, otherBounds.minY) - 20, x2: otherBounds.maxX, y2: Math.max(myBounds.maxY, otherBounds.maxY) + 20 });
                }
                // Left to Right
                else if (Math.abs(myBounds.minX - otherBounds.maxX) < THRESHOLD) {
                    snappedX = otherBounds.maxX + (myBounds.centerX - myBounds.minX);
                    isSnappedX = true;
                    newLines.push({ x1: otherBounds.maxX, y1: Math.min(myBounds.minY, otherBounds.minY) - 20, x2: otherBounds.maxX, y2: Math.max(myBounds.maxY, otherBounds.maxY) + 20 });
                }
                // Right to Left
                else if (Math.abs(myBounds.maxX - otherBounds.minX) < THRESHOLD) {
                    snappedX = otherBounds.minX - (myBounds.maxX - myBounds.centerX);
                    isSnappedX = true;
                    newLines.push({ x1: otherBounds.minX, y1: Math.min(myBounds.minY, otherBounds.minY) - 20, x2: otherBounds.minX, y2: Math.max(myBounds.maxY, otherBounds.maxY) + 20 });
                }
            }

            // Vertical Snapping (Y-axis alignment) -> Horizontal Lines
            if (!isSnappedY) {
                // Center to Center
                if (Math.abs(myBounds.centerY - otherBounds.centerY) < THRESHOLD) {
                    snappedY = otherBounds.centerY;
                    isSnappedY = true;
                    newLines.push({ x1: Math.min(myBounds.minX, otherBounds.minX) - 20, y1: otherBounds.centerY, x2: Math.max(myBounds.maxX, otherBounds.maxX) + 20, y2: otherBounds.centerY });
                }
                // Top to Top
                else if (Math.abs(myBounds.maxY - otherBounds.maxY) < THRESHOLD) {
                    snappedY = otherBounds.maxY - (myBounds.maxY - myBounds.centerY);
                    // Wait, Y increases downwards in logic?
                    // DraggableBox: transform(x, y). 
                    // Logic: maxY is top? No, usually Y up in Math, but SVG Y down. 
                    // DraggableBox: transform={`translate(${x}, ${y})`}.
                    // The getObjBounds uses y +/- h/2.
                    // It doesn't matter direction as long as consistent.
                    isSnappedY = true;
                    newLines.push({ x1: Math.min(myBounds.minX, otherBounds.minX) - 20, y1: otherBounds.maxY, x2: Math.max(myBounds.maxX, otherBounds.maxX) + 20, y2: otherBounds.maxY });
                }
                // Bottom to Bottom
                else if (Math.abs(myBounds.minY - otherBounds.minY) < THRESHOLD) {
                    snappedY = otherBounds.minY + (myBounds.centerY - myBounds.minY);
                    isSnappedY = true;
                    newLines.push({ x1: Math.min(myBounds.minX, otherBounds.minX) - 20, y1: otherBounds.minY, x2: Math.max(myBounds.maxX, otherBounds.maxX) + 20, y2: otherBounds.minY });
                }
            }
        }

        setSnapLines(newLines);

        const deltaX = snappedX - movingObj.x;
        const deltaY = snappedY - movingObj.y;

        setObjects(prev =>
            prev.map(o => {
                if (selectedIds.has(o.id)) {
                    // All selected move by same delta
                    return { ...o, x: o.x + deltaX, y: o.y + deltaY };
                }
                return o;
            })
        );
    };

    // ... (Old handlers need updating or removing) ...
    /* 
    const handleCanvasClick ... -> Replaced by handleCanvasMouseDown/Up logic
    const handleBoxClick ... -> Replaced by handleBoxMouseDown
    */

    const handleDataChange = (dataCallback: (prev: BoxObject[]) => BoxObject[]) => {
        setObjects(dataCallback);
    };

    const handleAddBox = (type: 'rectangle' | 'circle' | 'text' | 'slice' = 'rectangle') => {
        const newId = `${type}-${Date.now()}`;

        // Calculate spawn position (Top-Left of Viewport + Padding)
        const padding = 100; // Little bit more padding to be safe
        // ScreenX = WorldX * Scale + ViewX => WorldX = (ScreenX - ViewX) / Scale
        const spawnX = (padding - viewState.x) / viewState.scale;

        // Y-Inversion: ScreenY = (900 - WorldY) * Scale + ViewY => WorldY = 900 - (ScreenY - ViewY) / Scale
        const spawnY = 900 - (padding - viewState.y) / viewState.scale;

        let newBox: BoxObject;

        if (type === 'text') {
            newBox = {
                id: newId,
                x: spawnX,
                y: spawnY,
                label: `Text ${objects.length + 1}`,
                color: '#000000',
                type: 'text',
                text: 'New Text',
                fontSize: 24,
                fontFamily: 'Arial',
                fontColor: '#000000',
                fontWeight: 'normal',
                fontStyle: 'normal',
            };
        } else if (type === 'circle') {
            newBox = {
                id: newId,
                x: spawnX,
                y: spawnY,
                label: `Phase ${objects.length + 1}`,
                color: COLORS[objects.length % COLORS.length],
                type: 'circle',
                diameter: 100,
                status: 'not_started'
            };
        } else if (type === 'slice') {
            newBox = {
                id: newId,
                x: spawnX,
                y: spawnY,
                label: `Slide ${objects.length + 1}`,
                color: COLORS[objects.length % COLORS.length],
                type: 'slice',
                width: 220,
                height: 60,
                status: 'not_started',
                parts: 10,
                totalQuantity: 100,
                actualQuantity: 20,
                inProgressQuantity: 30,
                planQuantity: 40,
                orient: 'horizontal',
                direction: 'ltr'
            };
        } else {
            newBox = {
                id: newId,
                x: spawnX,
                y: spawnY,
                label: `Block ${objects.length + 1}`,
                color: COLORS[objects.length % COLORS.length],
                type: 'rectangle',
                width: 150,
                height: 100,
                status: 'not_started'
            };
        }

        setObjects(prev => [...prev, newBox]);
        setSelectedIds(new Set([newId])); // Select new object
    };

    const handleDeleteBox = () => {
        if (selectedIds.size === 0) return;
        setObjects(prev => prev.filter(obj => !selectedIds.has(obj.id)));
        setSelectedIds(new Set());
    };

    // Helper for batch update
    const updateSelectedObjects = (updates: Partial<BoxObject>) => {
        setObjects(prev =>
            prev.map(obj =>
                selectedIds.has(obj.id) ? { ...obj, ...updates } : obj
            )
        );
    };

    // 5. Double Click to Edit Text
    const handleBoxDoubleClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        requestEditObjectText(id);
    };

    const requestEditObjectText = (id: string) => {
        const obj = objects.find(o => o.id === id);
        if (!obj) return;

        const currentText = obj.type === 'text' ? (obj.text || '') : obj.label;
        // Use a small timeout to allow UI to update if needed/event to settle
        setTimeout(() => {
            const newText = prompt("Edit Text:", currentText);
            if (newText !== null && newText !== currentText) {
                setObjects(prev => prev.map(o => {
                    if (o.id === id) {
                        return o.type === 'text'
                            ? { ...o, text: newText, label: newText }
                            : { ...o, label: newText };
                    }
                    return o;
                }));
            }
        }, 10);
    };

    const handleChangeLabel = (newLabel: string) => {
        if (selectedIds.size === 0) return;
        // Batch update
        setObjects(prev =>
            prev.map(obj => {
                if (selectedIds.has(obj.id)) {
                    if (obj.type === 'text') {
                        // For text objects, label update should also update text content
                        return { ...obj, label: newLabel, text: newLabel };
                    }
                    return { ...obj, label: newLabel };
                }
                return obj;
            })
        );
    };

    const handleChangeId = (newId: string) => {
        // Only allow if single selected
        if (primarySelectedId !== null && selectedIds.size === 1) {
            // If empty string, allow typing but don't commit yet (avoid locking input)
            if (newId === '') {
                setObjects(prev =>
                    prev.map(obj =>
                        obj.id === primarySelectedId ? { ...obj, id: '' } : obj
                    )
                );
                setSelectedIds(new Set(['']));
                return;
            }
            if (objects.some(obj => obj.id === newId && obj.id !== primarySelectedId)) {
                alert('ID already exists!');
                return;
            }
            setObjects(prev =>
                prev.map(obj =>
                    obj.id === primarySelectedId ? { ...obj, id: newId } : obj
                )
            );
            setSelectedIds(new Set([newId]));
        }
    };

    const handleChangePosition = (newX: number, newY: number) => {
        // If setting explicit pos, should they all stack? 
        // Or move relative? 
        // UI usually shows pos of primary selected. 
        // If changed, usually absolute move for primary, others relative? 
        // Or absolute for all (stacking)? 
        // Let's implement absolute for all (stacking) for now as it's simple "Batch Edit" behavior
        updateSelectedObjects({ x: newX, y: newY });
    };

    const handleChangeColor = (newColor: string) => {
        updateSelectedObjects({ color: newColor });
    };

    const handleChangeDimensions = (updates: Partial<BoxObject>) => {
        updateSelectedObjects(updates);
    };

    const handleChangeStatus = (newStatus: 'not_started' | 'in_progress' | 'completed' | 'planned') => {
        setObjects(prev =>
            prev.map(obj => {
                if (!selectedIds.has(obj.id)) return obj;

                // Logic: If switching TO completed, set default date if missing
                let updates: Partial<BoxObject> = { status: newStatus };
                if (newStatus === 'completed' && !obj.completionDate) {
                    updates.completionDate = new Date().toISOString().split('T')[0];
                }

                return { ...obj, ...updates };
            })
        );
    };

    // Primary Selected Obj for UI
    const selectedObject = objects.find(obj => obj.id === primarySelectedId) || (selectedIds.size > 0 ? objects.find(o => o.id === Array.from(selectedIds)[0]) : null);

    const [boqData, setBoqData] = useState<BOQItem[]>([]);
    const [showBOQModal, setShowBOQModal] = useState(false);
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const handleBOQSyncUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !propDiagramId || !projectId) {
            if (e.target) e.target.value = '';
            return;
        }

        try {
            setIsSyncingBOQ(true);
            toast.info('Đang đồng bộ BOQ và gán cho các block...');
            const res = await syncDiagramBOQ(projectId, propDiagramId, file);

            if (res.status === 'success') {
                setSyncReport({
                    boq_count: res.boq_count,
                    blocks_synced: res.blocks_synced,
                    sync_report: res.sync_report,
                    boq_warnings: res.boq_warnings
                });
                setShowSyncReport(true);
                toast.success('Đồng bộ BOQ thành công!');
                // Fetch data again to refresh objects state from backend
                fetchDiagramData();
            }
        } catch (error: any) {
            console.error('BOQ Sync Error:', error);
            const detailError = extractErrorMessage(error.response?.data?.detail);
            const msg = detailError || error.response?.data?.message || error.message || 'Lỗi khi đồng bộ BOQ';
            toast.error(msg);
            alert(msg);
        } finally {
            setIsSyncingBOQ(false);
            if (e.target) e.target.value = '';
        }
    };
    // Auto-calculate BOQ values based on object status
    // ... (keep useEffect as is) ...

    const handleExportBOQ = () => {
        if (boqData.length === 0) return;

        // 1. Prepare Data
        const header = [
            'Mã hiệu', 'TT', 'Nội dung công việc', 'ĐVT',
            'KL Thiết kế', 'KL Thực hiện', 'KL Kế hoạch',
            'Đơn giá', 'Giá trị Hợp đồng', 'GT Thực hiện', 'GT Kế hoạch'
        ];

        const rows = boqData.map(item => [
            item.id,
            item.order,
            item.name,
            item.unit,
            item.designQty,
            item.actualQty,
            item.planQty,
            item.unitPrice,
            item.contractAmount,
            item.actualAmount,
            item.planAmount
        ]);

        // Total Row
        const totals = [
            'TỔNG CỘNG', '', '', '',
            boqData.reduce((s, i) => s + (i.designQty || 0), 0),
            boqData.reduce((s, i) => s + (i.actualQty || 0), 0),
            boqData.reduce((s, i) => s + (i.planQty || 0), 0),
            '',
            boqData.reduce((s, i) => s + (i.contractAmount || 0), 0),
            boqData.reduce((s, i) => s + (i.actualAmount || 0), 0),
            boqData.reduce((s, i) => s + (i.planAmount || 0), 0),
        ];

        const data = [header, ...rows, totals];

        // 2. Create Workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Adjust column widths (rough estimate)
        ws['!cols'] = [
            { wch: 10 }, { wch: 5 }, { wch: 40 }, { wch: 10 },
            { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "BOQ_Report");

        // 3. Download
        XLSX.writeFile(wb, `BOQ_Tracking_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };
    React.useEffect(() => {
        if (boqData.length === 0) return;

        let hasChanges = false;
        const newBoqData = boqData.map(item => {
            let actualQty = 0;
            let planQty = 0;

            // Iterate all objects to aggregate quantities
            objects.forEach(obj => {
                if (obj.boqIds && obj.boqIds[item.id]) {
                    const qty = obj.boqIds[item.id];
                    if (obj.status === 'completed') {
                        actualQty += qty;
                    } else if (obj.status === 'planned') {
                        planQty += qty;
                    }
                }
            });

            // Calculate amounts
            const actualAmount = actualQty * item.unitPrice;
            const planAmount = planQty * item.unitPrice;

            // Check if values changed to avoid infinite loop
            if (item.actualQty !== actualQty || item.planQty !== planQty ||
                item.actualAmount !== actualAmount || item.planAmount !== planAmount) {
                hasChanges = true;
                return { ...item, actualQty, planQty, actualAmount, planAmount };
            }
            return item;
        });

        if (hasChanges) {
            setBoqData(newBoqData);
        }
    }, [objects, boqData]); // Dependencies: objects (status/data changed) or boqData (initial load)

    const handleSaveBOQAssignment = (data: { [id: string]: number }) => {
        if (selectedIds.size === 0) return;
        setObjects(prev => prev.map(obj =>
            selectedIds.has(obj.id) ? { ...obj, boqIds: data } : obj
        ));
        // No need to close here, component calls onClose which we handle to set false
    };

    const [currentDiagramId, setCurrentDiagramId] = useState<number | null>(propDiagramId ?? null);

    // Sync currentDiagramId when prop changes from parent
    React.useEffect(() => {
        if (propDiagramId !== undefined && propDiagramId !== currentDiagramId) {
            console.log(`[Sync] propDiagramId changed: ${propDiagramId}. Updating state...`);
            setCurrentDiagramId(propDiagramId);
            isFirstLoad.current = true; // Trigger data fetch for new ID
        }
    }, [propDiagramId]);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
    const [localDiagramName, setLocalDiagramName] = useState<string>(diagramName || 'Sơ đồ thi công');
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const lastSavedData = React.useRef({ objects: '', boqData: '' });
    const isSavingRef = React.useRef(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const isFirstLoad = React.useRef(true);


    const fetchDiagramData = async () => {
        try {
            let diagramData = null;

            if (currentDiagramId) {
                // v1.3: Load specific diagram by ID
                diagramData = await getDiagram(currentDiagramId);
            } else {
                // Fallback: fetch list and pick latest
                const data = await getDiagrams(projectId ? parseInt(projectId) : undefined);
                if (data && data.length > 0) {
                    diagramData = data.sort((a: any, b: any) =>
                        new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
                    )[0];
                }
            }

            if (diagramData) {
                const loadedObjects = JSON.parse(diagramData.objects || '[]');
                const parsedBoq = JSON.parse(diagramData.boq_data || '[]');
                const loadedBoq = Array.isArray(parsedBoq) ? parsedBoq : [];

                if (diagramData.name) setLocalDiagramName(diagramData.name);
                if (diagramData.updated_at) setLastUpdated(diagramData.updated_at);

                if (JSON.stringify(loadedObjects) !== lastSavedData.current.objects ||
                    JSON.stringify(loadedBoq) !== lastSavedData.current.boqData) {

                    setObjects(loadedObjects);
                    setBoqData(loadedBoq);

                    lastSavedData.current = {
                        objects: JSON.stringify(loadedObjects),
                        boqData: JSON.stringify(loadedBoq)
                    };
                    console.log("Real-time data synced!");
                }

                if (isFirstLoad.current) {
                    setCurrentDiagramId(diagramData.id);
                    handleFitToScreen(loadedObjects);
                    isFirstLoad.current = false;
                }
            }
        } catch (err) {
            console.error("Failed to load initial diagram", err);
            // Note: We don't set isFirstLoad to false here to allow retry
            // if it was a transient network error.
        }
    };

    // 1. Auto-Load on Mount or ID change
    React.useEffect(() => {
        fetchDiagramData();
    }, [currentDiagramId]);

    // 1.5 Real-time Websocket Connection
    React.useEffect(() => {
        if (!currentDiagramId) return;

        // Build ws url based on current API URL (support https -> wss)
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/^http/, 'ws') || `ws://${window.location.host}/api/v1`;
        const wsUrl = `${baseUrl}/diagrams/ws/${currentDiagramId}`;

        console.log(`[WS] Connecting to ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("[WS] Connected for real-time sync!");
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.event === "diagram_updated" || msg.event === "new_diagram") {
                    console.log("[WS] Received update signal.");
                    
                    // CRITICAL: If we are CURRENTLY saving, ignore the update signal
                    // to prevent fetching "old" data before our save is fully finished.
                    if (isSavingRef.current) {
                        console.log("[WS] Ignoring update signal because we are currently saving...");
                        return;
                    }

                    // Only fetch if we are not actively dragging to avoid interrupting user
                    if (!isDraggingRef.current) {
                        console.log("[WS] Fetching new data due to update signal...");
                        setSyncMessage("Dữ liệu vừa được cập nhật bởi người dùng khác...");
                        fetchDiagramData();
                        setTimeout(() => setSyncMessage(null), 3000);
                    }
                }
            } catch (e) {
                console.error("[WS] Error parsing message", e);
            }
        };

        ws.onclose = () => {
            console.log("[WS] Connection closed.");
        };

        // Cleanup on unmount
        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };
    }, [currentDiagramId]);

    const handleForceSave = async (customObjects?: BoxObject[], customBoqData?: any[]) => {
        if (isSavingRef.current) {
            console.log("[Save] Already saving, skipping redundant request.");
            return;
        }

        const objectsToSave = customObjects || objects;
        const boqToSave = customBoqData || boqData;
        
        const currentObjectsStr = JSON.stringify(objectsToSave);
        const currentBoqStr = JSON.stringify(boqToSave);

        // Don't save if it's the same as what we last saved
        if (currentObjectsStr === lastSavedData.current.objects && 
            currentBoqStr === lastSavedData.current.boqData) {
            console.log("[Save] No changes detected, skipping save.");
            return;
        }

        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (!token) return;

        isSavingRef.current = true;
        setSaveStatus('saving');
        console.log(`[Save] Starting save for diagram ${currentDiagramId || 'NEW'}...`);

        const payload: any = {
            objects: currentObjectsStr,
            boq_data: currentBoqStr,
            project_id: projectId ? parseInt(projectId) : null
        };

        try {
            let data;
            if (currentDiagramId) {
                data = await updateDiagram(currentDiagramId, payload);
            } else {
                payload.name = localDiagramName;
                payload.description = 'Saved manually or via import';
                data = await createDiagram(payload);
            }

            if (data) {
                console.log("[Save] Success! Received ID:", data.id);
                if (!currentDiagramId) setCurrentDiagramId(data.id);
                if (data.updated_at) setLastUpdated(data.updated_at);
                
                // Update tracker IMMEDIATELY
                lastSavedData.current = {
                    objects: currentObjectsStr,
                    boqData: currentBoqStr
                };
                
                setSaveStatus('saved');
                // Return data for chain calls
                return data;
            }
        } catch (err) {
            console.error("[Save] Manual save failed", err);
            setSaveStatus('error');
            throw err;
        } finally {
            // Delay releasing the lock slightly to let backend/ws settle
            setTimeout(() => {
                isSavingRef.current = false;
            }, 1000);
        }
    };

    // 2. Debounced Auto-Save
    React.useEffect(() => {
        if (isFirstLoad.current || isSavingRef.current) {
            // console.log("[AutoSave] Busy or first load, skipping check.");
            return;
        }

        const currentObjectsStr = JSON.stringify(objects);
        const currentBoqStr = JSON.stringify(boqData);

        // Check if actually changed
        if (currentObjectsStr === lastSavedData.current.objects &&
            currentBoqStr === lastSavedData.current.boqData) {
            return;
        }

        console.log("[AutoSave] Change detected. Scheduling save in 2s...");

        const timer = setTimeout(async () => {
            if (isSavingRef.current) return;
            try {
                await handleForceSave();
            } catch (err) {
                // Error handled in handleForceSave
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [objects, boqData, currentDiagramId]);

    // --- Array Feature ---
    const [showArrayPanel, setShowArrayPanel] = useState(false); // Using inline panel instead of modal
    const [arrayParams, setArrayParams] = useState({ rows: 1, cols: 5, distX: 150, distY: 100 });

    // --- Layering Logic ---
    const handleLayering = (action: 'front' | 'back' | 'forward' | 'backward') => {
        if (selectedIds.size === 0) return;

        // If multiple selected, we treat them as a group relative to others?
        // Or just move each one?
        // Simple approach: Sort selected items by current index, then move them.
        // Actually, easier to create a new array.

        let newObjects = [...objects];
        const selectedIndices = newObjects
            .map((obj, index) => ({ obj, index }))
            .filter(item => selectedIds.has(item.obj.id))
            .sort((a, b) => a.index - b.index); // Keep relative order of selected items

        // Remove selected items from array
        newObjects = newObjects.filter(obj => !selectedIds.has(obj.id));
        const selectedObjs = selectedIndices.map(i => i.obj);

        if (action === 'front') {
            // Push all selected to end
            newObjects.push(...selectedObjs);
        } else if (action === 'back') {
            // Unshift all selected to start
            newObjects.unshift(...selectedObjs);
        } else if (action === 'forward') {
            // Complex: Move each selected item one step up if possible
            // Re-insert into original positions + 1
            // Easier approach for specific tool:
            // Just standard "Move Up" usually implies reordering. 
            // Let's stick to simplest useful: If 1 item selected, swap.
            // If multiple, maybe just 'front'/'back' is enough for now?
            // Re-implementing 'forward' for group is tricky.
            // For now, let's just support Front/Back fully, and Forward/Backward for single item.
            if (selectedIds.size === 1) {
                const idx = objects.findIndex(o => o.id === selectedObjs[0].id);
                if (idx < objects.length - 1) {
                    const temp = objects[idx];
                    const next = objects[idx + 1];
                    // Swap in a copy
                    const copy = [...objects];
                    copy[idx] = next;
                    copy[idx + 1] = temp;
                    newObjects = copy;
                } else {
                    // Already at top, restore
                    newObjects = objects; // No change
                }
            } else {
                // Fallback for multi: Just bring to front
                newObjects.push(...selectedObjs);
            }
        } else if (action === 'backward') {
            if (selectedIds.size === 1) {
                const idx = objects.findIndex(o => o.id === selectedObjs[0].id);
                if (idx > 0) {
                    const temp = objects[idx];
                    const prev = objects[idx - 1];
                    const copy = [...objects];
                    copy[idx] = prev;
                    copy[idx - 1] = temp;
                    newObjects = copy;
                } else {
                    newObjects = objects;
                }
            } else {
                // Fallback for multi: Send to back
                newObjects.unshift(...selectedObjs);
            }
        }

        setObjects(newObjects);
    };

    const handleArrayObject = () => {
        if (selectedIds.size === 0) return;

        const { rows, cols, distX, distY } = arrayParams;
        if (rows < 1 || cols < 1) {
            alert("Vui lòng nhập số hàng và số cột >= 1");
            return;
        }

        const newObjects: BoxObject[] = [];
        const targets = objects.filter(o => selectedIds.has(o.id));

        // For each selected object, create grid
        targets.forEach(baseObj => {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Skip the original object at (0,0)
                    if (r === 0 && c === 0) continue;

                    const newId = `${baseObj.id}_arr_${Date.now()}_r${r}_c${c}_${Math.random().toString(36).substr(2, 5)}`;
                    const newObj: BoxObject = {
                        ...baseObj,
                        id: newId,
                        x: baseObj.x + (c * distX),
                        y: baseObj.y + (r * distY),
                        label: baseObj.label
                    };
                    newObjects.push(newObj);
                }
            }
        });

        if (newObjects.length > 0) {
            setObjects(prev => [...prev, ...newObjects]);
            setShowArrayPanel(false);
            // Optionally select new objects?
        }
    };

    // --- Export & Import Diagram (JSON) ---
    const handleExportDiagram = () => {
        const exportData = {
            format: 'diagram_export',
            version: '1.0',
            exported_at: new Date().toISOString(),
            diagram_name: diagramName || 'diagram',
            objects: objects,
            boq_data: boqData,
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(diagramName || 'diagram').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportDiagram = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!window.confirm(`Nhập dữ liệu từ file "${file.name}" sẽ GHI ĐÈ toàn bộ sơ đồ hiện tại. Tiếp tục?`)) {
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const raw = ev.target?.result as string;
                const parsed = JSON.parse(raw);
                if (parsed.format !== 'diagram_export') {
                    alert('File không đúng định dạng sơ đồ!');
                    return;
                }
                
                const newObjects = parsed.objects || [];
                const newBoqData = parsed.boq_data || [];
                
                // 1. Update component state
                setObjects(newObjects);
                setBoqData(newBoqData);
                setSelectedIds(new Set());
                
                // 2. Block auto-save momentarily during state update
                isFirstLoad.current = true; 
                
                // 3. Force save to server immediately
                try {
                    await handleForceSave(newObjects, newBoqData);
                    alert(`Nhập và lưu thành công! ${newObjects.length} objects, ${newBoqData.length} BOQ items.`);
                } catch (saveErr) {
                    alert('Dữ liệu đã nhập vào giao diện nhưng lỗi khi lưu lên server. Vui lòng thử nhấn lưu lại.');
                } finally {
                    setTimeout(() => { isFirstLoad.current = false; }, 500);
                }
            } catch (e) {
                alert('Lỗi đọc file JSON. Vui lòng kiểm tra lại!');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    return (
        <div className="w-full h-full min-h-[500px] bg-gray-100 relative flex overflow-hidden">
            {/* Mobile Toggle Button (Floating) */}
            <button
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="lg:hidden absolute top-4 left-4 z-50 bg-white/95 p-3 rounded-full shadow-lg border border-gray-200 text-blue-700 hover:bg-blue-50 focus:outline-none transition-colors"
                title="Mở Bảng Điều Khiển"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>

            {/* Backdrop for Mobile */}
            {isPanelOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
                    onClick={() => setIsPanelOpen(false)}
                />
            )}

            {/* Properties Panel - Left  */}
            <div className={`
                absolute lg:relative z-40 h-full w-72 bg-white shadow-xl border-r border-gray-200 overflow-auto transition-transform duration-300 ease-in-out
                ${isPanelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-3">
                    {/* Top Actions Row */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {isAuthenticated && (
                            <div>
                                <input
                                    type="file"
                                    ref={boqFileInputRef}
                                    onChange={handleBOQSyncUpload}
                                    accept=".xls,.xlsx"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => boqFileInputRef.current?.click()}
                                    disabled={isSyncingBOQ}
                                    className="w-full px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors disabled:opacity-50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="3" y1="9" x2="21" y2="9"></line>
                                        <line x1="3" y1="15" x2="21" y2="15"></line>
                                        <line x1="9" y1="3" x2="9" y2="21"></line>
                                        <line x1="15" y1="3" x2="15" y2="21"></line>
                                    </svg>
                                    {isSyncingBOQ ? 'Đang tải...' : 'Update BOQ'}
                                </button>
                            </div>
                        )}
                        {boqData.length > 0 && (
                            <button
                                onClick={() => setShowBOQModal(true)}
                                className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors"
                                title="Xem bảng BOQ chi tiết"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                Xem BOQ
                            </button>
                        )}
                        {boqData.length === 0 && <div />} {/* Spacer if only upload button exists */}

                        {/* Export / Import JSON Buttons */}
                        <div className="col-span-2 grid grid-cols-2 gap-1 mt-1">
                            <button
                                onClick={handleExportDiagram}
                                className="px-2 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors"
                                title="Xuất sơ đồ ra file JSON"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Xuất JSON
                            </button>
                            <button
                                onClick={() => importFileRef.current?.click()}
                                className="px-2 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors"
                                title="Nhập sơ đồ từ file JSON"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                Nhập JSON
                            </button>
                            <input
                                ref={importFileRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleImportDiagram}
                            />
                        </div>
                    </div>

                    {/* Diagram Name Header */}
                    <div className="mb-3 border-b pb-2 flex justify-between items-center bg-gray-50 p-2 rounded-t-md">
                        <div className="flex flex-col">
                            <h2 className="text-sm font-bold text-gray-800 truncate" title={localDiagramName}>
                                {localDiagramName}
                            </h2>
                            {lastUpdated && (
                                <span className="text-[10px] text-gray-400">
                                    Cập nhật: {new Date(lastUpdated).toLocaleString('vi-VN')}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-white border">
                            {saveStatus === 'saving' && <span className="text-blue-500 animate-pulse">⏳ Đang lưu...</span>}
                            {saveStatus === 'saved' && <span className="text-emerald-500">✓ Đã lưu</span>}
                            {saveStatus === 'error' && <span className="text-red-500">⚠ Lỗi lưu</span>}
                            {saveStatus === 'idle' && <span className="text-gray-400">-</span>}
                        </div>
                    </div>

                    {/* Add Buttons */}
                    {isAuthorized && (
                        <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-600 mb-1">Add Object:</p>
                            <div className="grid grid-cols-4 gap-1">
                                <button
                                    onClick={() => handleAddBox('rectangle')}
                                    className="px-1 py-1.5 text-[11px] bg-green-500 text-white rounded hover:bg-green-600 font-semibold border border-green-600 shadow-sm transition-colors text-center"
                                >
                                    + Rect
                                </button>
                                <button
                                    onClick={() => handleAddBox('circle')}
                                    className="px-1 py-1.5 text-[11px] bg-blue-500 text-white rounded hover:bg-blue-600 font-semibold border border-blue-600 shadow-sm transition-colors text-center"
                                >
                                    + Circle
                                </button>
                                <button
                                    onClick={() => handleAddBox('slice')}
                                    className="px-1 py-1.5 text-[11px] bg-teal-500 text-white rounded hover:bg-teal-600 font-semibold border border-teal-600 shadow-sm transition-colors text-center"
                                >
                                    + Slide
                                </button>
                                <button
                                    onClick={() => handleAddBox('text')}
                                    className="px-1 py-1.5 text-[11px] bg-purple-500 text-white rounded hover:bg-purple-600 font-semibold border border-purple-600 shadow-sm transition-colors text-center"
                                >
                                    + Text
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modify Selected Object Section for Batch Edit */}
                    {isAuthorized && selectedIds.size > 0 && selectedObject && (
                        <div className="space-y-2">
                            <div className="pt-2 border-t">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-xs mb-1">
                                            {selectedIds.size > 1 ? `Multiple (${selectedIds.size})` : selectedObject?.label}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {selectedIds.size > 1 ? 'Batch Editing' : '⌨️ Arrow keys to move'}
                                        </p>
                                    </div>
                                    {selectedIds.size >= 1 && (
                                        <button
                                            onClick={() => setShowAssignmentModal(true)}
                                            className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-200 font-semibold flex items-center gap-1"
                                            title="Gán dữ liệu thi công"
                                        >
                                            ➕ Data
                                        </button>
                                    )}
                                </div>

                                {/* ... Keep the rest of properties panel logic but adapted ... */}
                                {/* For batch edit, we just show simple fields. If single, show all. */}

                                {/* Tools Actions - Show for both Single and Multi? Array is OK for multi? Maybe not yet. */}
                                {selectedIds.size > 0 && (
                                    <div className="mb-3">
                                        <button
                                            onClick={() => setShowArrayPanel(!showArrayPanel)}
                                            className={`w-full px-2 py-1.5 text-xs border rounded font-semibold flex items-center justify-center gap-1 transition-colors ${showArrayPanel ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            ⛓️ Array {selectedIds.size > 1 ? 'Group' : 'Object'} {showArrayPanel ? '▼' : '▶'}
                                        </button>

                                        {/* Inline Array Panel */}
                                        {showArrayPanel && (
                                            <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-100 text-xs space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                {/* ... Array inputs ... */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-gray-600 mb-1">Số hàng</label>
                                                        <input
                                                            type="number"
                                                            value={arrayParams.rows}
                                                            onChange={(e) => setArrayParams(p => ({ ...p, rows: Math.max(1, Number(e.target.value)) }))}
                                                            className="w-full px-2 py-1 border rounded bg-white"
                                                            min="1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-600 mb-1">Khoảng cách hàng</label>
                                                        <input
                                                            type="number"
                                                            value={arrayParams.distY}
                                                            onChange={(e) => setArrayParams(p => ({ ...p, distY: Number(e.target.value) }))}
                                                            className="w-full px-2 py-1 border rounded bg-white"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-gray-600 mb-1">Số cột</label>
                                                        <input
                                                            type="number"
                                                            value={arrayParams.cols}
                                                            onChange={(e) => setArrayParams(p => ({ ...p, cols: Math.max(1, Number(e.target.value)) }))}
                                                            className="w-full px-2 py-1 border rounded bg-white"
                                                            min="1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-600 mb-1">Khoảng cách cột</label>
                                                        <input
                                                            type="number"
                                                            value={arrayParams.distX}
                                                            onChange={(e) => setArrayParams(p => ({ ...p, distX: Number(e.target.value) }))}
                                                            className="w-full px-2 py-1 border rounded bg-white"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={handleArrayObject}
                                                    className="w-full mt-2 px-2 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 font-bold shadow-sm"
                                                >
                                                    Tạo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Layering Controls (Z-Index) */}
                                {selectedIds.size > 0 && (
                                    <div className="mb-3">
                                        <label className="text-xs text-gray-600 mb-1 block">Xếp lớp (Layering)</label>
                                        <div className="grid grid-cols-4 gap-1">
                                            <button
                                                onClick={() => handleLayering('front')}
                                                className="p-1 text-xs border rounded hover:bg-gray-100 active:bg-gray-200 active:scale-90 transition-transform flex justify-center items-center"
                                                title="Lên trên cùng (Bring to Front)"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="m5 9 7-7 7 7" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleLayering('forward')}
                                                className="p-1 text-xs border rounded hover:bg-gray-100 active:bg-gray-200 active:scale-90 transition-transform flex justify-center items-center"
                                                title="Lên 1 lớp (Bring Forward)"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleLayering('backward')}
                                                className="p-1 text-xs border rounded hover:bg-gray-100 active:bg-gray-200 active:scale-90 transition-transform flex justify-center items-center"
                                                title="Xuống 1 lớp (Send Backward)"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleLayering('back')}
                                                className="p-1 text-xs border rounded hover:bg-gray-100 active:bg-gray-200 active:scale-90 transition-transform flex justify-center items-center"
                                                title="Xuống dưới cùng (Send to Back)"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20" /><path d="m19 15-7 7-7-7" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}


                                <div className="space-y-2">
                                    {/* Common Properties */}
                                    <div>
                                        <label className="text-xs text-gray-600">ID</label>
                                        <input
                                            type="text"
                                            value={selectedIds.size === 1 ? selectedObject?.id : '(Multiple IDs)'}
                                            disabled={selectedIds.size > 1}
                                            onChange={(e) => handleChangeId(e.target.value)}
                                            className="w-full px-2 py-1 text-xs border rounded disabled:bg-gray-100 disabled:text-gray-400"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs text-gray-600">Label</label>
                                            {selectedIds.size === 1 && (
                                                <button
                                                    onClick={() => requestEditObjectText(Array.from(selectedIds)[0])}
                                                    className="text-[10px] bg-gray-200 px-1 rounded hover:bg-gray-300"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={selectedIds.size === 1 ? selectedObject?.label : ''}
                                            placeholder={selectedIds.size > 1 ? '(Enter to batch update labels)' : ''}
                                            onChange={(e) => handleChangeLabel(e.target.value)}
                                            className="w-full px-2 py-1 text-xs border rounded"
                                        />
                                    </div>

                                    {/* Conditional properties based on type */}
                                    {selectedObject.type === 'text' ? (
                                        /* Text Properties */
                                        <>
                                            <div className="grid grid-cols-2 gap-1">
                                                <div>
                                                    <label className="text-xs text-gray-600">Size</label>
                                                    <input
                                                        type="number"
                                                        value={selectedObject.fontSize}
                                                        onChange={(e) => handleChangeDimensions({ fontSize: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-xs border rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-600">Color</label>
                                                    <input
                                                        type="color"
                                                        value={selectedObject.fontColor || selectedObject.color}
                                                        onChange={(e) => {
                                                            const newColor = e.target.value;
                                                            if (selectedObject.type === 'text') {
                                                                handleChangeDimensions({ fontColor: newColor, color: newColor });
                                                            } else {
                                                                handleChangeColor(newColor);
                                                            }
                                                        }}
                                                        className="w-full h-8 p-0 border rounded"
                                                    />
                                                </div>
                                            </div>
                                            {/* Font Style Buttons */}
                                            <div className="grid grid-cols-2 gap-1">
                                                <button
                                                    onClick={() => handleChangeDimensions({ fontWeight: selectedObject.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                                    className={`px-2 py-1 text-xs rounded border ${selectedObject.fontWeight === 'bold'
                                                        ? 'bg-gray-700 text-white'
                                                        : 'hover:border-gray-400'
                                                        }`}
                                                >
                                                    <strong>B</strong>
                                                </button>
                                                <button
                                                    onClick={() => handleChangeDimensions({ fontStyle: selectedObject.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                                    className={`px-2 py-1 text-xs rounded border ${selectedObject.fontStyle === 'italic'
                                                        ? 'bg-gray-700 text-white'
                                                        : 'hover:border-gray-400'
                                                        }`}
                                                >
                                                    <em>I</em>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        /* Rect/Circle/Slice Properties */
                                        <>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <div>
                                                    <label className="text-xs text-gray-600">
                                                        {selectedObject.type === 'rectangle' || selectedObject.type === 'slice' ? 'Width' : 'Diameter'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={selectedObject.width || selectedObject.diameter || ''}
                                                        onChange={(e) => handleChangeDimensions({ width: Number(e.target.value), diameter: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-xs border rounded"
                                                    />
                                                </div>
                                                {(selectedObject.type === 'rectangle' || selectedObject.type === 'slice') && (
                                                    <div>
                                                        <label className="text-xs text-gray-600">Height</label>
                                                        <input
                                                            type="number"
                                                            value={selectedObject.height || ''}
                                                            onChange={(e) => handleChangeDimensions({ height: Number(e.target.value) })}
                                                            className="w-full px-2 py-1 text-xs border rounded"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Slice specific properties */}
                                            {selectedObject.type === 'slice' && (
                                                <div className="pt-2 border-t border-gray-200 mb-2 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs font-semibold text-teal-700">❖ Slide Settings (Stacked)</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <div className="flex items-center h-5">
                                                                <label className="text-xs text-gray-600">Tổng KL</label>
                                                            </div>
                                                            <input
                                                                type="number" min={1}
                                                                value={selectedObject.totalQuantity ?? 100}
                                                                onChange={(e) => {
                                                                    const val = Math.max(1, Number(e.target.value));
                                                                    handleChangeDimensions({
                                                                        totalQuantity: val,
                                                                        // Giới hạn các giá trị con không vượt quá total mới (logic này có thể linh hoạt, tạm thời cho an toàn)
                                                                        actualQuantity: Math.min(selectedObject.actualQuantity || 0, val)
                                                                    });
                                                                }}
                                                                className="w-full px-2 py-1 text-xs border rounded"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between items-center h-5">
                                                                <label className="text-xs text-green-700 font-semibold">Hoàn thành</label>
                                                                <button
                                                                    onClick={() => {
                                                                        const isOpen = !selectedObject.isHistoryOpen;
                                                                        let newHistory = selectedObject.actualHistory;
                                                                        // Nếu chưa có mảng history bao giờ, tạo array rỗng khi bấm +
                                                                        if (isOpen && (!newHistory)) {
                                                                            newHistory = [];
                                                                        }
                                                                        handleChangeDimensions({ isHistoryOpen: isOpen, actualHistory: newHistory });
                                                                    }}
                                                                    className={`text-xs px-1.5 py-0.5 rounded font-bold leading-none border ${selectedObject.isHistoryOpen ? 'bg-green-500 text-white border-green-600' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'}`}
                                                                    title="Lịch sử đợt thi công"
                                                                >
                                                                    {selectedObject.isHistoryOpen ? '−' : '+'}
                                                                </button>
                                                            </div>
                                                            <input
                                                                type="number" min={0}
                                                                value={selectedObject.actualQuantity ?? 0}
                                                                disabled={!!(selectedObject.actualHistory && selectedObject.actualHistory.length > 0)}
                                                                onChange={(e) => {
                                                                    const val = Math.min(Number(e.target.value), selectedObject.totalQuantity || 100);
                                                                    handleChangeDimensions({ actualQuantity: val });
                                                                }}
                                                                className={`w-full px-2 py-1 text-xs border rounded ${selectedObject.actualHistory && selectedObject.actualHistory.length > 0 ? 'bg-gray-100 text-gray-500 border-gray-300' : 'border-green-300 bg-green-50'}`}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* History Panel */}
                                                    {selectedObject.isHistoryOpen && selectedObject.actualHistory && (
                                                        <div className="mt-2 p-2 bg-gray-50 border border-green-200 rounded text-xs space-y-2 relative shadow-inner">
                                                            <div className="font-semibold text-green-800 flex justify-between border-b border-green-200 pb-1 items-center">
                                                                <span>Bảng nhập đợt thi công:</span>
                                                                <span className="bg-green-100 px-1.5 py-0.5 rounded">Tổng: {selectedObject.actualHistory.reduce((s, item) => s + item.quantity, 0).toFixed(2)}</span>
                                                            </div>

                                                            {selectedObject.actualHistory.length === 0 && (
                                                                <div className="text-center text-gray-500 py-2 italic opacity-70">Chưa có dữ liệu thi công</div>
                                                            )}

                                                            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                                                                {selectedObject.actualHistory.map((item, idx) => (
                                                                    <div key={item.id} className="flex gap-1 items-center bg-white p-1 rounded border border-gray-200 shadow-sm transition-all hover:border-green-300">
                                                                        <input
                                                                            type="date"
                                                                            value={item.date}
                                                                            onChange={(e) => {
                                                                                const newHistory = [...selectedObject.actualHistory!];
                                                                                newHistory[idx].date = e.target.value;
                                                                                handleChangeDimensions({ actualHistory: newHistory });
                                                                            }}
                                                                            className="w-[105px] px-1 py-0.5 border rounded text-[11px] outline-none focus:border-green-400"
                                                                        />
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            value={item.quantity}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                const newHistory = [...selectedObject.actualHistory!];
                                                                                newHistory[idx].quantity = val;
                                                                                const newTotal = newHistory.reduce((s, h) => s + h.quantity, 0);
                                                                                handleChangeDimensions({
                                                                                    actualHistory: newHistory,
                                                                                    actualQuantity: Math.min(newTotal, selectedObject.totalQuantity || 100)
                                                                                });
                                                                            }}
                                                                            className="flex-1 px-1 py-0.5 border rounded w-12 text-[11px] outline-none focus:border-green-400 font-medium text-green-700"
                                                                            placeholder="KL"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newHistory = selectedObject.actualHistory!.filter(h => h.id !== item.id);
                                                                                const newTotal = newHistory.reduce((s, h) => s + h.quantity, 0);
                                                                                handleChangeDimensions({
                                                                                    actualHistory: newHistory,
                                                                                    actualQuantity: newHistory.length > 0 ? Math.min(newTotal, selectedObject.totalQuantity || 100) : (selectedObject.actualQuantity || 0)
                                                                                });
                                                                            }}
                                                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 px-1.5 py-0.5 rounded font-bold text-sm transition-colors"
                                                                            title="Xóa đợt này"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const newHistory = [...(selectedObject.actualHistory || [])];
                                                                    newHistory.push({ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], quantity: 0 });
                                                                    handleChangeDimensions({ actualHistory: newHistory });
                                                                }}
                                                                className="w-full text-xs bg-green-100 text-green-700 py-1.5 rounded hover:bg-green-200 font-semibold border border-green-300 border-dashed transition-colors flex items-center justify-center gap-1 mt-2"
                                                            >
                                                                <span>+</span> Thêm đợt mới
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                                        <div>
                                                            <label className="text-[10px] text-gray-600 text-blue-700 font-semibold">Đang làm</label>
                                                            <input
                                                                type="number" min={0}
                                                                value={selectedObject.inProgressQuantity ?? 0}
                                                                onChange={(e) => {
                                                                    const val = Math.min(Number(e.target.value), selectedObject.totalQuantity || 100);
                                                                    handleChangeDimensions({ inProgressQuantity: val });
                                                                }}
                                                                className="w-full px-2 py-1 text-xs border rounded border-blue-300 bg-blue-50"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-gray-600 text-orange-700 font-semibold">Kế hoạch</label>
                                                            <input
                                                                type="number" min={0}
                                                                value={selectedObject.planQuantity ?? 0}
                                                                onChange={(e) => {
                                                                    const val = Math.min(Number(e.target.value), selectedObject.totalQuantity || 100);
                                                                    handleChangeDimensions({ planQuantity: val });
                                                                }}
                                                                className="w-full px-2 py-1 text-xs border rounded border-orange-300 bg-orange-50"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 mb-1 block">Orientation</label>
                                                            <select
                                                                value={selectedObject.orient || 'horizontal'}
                                                                onChange={(e) => {
                                                                    const val = e.target.value as 'horizontal' | 'vertical';
                                                                    handleChangeDimensions({
                                                                        orient: val,
                                                                        direction: val === 'horizontal' ? 'ltr' : 'ttb' // default matching direction
                                                                    });
                                                                }}
                                                                className="w-full px-1 py-1 text-[11px] border rounded bg-white"
                                                            >
                                                                <option value="horizontal">↔ Ngang</option>
                                                                <option value="vertical">↕ Dọc</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 mb-1 block">Direction</label>
                                                            <select
                                                                value={selectedObject.direction || 'ltr'}
                                                                onChange={(e) => handleChangeDimensions({ direction: e.target.value as any })}
                                                                className="w-full px-1 py-1 text-[11px] border rounded bg-white"
                                                            >
                                                                {(!selectedObject.orient || selectedObject.orient === 'horizontal') ? (
                                                                    <>
                                                                        <option value="ltr">← Trái → Phải</option>
                                                                        <option value="rtl">→ Phải → Trái</option>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <option value="ttb">↓ Trên → Dưới</option>
                                                                        <option value="btt">↑ Dưới → Trên</option>
                                                                    </>
                                                                )}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Status - Workflow tracking */}
                                            {selectedObject.type !== 'slice' && (
                                                <div>
                                                    <label className="text-xs text-gray-600">Status</label>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        <button
                                                            onClick={() => handleChangeStatus('not_started')}
                                                            className={`px-2 py-1.5 text-xs rounded border ${selectedObject.status === 'not_started'
                                                                ? 'bg-gray-400 text-white border-gray-500'
                                                                : 'bg-white hover:border-gray-400'
                                                                }`}
                                                        >
                                                            Chưa thực hiện
                                                        </button>
                                                        <button
                                                            onClick={() => handleChangeStatus('in_progress')}
                                                            className={`px-2 py-1.5 text-xs rounded border ${selectedObject.status === 'in_progress'
                                                                ? 'bg-blue-500 text-white border-blue-600'
                                                                : 'bg-white hover:border-gray-400'
                                                                }`}
                                                        >
                                                            Đang thực hiện
                                                        </button>
                                                        <button
                                                            onClick={() => handleChangeStatus('completed')}
                                                            className={`px-2 py-1.5 text-xs rounded border ${selectedObject.status === 'completed'
                                                                ? 'bg-green-500 text-white border-green-600'
                                                                : 'bg-white hover:border-gray-400'
                                                                }`}
                                                        >
                                                            Đã hoàn thành
                                                        </button>
                                                        <button
                                                            onClick={() => handleChangeStatus('planned')}
                                                            className={`px-2 py-1.5 text-xs rounded border ${selectedObject.status === 'planned'
                                                                ? 'bg-orange-500 text-white border-orange-600'
                                                                : 'bg-white hover:border-gray-400'
                                                                }`}
                                                        >
                                                            Kế hoạch
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Completion Date (Only if completed) */}
                                            {resolveBoxProgress(selectedObject).status === 'completed' && (
                                                <div className="pt-2 border-t">
                                                    <label className="text-xs text-gray-600 mb-1 block">Ngày hoàn thành</label>
                                                    <input
                                                        type="date"
                                                        value={selectedObject.completionDate || ''}
                                                        onChange={(e) => handleChangeDimensions({ completionDate: e.target.value })}
                                                        className="w-full px-2 py-1 text-xs border rounded bg-green-50"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <button
                                        onClick={handleDeleteBox}
                                        className="w-full px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pie Chart - Always Visible */}
                <div className="border-t pt-2 mt-2">
                    {(() => {
                        // Calculate Stats on the fly
                        const totalContract = boqData.reduce((sum, item) => sum + (item.contractAmount || 0), 0);

                        // Initialize metrics
                        let completed = 0;
                        let inProgress = 0; // Not used in chart slice but calculated
                        let planned = 0;

                        const warnings: string[] = [];

                        // Iterate through all objects and sum up value based on BOQ assignment
                        objects.forEach(obj => {
                            if (obj.boqIds) {
                                Object.entries(obj.boqIds).forEach(([bId, qty]) => {
                                    const boqItem = boqData.find(b => b.id === bId);
                                    if (boqItem && boqItem.unitPrice) {
                                        const val = Number(qty) * Number(boqItem.unitPrice);

                                        // Check for suspicious values (e.g., single object > 120% of total contract, or just massive)
                                        if (val > totalContract * 1.2 && totalContract > 0) {
                                            warnings.push(`⚠️ Obj "${obj.label}": Illegal Value ${(val / totalContract).toFixed(0)}x Total! Check Qty.`);
                                        }

                                        if (obj.type === 'slice') {
                                            // Phân bổ tỷ lệ (hệ số) dựa trên các thành phần quantity.
                                            const total = obj.totalQuantity || 1;
                                            // Đảm bảo không vượt qúa 1
                                            const actRatio = Math.min(Math.max((obj.actualQuantity || 0) / total, 0), 1);
                                            const progRatio = Math.min(Math.max((obj.inProgressQuantity || 0) / total, 0), 1);
                                            const planRatio = Math.min(Math.max((obj.planQuantity || 0) / total, 0), 1);

                                            completed += val * actRatio;
                                            planned += val * (progRatio + planRatio);
                                            inProgress += val * progRatio; // Tính chơi để debug nếu cần, gộp lên planned
                                        } else {
                                            if (obj.status === 'completed') {
                                                completed += val;
                                            } else if (obj.status === 'planned' || obj.status === 'in_progress') {
                                                planned += val;
                                            }
                                        }
                                    }
                                });
                            }
                        });

                        // Calculate Remaining
                        const assignedTotal = completed + planned;
                        const remaining = Math.max(0, totalContract - assignedTotal);

                        const chartData = [
                            { label: 'Thực hiện', value: completed, color: '#10b981' },
                            { label: 'Kế hoạch', value: planned, color: '#f59e0b' },
                            { label: 'Còn lại', value: remaining, color: 'transparent', isEmpty: true }
                        ];

                        return (
                            <div>
                                <StatusPieChart data={chartData} total={totalContract} unit={boqData.length > 0 ? 'VND' : ''} />
                                {warnings.length > 0 && (
                                    <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800 max-h-40 overflow-y-auto">
                                        <strong>Data Errors Detected:</strong>
                                        <ul className="list-disc pl-4 mt-1">
                                            {warnings.slice(0, 10).map((w, i) => (
                                                <li key={i}>{w}</li>
                                            ))}
                                            {warnings.length > 10 && <li>...and {warnings.length - 10} more</li>}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Progress Dashboard - Below Pie Chart */}
                <ProgressDashboard objects={objects} />
            </div>

            {/* Canvas - Right */}
            <div className="flex-1 relative bg-gray-100 overflow-hidden cursor-crosshair">
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    style={{ cursor: panState.current.isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleGlobalMouseMove}
                    onMouseUp={handleGlobalMouseUp}
                    onMouseLeave={handleGlobalMouseUp}
                >
                    <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ddd" strokeWidth="0.5" />
                        </pattern>
                    </defs>

                    {/* Transform Group for Zoom/Pan */}
                    <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                        {/* Huge background rect for Grid */}
                        <rect id="canvas-bg" x={-5000} y={-5000} width={10000} height={10000} fill="url(#grid)" />

                        {/* Objects Layer - Y-inverted as before */}
                        <g transform="translate(0, 900) scale(1, -1)">
                            {objects.map(obj => {
                                const { status: effectiveStatus, progressPct } = resolveBoxProgress(obj);
                                return (
                                    <DraggableBox
                                        key={obj.id}
                                        id={obj.id}
                                        x={obj.x}
                                        y={obj.y}
                                        label={obj.label}
                                        color={obj.color}
                                        type={obj.type}
                                        width={obj.width}
                                        height={obj.height}
                                        diameter={obj.diameter}
                                        parts={obj.parts}
                                        totalQuantity={obj.totalQuantity}
                                        actualQuantity={obj.actualQuantity}
                                        inProgressQuantity={obj.inProgressQuantity}
                                        planQuantity={obj.planQuantity}
                                        orient={obj.orient}
                                        direction={obj.direction}
                                        text={obj.text}
                                        fontSize={obj.fontSize}
                                        fontFamily={obj.fontFamily}
                                        fontColor={obj.fontColor}
                                        fontWeight={obj.fontWeight}
                                        fontStyle={obj.fontStyle}
                                        status={effectiveStatus}
                                        isSelected={selectedIds.has(obj.id)}
                                        onMouseDown={(e) => handleBoxMouseDown(e, obj.id)}
                                        onDrag={handleDrag}
                                        onDoubleClick={(e) => handleBoxDoubleClick(e, obj.id)}
                                        scale={viewState.scale}
                                    />
                                );
                            })}
                        </g>

                        {/* Selection Box Overlay (REMOVED DUPLICATE) */}
                    </g>

                    {/* Render Selection Box in Screen Space (outside Transform Group) */}
                    {selectionBox && (
                        <rect
                            x={selectionBox.x}
                            y={selectionBox.y}
                            width={selectionBox.w}
                            height={selectionBox.h}
                            fill={selectionBox.isCrossing ? "rgba(34, 197, 94, 0.2)" : "rgba(59, 130, 246, 0.2)"} // Green/Blue
                            stroke={selectionBox.isCrossing ? "rgba(34, 197, 94, 0.8)" : "rgba(59, 130, 246, 0.8)"}
                            strokeWidth={1}
                            strokeDasharray={selectionBox.isCrossing ? "4 2" : "0"}
                            pointerEvents="none"
                        />
                    )}

                    {/* Render Snap Lines (Global or Local? They are calculated in World Coords, so inside Transform Group is better) */}
                    {/* Wait, my snap lines are World Coords. So I must put them INSIDE the transform group or project them. */}
                    {/* Let's Project them to Screen Space to be safe and crisp 1px lines */}
                    {snapLines.map((line, i) => (
                        <line
                            key={i}
                            x1={line.x1 * viewState.scale + viewState.x}
                            y1={(900 - line.y1) * viewState.scale + viewState.y}
                            x2={line.x2 * viewState.scale + viewState.x}
                            y2={(900 - line.y2) * viewState.scale + viewState.y}
                            stroke="#ef4444"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            pointerEvents="none"
                        />
                    ))}
                </svg>
            </div>
            {/* Notification Area (Save Status & Sync Status) */}
            <div className="absolute top-4 right-4 z-20 pointer-events-none flex flex-col items-end gap-2">
                {saveStatus === 'saving' && (
                    <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-blue-100 flex items-center gap-2 text-xs font-medium text-blue-600 animate-pulse">
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                    </div>
                )}
                {saveStatus === 'saved' && (
                    <div className="bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-green-100 flex items-center gap-2 text-xs font-medium text-green-600 transition-opacity duration-1000">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Saved
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div className="bg-red-50 px-3 py-1.5 rounded-full shadow-sm border border-red-200 flex items-center gap-2 text-xs font-medium text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Save Failed
                    </div>
                )}
                {syncMessage && (
                    <div className="bg-blue-50/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-blue-200 flex items-center gap-2 text-xs font-medium text-blue-700 animate-in fade-in slide-in-from-top-2 duration-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.13 15.57a9 9 0 0 0 16.59 3.43M2.5 22v-6h6M21.87 8.43a9 9 0 0 0-16.59-3.43" /></svg>
                        Đồng bộ mới
                    </div>
                )}
            </div>

            {/* Object Assignment Modal */}
            {
                showAssignmentModal && selectedObject && (
                    <ObjectBOQAssignment
                        objectName={selectedIds.size > 1 ? `Multiple Objects (${selectedIds.size})` : selectedObject.label}
                        masterBoq={boqData}
                        initialData={selectedIds.size > 1 ? {} : selectedObject.boqIds}
                        onSave={handleSaveBOQAssignment}
                        onClose={() => setShowAssignmentModal(false)}
                    />
                )
            }

            <BOQSyncReport
                isOpen={showSyncReport}
                onClose={() => setShowSyncReport(false)}
                reportData={syncReport}
            />

            {/* BOQ Modal - Rendered at root level for proper fullscreen display */}
            {showBOQModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-8">
                    <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-[98vw] max-h-[95vh] flex flex-col">
                        <div className="px-5 py-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">📄 Bảng BOQ Chi tiết</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{boqData.length} hạng mục</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleExportBOQ}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm flex items-center gap-1.5 transition-colors"
                                    title="Xuất Excel"
                                >
                                    💾 Xuất Excel
                                </button>
                                <button
                                    onClick={() => setShowBOQModal(false)}
                                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-sm transition-colors"
                                >
                                    × Đóng
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm">
                                    <tr>
                                        <th className="border border-gray-200 px-3 py-2 text-left font-semibold bg-gray-100">Mã hiệu</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-semibold bg-gray-100 w-10">TT</th>
                                        <th className="border border-gray-200 px-3 py-2 text-left font-semibold bg-gray-100">Nội dung công việc</th>
                                        <th className="border border-gray-200 px-2 py-2 text-center font-semibold bg-gray-100 w-12">ĐVT</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-blue-50 text-blue-700">KL Thiết kế</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-green-50 text-green-700">KL Thực hiện</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-orange-50 text-orange-700">KL Kế hoạch</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-gray-100">Đơn giá</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-gray-100">GT Hợp đồng</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-green-50 text-green-700">GT Thực hiện</th>
                                        <th className="border border-gray-200 px-3 py-2 text-right font-semibold bg-orange-50 text-orange-700">GT Kế hoạch</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {boqData.map((item, index) => (
                                        <tr key={index} className={`hover:bg-blue-50/40 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                            <td className="border border-gray-100 px-3 py-2 font-mono text-gray-500">{item.id}</td>
                                            <td className="border border-gray-100 px-2 py-2 text-center font-medium text-gray-600">{item.order}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-gray-900">{item.name}</td>
                                            <td className="border border-gray-100 px-2 py-2 text-center text-gray-600">{item.unit}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right text-blue-700">{item.designQty?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right font-semibold text-green-700">{item.actualQty?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right text-orange-600">{item.planQty?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right text-gray-600">{item.unitPrice?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right text-gray-700">{item.contractAmount?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right font-bold text-green-700">{item.actualAmount?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                            <td className="border border-gray-100 px-3 py-2 text-right font-bold text-orange-600">{item.planAmount?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                        </tr>
                                    ))}
                                    {/* Total Row */}
                                    <tr className="bg-gray-800 text-white font-bold sticky bottom-0">
                                        <td colSpan={4} className="border border-gray-600 px-3 py-2.5 text-center">TỔNG CỘNG</td>
                                        <td className="border border-gray-600 px-3 py-2.5 text-right">{boqData.reduce((s,i) => s+(i.designQty||0),0).toLocaleString('en-US',{maximumFractionDigits:2})}</td>
                                        <td className="border border-gray-600 px-3 py-2.5 text-right text-green-300">{boqData.reduce((s,i) => s+(i.actualQty||0),0).toLocaleString('en-US',{maximumFractionDigits:2})}</td>
                                        <td className="border border-gray-600 px-3 py-2.5 text-right text-orange-300">{boqData.reduce((s,i) => s+(i.planQty||0),0).toLocaleString('en-US',{maximumFractionDigits:2})}</td>
                                        <td className="border border-gray-600 px-3 py-2.5"></td>
                                        <td className="border border-gray-600 px-3 py-2.5 text-right">{boqData.reduce((s,i) => s+(i.contractAmount||0),0).toLocaleString('en-US',{maximumFractionDigits:0})}</td>
                                        <td className="border border-gray-600 px-3 py-2.5 text-right text-green-300">{boqData.reduce((s,i) => s+(i.actualAmount||0),0).toLocaleString('en-US',{maximumFractionDigits:0})}</td>
                                        <td className="border border-gray-600 px-3 py-2.5 text-right text-orange-300">{boqData.reduce((s,i) => s+(i.planAmount||0),0).toLocaleString('en-US',{maximumFractionDigits:0})}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

