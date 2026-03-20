import React, { useRef, useEffect, useCallback } from 'react';
import type { Stroke, PenType } from '../types';
import { drawStrokeOnCanvas } from '../utils/drawing';

interface CanvasBoardProps {
    tool: PenType;
    color: string;
    size: number;
    camera: { x: number, y: number, z: number };
    paperScale?: number;
    isFixed?: boolean;
    paperWidth?: number;
    paperHeight?: number;
    strokes: Stroke[];
    onStrokeComplete: (stroke: Stroke) => void;
    onSelection?: (bounds: { x: number, y: number, width: number, height: number } | null) => void;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ 
    tool, color, size, camera, paperScale = 1, isFixed = false, 
    paperWidth, paperHeight, strokes, onStrokeComplete, onSelection 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Use Refs for performance to avoid React render cycle on pointer events
    const strokesRef = useRef<Stroke[]>(strokes);
    const cameraRef = useRef(camera);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const isDrawingRef = useRef(false);
    const needsRedrawRef = useRef(true);

    // Selection state
    const isSelectingRef = useRef(false);
    const selectionStartRef = useRef<{ x: number, y: number } | null>(null);
    const selectionCurrentRef = useRef<{ x: number, y: number } | null>(null);

    // Sync props to refs to avoid stale closures in animation loop
    useEffect(() => {
        strokesRef.current = strokes;
        cameraRef.current = camera;
        needsRedrawRef.current = true;
    }, [strokes, camera]);

