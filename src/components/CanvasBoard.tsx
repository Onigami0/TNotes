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
    palmRejectionEnabled?: boolean;
}

export const CanvasBoard: React.FC<CanvasBoardProps> = React.memo(({ 
    tool, color, size, camera, paperScale = 1, isFixed = false, 
    paperWidth, paperHeight, strokes, onStrokeComplete, onSelection,
    palmRejectionEnabled = false
}) => {
    const staticCanvasRef = useRef<HTMLCanvasElement>(null);
    const activeCanvasRef = useRef<HTMLCanvasElement>(null);

    // Local cache for Path2D objects to avoid recalculating simplified paths every frame
    const pathCacheRef = useRef<Map<string, Path2D>>(new Map());

    // Use Refs for performance to avoid React render cycle on pointer events
    const strokesRef = useRef<Stroke[]>(strokes);
    const cameraRef = useRef(camera);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const isDrawingRef = useRef(false);
    
    // Independent redraw flags
    const needsStaticRedrawRef = useRef(true);
    const needsActiveRedrawRef = useRef(true);

    // Selection state
    const isSelectingRef = useRef(false);
    const selectionStartRef = useRef<{ x: number, y: number } | null>(null);
    const selectionCurrentRef = useRef<{ x: number, y: number } | null>(null);

    // Sync props to refs
    useEffect(() => {
        strokesRef.current = strokes;
        cameraRef.current = camera;
        needsStaticRedrawRef.current = true;
        needsActiveRedrawRef.current = true;

        // Clear cache if strokes are empty (e.g. note switch or clear page)
        if (strokes.length === 0) {
            pathCacheRef.current.clear();
        }
    }, [strokes, camera]);

    const setupCanvas = (canvas: HTMLCanvasElement, dpr: number, rect: DOMRect) => {
        const targetWidth = (isFixed && paperWidth) ? paperWidth : rect.width / (isFixed ? cameraRef.current.z : 1);
        const targetHeight = (isFixed && paperHeight) ? paperHeight : rect.height / (isFixed ? cameraRef.current.z : 1);

        if (canvas.width !== targetWidth * dpr || canvas.height !== targetHeight * dpr) {
            canvas.width = targetWidth * dpr;
            canvas.height = targetHeight * dpr;
            return true;
        }
        return false;
    };

    const applyTransform = (ctx: CanvasRenderingContext2D, dpr: number, rect: DOMRect) => {
        const { x, y, z } = cameraRef.current;
        const internalScale = isFixed ? (dpr * paperScale) : (dpr * z * paperScale);
        const tx = isFixed ? 0 : (x - rect.left);
        const ty = isFixed ? 0 : (y - rect.top);
 
        ctx.setTransform(internalScale, 0, 0, internalScale, tx * dpr, ty * dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        return internalScale;
    };

    // Main render loop
    const render = useCallback(() => {
        const staticCanvas = staticCanvasRef.current;
        const activeCanvas = activeCanvasRef.current;
        if (!staticCanvas || !activeCanvas) {
            requestAnimationFrame(render);
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const rect = staticCanvas.getBoundingClientRect();

        // 1. Handle Static Layer (Finished Strokes)
        if (needsStaticRedrawRef.current) {
            setupCanvas(staticCanvas, dpr, rect);
            const ctx = staticCanvas.getContext('2d');
            if (ctx) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, staticCanvas.width / dpr, staticCanvas.height / dpr);
                applyTransform(ctx, dpr, rect);

                // Draw all finished strokes with caching
                strokesRef.current.forEach((stroke) => {
                    const cached = pathCacheRef.current.get(stroke.id);
                    const path = drawStrokeOnCanvas(ctx, stroke, cached);
                    // Store in cache if it's a hand-drawn stroke and wasn't cached before
                    if (path && !cached) {
                        pathCacheRef.current.set(stroke.id, path);
                    }
                });
            }
            needsStaticRedrawRef.current = false;
        }

        // 2. Handle Active Layer (Current Stroke & Selection)
        if (needsActiveRedrawRef.current || isDrawingRef.current || isSelectingRef.current) {
            setupCanvas(activeCanvas, dpr, rect);
            const ctx = activeCanvas.getContext('2d');
            if (ctx) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, activeCanvas.width / dpr, activeCanvas.height / dpr);
                const internalScale = applyTransform(ctx, dpr, rect);

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

                    ctx.fillStyle = 'rgba(0, 122, 255, 0.1)';
                    ctx.fillRect(start.x, start.y, width, height);

                    ctx.strokeStyle = '#007aff';
                    ctx.lineWidth = 1 / internalScale;
                    ctx.setLineDash([5 / internalScale, 5 / internalScale]);
                    ctx.strokeRect(start.x, start.y, width, height);
                    ctx.setLineDash([]);
                }
            }
            // Only stop redrawing active layer if nothing is changing
            if (!isDrawingRef.current && !isSelectingRef.current) {
                needsActiveRedrawRef.current = false;
            }
        }

        requestAnimationFrame(render);
    }, [isFixed, paperWidth, paperHeight, paperScale]);

    // Start the animation loop once
    useEffect(() => {
        let animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [render]);


    const handlePointerDown = (e: React.PointerEvent) => {
        if (tool === 'text' || tool === 'hand') return;
        
        if (palmRejectionEnabled && e.pointerType === 'touch' && !['select'].includes(tool)) {
            return;
        }
        
        const rect = activeCanvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const { x: cx, y: cy, z: cz } = cameraRef.current;
        const x = (e.clientX - cx) / cz;
        const y = (e.clientY - cy) / cz;
        
        if (tool === 'select') {
            isSelectingRef.current = true;
            selectionStartRef.current = { x, y };
            selectionCurrentRef.current = { x, y };
            if (onSelection) onSelection(null);
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

        needsActiveRedrawRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current && !isSelectingRef.current) return;

        const { x: cx, y: cy, z: cz } = cameraRef.current;
        const x = (e.clientX - cx) / cz;
        const y = (e.clientY - cy) / cz;
        
        if (isSelectingRef.current) {
            selectionCurrentRef.current = { x, y };
        } else if (isDrawingRef.current && currentStrokeRef.current) {
            const pressure = e.pressure !== 0 ? e.pressure : 0.5;
            
            if (['rectangle', 'circle', 'line', 'arrow', 'triangle', 'star', 'diamond', 'pentagon', 'hexagon'].includes(tool)) {
                currentStrokeRef.current.points = [
                    currentStrokeRef.current.points[0],
                    { x, y, pressure }
                ];
            } else {
                currentStrokeRef.current.points.push({ x, y, pressure });
            }
        }
        
        needsActiveRedrawRef.current = true;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawingRef.current && !isSelectingRef.current) return;

        if (isSelectingRef.current) {
            if (selectionStartRef.current && selectionCurrentRef.current && onSelection) {
                const start = selectionStartRef.current;
                const current = selectionCurrentRef.current;
                
                const x = Math.min(start.x, current.x);
                const y = Math.min(start.y, current.y);
                const width = Math.abs(current.x - start.x);
                const height = Math.abs(current.y - start.y);
                
                if (width > 5 && height > 5) {
                    onSelection({ x, y, width, height });
                } else {
                    onSelection(null);
                }
            }
            isSelectingRef.current = false;
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

        needsActiveRedrawRef.current = true;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div style={{ 
            width: '100%', 
            height: '100%', 
            position: 'relative',
            pointerEvents: tool === 'text' ? 'none' : 'auto'
        }}>
            <canvas
                ref={staticCanvasRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    pointerEvents: 'none',
                    zIndex: 1
                }}
            />
            <canvas
                ref={activeCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    touchAction: 'none',
                    display: 'block',
                    zIndex: 2
                }}
            />
        </div>
    );
});

CanvasBoard.displayName = 'CanvasBoard';
