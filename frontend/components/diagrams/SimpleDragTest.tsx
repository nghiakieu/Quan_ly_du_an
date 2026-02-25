"use client";

import React, { useState } from 'react';
import DraggableBox from './DraggableBox';
import ObjectBOQAssignment from './ObjectBOQAssignment';
import StatusPieChart from './StatusPieChart';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth';

interface BoxObject {
    id: string;
    x: number;
    y: number;
    label: string;
    color: string;
    type: 'rectangle' | 'circle' | 'text';
    width?: number;  // For rectangle
    height?: number; // For rectangle
    diameter?: number; // For circle
    // Text properties
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    // Status for workflow (rect/circle only)
    status?: 'not_started' | 'in_progress' | 'completed' | 'planned';
    completionDate?: string; // YYYY-MM-DD
    // BIM Data
    boqIds?: { [boqId: string]: number }; // Map BOQ ID -> Quantity for this object
}

import BOQUploader, { BOQItem } from './BOQUploader';

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
export default function SimpleDragTest({ projectId, diagramId: propDiagramId }: { projectId?: string; diagramId?: number | null }) {
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
    const panState = React.useRef({ isPanning: false, startX: 0, startY: 0, viewStartX: 0, viewStartY: 0 });
    const lastMiddleClickTime = React.useRef(0);

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
        return () => svgEl.removeEventListener('wheel', onWheel);
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

    const handleAddBox = (type: 'rectangle' | 'circle' | 'text' = 'rectangle') => {
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
        // changing ID on multi-select is dangerous/undefined behavior. 
        // Only allow if single selected
        if (primarySelectedId && selectedIds.size === 1) {
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

    const handleBOQLoaded = (data: BOQItem[]) => {
        if (boqData.length > 0) {
            if (!window.confirm('Bạn có chắc muốn thay thế hoàn toàn bảng BOQ hiện tại bằng dữ liệu mới? hành động này không thể hoàn tác.')) {
                return;
            }
        }
        setBoqData(data);
        alert(`Loaded ${data.length} BOQ items successfully!`);
    };



    // Auto-calculate BOQ values based on object status
    // ... (keep useEffect as is) ...

    const handleExportBOQ = () => {
        if (boqData.length === 0) return;

        // 1. Prepare Data
        const header = [
            'ID', 'TT', 'Nội dung công việc', 'ĐVT',
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
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
    const lastSavedData = React.useRef({ objects: '', boqData: '' });
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const isFirstLoad = React.useRef(true);

    // Use custom env or fallback to localhost
    const API_URL = process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL}/diagrams`
        : 'http://localhost:8002/api/v1/diagrams';

    const fetchDiagramData = async () => {
        try {
            let diagramData = null;

            if (currentDiagramId) {
                // v1.3: Load specific diagram by ID
                const res = await fetch(`${API_URL}/${currentDiagramId}`);
                if (res.ok) {
                    diagramData = await res.json();
                }
            } else {
                // Fallback: fetch list and pick latest
                const fetchUrl = projectId ? `${API_URL}?project_id=${projectId}` : API_URL;
                const res = await fetch(fetchUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        diagramData = data.sort((a: { updated_at: string }, b: { updated_at: string }) =>
                            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
                        )[0];
                    }
                }
            }

            if (diagramData) {
                const loadedObjects = JSON.parse(diagramData.objects || '[]');
                const parsedBoq = JSON.parse(diagramData.boq_data || '[]');
                const loadedBoq = Array.isArray(parsedBoq) ? parsedBoq : [];

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
                }
            }
        } catch (err) {
            console.error("Failed to load initial diagram", err);
        } finally {
            if (isFirstLoad.current) {
                setSaveStatus('saved');
                isFirstLoad.current = false;
            }
        }
    };

    // 1. Auto-Load on Mount
    React.useEffect(() => {
        fetchDiagramData();
    }, []);

    // 1.5 Real-time Websocket Connection
    React.useEffect(() => {
        if (!currentDiagramId) return;

        // Build ws url based on current API URL (support https -> wss)
        const baseUrl = API_URL.replace(/^http/, 'ws');
        const wsUrl = `${baseUrl}/ws/${currentDiagramId}`;

        console.log(`[WS] Connecting to ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("[WS] Connected for real-time sync!");
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.event === "diagram_updated" || msg.event === "new_diagram") {
                    console.log("[WS] Received update signal. Fetching new data...");
                    // Only fetch if we are not actively dragging to avoid interrupting user
                    if (!isDraggingRef.current) {
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

    // 2. Debounced Auto-Save
    React.useEffect(() => {
        if (isFirstLoad.current) return;

        const currentObjectsStr = JSON.stringify(objects);
        const currentBoqStr = JSON.stringify(boqData);

        // Check if actually changed
        if (currentObjectsStr === lastSavedData.current.objects &&
            currentBoqStr === lastSavedData.current.boqData) {
            return;
        }

        setSaveStatus('saving');

        const timer = setTimeout(async () => {
            const payload = {
                name: `Diagram ${new Date().toLocaleString()}`, // Or keep original name
                description: 'Auto-saved',
                objects: currentObjectsStr,
                boq_data: currentBoqStr,
                project_id: projectId ? parseInt(projectId) : null
            };

            try {
                // Get token from localStorage since it's client side
                const token = localStorage.getItem('access_token');
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                let res;
                if (currentDiagramId) {
                    // Update existing
                    res = await fetch(`${API_URL}/${currentDiagramId}`, {
                        method: 'PUT',
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
                } else {
                    // Create new
                    res = await fetch(API_URL, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
                }

                if (res.ok) {
                    const data = await res.json();
                    if (!currentDiagramId) setCurrentDiagramId(data.id);

                    lastSavedData.current = {
                        objects: currentObjectsStr,
                        boqData: currentBoqStr
                    };
                    setSaveStatus('saved');
                } else {
                    console.error("Auto-save failed with status", res.status);
                    setSaveStatus('error');
                }
            } catch (err) {
                console.error("Auto-save failed", err);
                setSaveStatus('error');
            }
        }, 1000); // Debounce 1s

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

    return (
        <div className="w-full h-screen bg-gray-100 relative flex">
            {/* Array Modal Removed - Now Inline */}

            {/* Properties Panel - Left  */}
            <div className="w-72 bg-white shadow-lg z-10 overflow-auto">
                <div className="p-3">
                    {/* Top Actions Row */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {isAuthenticated && <BOQUploader onDataLoaded={handleBOQLoaded} />}
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
                    </div>

                    {/* Properties Header */}
                    <div className="mb-3 border-b pb-2">
                        <h2 className="text-base font-bold text-gray-800">
                            Properties
                        </h2>
                    </div>                    {/* BOQ Modal */}
                    {showBOQModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-10">
                            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
                                <div className="p-4 border-b flex justify-between items-center">
                                    <h3 className="text-lg font-bold">Master BOQ Data ({boqData.length} items)</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExportBOQ}
                                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-bold text-sm flex items-center gap-1"
                                            title="Download Excel"
                                        >
                                            💾 Export Excel
                                        </button>
                                        <button
                                            onClick={() => setShowBOQModal(false)}
                                            className="text-gray-500 hover:text-red-500 text-2xl font-bold ml-2"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto bg-white relative">
                                    <table className="w-full text-xs border-collapse border border-gray-300">
                                        <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm">
                                            <tr>
                                                <th className="border p-2 bg-gray-100">ID</th>
                                                <th className="border p-2 bg-gray-100">TT</th>
                                                <th className="border p-2 bg-gray-100">Nội dung công việc</th>
                                                <th className="border p-2 bg-gray-100">ĐVT</th>
                                                <th className="border p-2 bg-gray-100">KL Tkế</th>
                                                <th className="border p-2 bg-gray-100">KL THiện</th>
                                                <th className="border p-2 bg-gray-100">KL KHoạch</th>
                                                <th className="border p-2 bg-gray-100">Đơn giá</th>
                                                <th className="border p-2 bg-gray-100">Giá trị HĐ</th>
                                                <th className="border p-2 bg-gray-100">GT THiện</th>
                                                <th className="border p-2 bg-gray-100">GT KHoạch</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {boqData.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="border p-1 font-mono">{item.id}</td>
                                                    <td className="border p-1 text-center">{item.order}</td>
                                                    <td className="border p-1">{item.name}</td>
                                                    <td className="border p-1 text-center">{item.unit}</td>
                                                    <td className="border p-1 text-right">
                                                        {item.designQty?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="border p-1 text-right font-semibold text-blue-600">
                                                        {item.actualQty?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="border p-1 text-right text-orange-600">
                                                        {item.planQty?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="border p-1 text-right">
                                                        {item.unitPrice?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="border p-1 text-right">
                                                        {item.contractAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="border p-1 text-right font-bold text-green-600">
                                                        {item.actualAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="border p-1 text-right text-orange-600 font-bold">
                                                        {item.planAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Final Total Row */}
                                            <tr className="bg-gray-200 font-bold sticky bottom-0 z-20 shadow-inner">
                                                <td colSpan={4} className="border p-2 text-center bg-gray-200">TỔNG CỘNG</td>
                                                <td className="border p-2 text-right bg-gray-200">
                                                    {boqData.reduce((sum, item) => sum + (item.designQty || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="border p-2 text-right text-blue-700 bg-gray-200">
                                                    {boqData.reduce((sum, item) => sum + (item.actualQty || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="border p-2 text-right text-orange-700 bg-gray-200">
                                                    {boqData.reduce((sum, item) => sum + (item.planQty || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="border p-2 text-right bg-gray-200"></td>
                                                <td className="border p-2 text-right text-black bg-gray-200">
                                                    {boqData.reduce((sum, item) => sum + (item.contractAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="border p-2 text-right text-green-700 bg-gray-200">
                                                    {boqData.reduce((sum, item) => sum + (item.actualAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="border p-2 text-right text-orange-700 bg-gray-200">
                                                    {boqData.reduce((sum, item) => sum + (item.planAmount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
                        <p className="font-semibold">Objects: {objects.length}</p>
                        <p>Selected: {selectedIds.size > 0 ? `${selectedIds.size} items` : 'None'}</p>
                        <p>BOQ Items: {boqData.length}</p>
                    </div>

                    {/* Add Buttons */}
                    {isAuthorized && (
                        <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-600 mb-1">Add Object:</p>
                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    onClick={() => handleAddBox('rectangle')}
                                    className="px-2 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 font-semibold"
                                >
                                    + Rect
                                </button>
                                <button
                                    onClick={() => handleAddBox('circle')}
                                    className="px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 font-semibold"
                                >
                                    + Circle
                                </button>
                                <button
                                    onClick={() => handleAddBox('text')}
                                    className="px-2 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 font-semibold"
                                >
                                    + Text
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modify Selected Object Section for Batch Edit */}
                    {isAuthorized && selectedIds.size > 0 && selectedObject ? (
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
                                        /* Rect/Circle Properties */
                                        <>


                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-xs text-gray-600">
                                                        {selectedObject.type === 'rectangle' ? 'Width' : 'Diameter'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={selectedObject.width || selectedObject.diameter || ''}
                                                        onChange={(e) => handleChangeDimensions({ width: Number(e.target.value), diameter: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-xs border rounded"
                                                    />
                                                </div>
                                                {selectedObject.type === 'rectangle' && (
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

                                            {/* Status - Workflow tracking */}
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

                                            {/* Completion Date (Only if completed) */}
                                            {selectedObject.status === 'completed' && (
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
                    ) : (
                        <div className="mt-auto pt-4 text-center text-gray-400 text-xs italic">
                            Select an object to edit properties
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

                                        if (obj.status === 'completed') {
                                            completed += val;
                                        } else if (obj.status === 'planned' || obj.status === 'in_progress') {
                                            planned += val;
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
            </div>

            {/* Canvas - Right */}
            <div className="flex-1 relative bg-gray-100 overflow-hidden cursor-crosshair">
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    style={{ cursor: panState.current.isPanning ? 'grabbing' : 'grab' }}
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
                            {objects.map(obj => (
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
                                    text={obj.text}
                                    fontSize={obj.fontSize}
                                    fontFamily={obj.fontFamily}
                                    fontColor={obj.fontColor}
                                    fontWeight={obj.fontWeight}
                                    fontStyle={obj.fontStyle}
                                    status={obj.status}
                                    isSelected={selectedIds.has(obj.id)}
                                    // Check if handler exists before passing
                                    onMouseDown={(e) => handleBoxMouseDown(e, obj.id)}
                                    onDrag={handleDrag}
                                    onDoubleClick={(e) => handleBoxDoubleClick(e, obj.id)}

                                    scale={viewState.scale}
                                />
                            ))}
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
        </div >
    );
}