    // Main render loop using requestAnimationFrame
    const render = useCallback(() => {
        if (!needsRedrawRef.current) {
            requestAnimationFrame(render);
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) {
            requestAnimationFrame(render);
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            requestAnimationFrame(render);
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Bitmap sizing logic: 
        // Use hardcoded paper dimensions if available for absolute stability
        const targetWidth = (isFixed && paperWidth) ? paperWidth : rect.width / (isFixed ? cameraRef.current.z : 1);
        const targetHeight = (isFixed && paperHeight) ? paperHeight : rect.height / (isFixed ? cameraRef.current.z : 1);

        if (canvas.width !== targetWidth * dpr || canvas.height !== targetHeight * dpr) {
            canvas.width = targetWidth * dpr;
            canvas.height = targetHeight * dpr;
        }

        // Always reset transform to clear the entire physical canvas
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, targetWidth, targetHeight);

        // Apply camera transformation for drawing
        const { x, y, z } = cameraRef.current;
 
        // In fixed mode, the container handles visual translate(x,y) and scale(z).
        // The canvas BITMAP size we set above is already the "un-zoomed" paper size.
        // So we only apply dpr and paperScale here.
        // In infinite mode, we apply both camera zoom (z) and pan (x,y) manually.
        // THE FIX: We MUST subtract the canvas element's screen position (rect.left/top)
        // from the global camera coordinates (x,y) to get the correct local translation.
        const internalScale = isFixed ? (dpr * paperScale) : (dpr * z * paperScale);
        const tx = isFixed ? 0 : (x - rect.left);
        const ty = isFixed ? 0 : (y - rect.top);
 
        ctx.setTransform(internalScale, 0, 0, internalScale, tx * dpr, ty * dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw all finished strokes
        strokesRef.current.forEach((stroke) => {
            drawStrokeOnCanvas(ctx, stroke);
        });

        // Draw the in-progress stroke
        if (currentStrokeRef.current) {
            drawStrokeOnCanvas(ctx, currentStrokeRef.current);
        }

        // Draw selection box
        if (isSelectingRef.current && selectionStartRef.current && selectionCurrentRef.current) {
            const start = selectionStartRef.current;
            const current = selectionCurrentRef.current;
            const width = current.x - start.x;
            const height = current.y - start.y;

            // Draw selection background
            ctx.fillStyle = 'rgba(0, 122, 255, 0.1)'; // Semi-transparent blue
            ctx.fillRect(start.x, start.y, width, height);

            // Draw selection border
            ctx.strokeStyle = '#007aff';
            ctx.lineWidth = 1 / internalScale; // Keep border 1px visually
            ctx.setLineDash([5 / internalScale, 5 / internalScale]);
            ctx.strokeRect(start.x, start.y, width, height);
            ctx.setLineDash([]);
        }

        needsRedrawRef.current = false;
        requestAnimationFrame(render);
    }, []);

    // Start the animation loop once
    useEffect(() => {
        let animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [render]);


    const handlePointerDown = (e: React.PointerEvent) => {
        if (tool === 'text' || tool === 'hand') return; // Don't handle drawing if text or hand tool is active
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Use camera state directly for absolute stability
        const { x: cx, y: cy, z: cz } = cameraRef.current;
        
        // Calculate coordinate relative to the world origin
        // Formula: x = (ScreenX - CameraX) / CameraZ
        // This is viewport-absolute and matches the logic in App.tsx
        const x = (e.clientX - cx) / cz;
        const y = (e.clientY - cy) / cz;
        
        if (tool === 'select') {
            isSelectingRef.current = true;
            selectionStartRef.current = { x, y };
            selectionCurrentRef.current = { x, y };
            if (onSelection) onSelection(null); // Clear previous selection on mousedown
        } else {
            const pressure = e.pressure !== 0 ? e.pressure : 0.5;
            isDrawingRef.current = true;
            currentStrokeRef.current = {
                id: Date.now().toString(),
                points: [{ x, y, pressure }],
                color,
                size,
                tool,
            };
        }

        needsRedrawRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current && !isSelectingRef.current) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Use camera state directly for absolute stability
        const { x: cx, y: cy, z: cz } = cameraRef.current;
        const x = (e.clientX - cx) / cz;
        const y = (e.clientY - cy) / cz;
        
        if (isSelectingRef.current) {
            selectionCurrentRef.current = { x, y };
        } else if (isDrawingRef.current && currentStrokeRef.current) {
            const pressure = e.pressure !== 0 ? e.pressure : 0.5;
            
            if (['rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
                // For shapes, we only need start and end
                currentStrokeRef.current.points = [
                    currentStrokeRef.current.points[0],
                    { x, y, pressure }
                ];
            } else {
                currentStrokeRef.current.points.push({ x, y, pressure });
            }
        }
        
        needsRedrawRef.current = true;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawingRef.current && !isSelectingRef.current) return;

        if (isSelectingRef.current) {
            if (selectionStartRef.current && selectionCurrentRef.current && onSelection) {
                const start = selectionStartRef.current;
                const current = selectionCurrentRef.current;
                
                // Calculate normalized bounds
                const x = Math.min(start.x, current.x);
                const y = Math.min(start.y, current.y);
                const width = Math.abs(current.x - start.x);
                const height = Math.abs(current.y - start.y);
                
                if (width > 5 && height > 5) {
                    onSelection({ x, y, width, height });
                } else {
                    onSelection(null); // Clicked without dragging
                }
            }
            isSelectingRef.current = false;
            // Note: we don't clear selectionStartRef/CurrentRef here immediately to leave the box on screen if needed, 
            // but we might want to clear it if handled elsewhere.
            // For now let's clear it visually when releasing if we want to hand off the selection graphics to the overlay:
            selectionStartRef.current = null;
            selectionCurrentRef.current = null;
        }

        if (isDrawingRef.current) {
            isDrawingRef.current = false;
            if (currentStrokeRef.current) {
                onStrokeComplete(currentStrokeRef.current);
                currentStrokeRef.current = null;
            }
        }

        needsRedrawRef.current = true;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
                width: '100%',
                height: '100%',
                touchAction: 'none',
                display: 'block',
                pointerEvents: tool === 'text' ? 'none' : 'auto',
            }}
        />
    );
};
