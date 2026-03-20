import React, { useEffect, useState } from 'react';
import { Move, Trash2, Sparkles } from 'lucide-react';
import type { Stroke } from '../types';
import type { TextElement } from './TextTool';

interface SelectionOverlayProps {
    selectedStrokes: string[];
    selectedTexts: string[];
    strokes: Stroke[];
    textElements: TextElement[];
    camera: { x: number, y: number, z: number };
    paperScale?: number;
    isFixed?: boolean;
    onMove: (dx: number, dy: number) => void;
    onScale: (sx: number, sy: number, originX: number, originY: number) => void;
    onDelete: () => void;
    onConvertToText?: (strokeIds: string[]) => void;
    onClearSelection: () => void;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
    selectedStrokes,
    selectedTexts,
    strokes,
    textElements,
    camera,
    paperScale = 1,
    isFixed = false,
    onMove,
    onScale,
    onDelete,
    onConvertToText,
    onClearSelection
}) => {
    const [bounds, setBounds] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isScaling, setIsScaling] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (selectedStrokes.length === 0 && selectedTexts.length === 0) {
            setBounds(null);
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Calculate bounds for strokes
        const activeStrokes = strokes.filter(s => selectedStrokes.includes(s.id));
        activeStrokes.forEach(stroke => {
            stroke.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
        });

        // Calculate bounds for texts
        const activeTexts = textElements.filter(t => selectedTexts.includes(t.id));
        activeTexts.forEach(t => {
            minX = Math.min(minX, t.x);
            minY = Math.min(minY, t.y);
            maxX = Math.max(maxX, t.x + 100); 
            maxY = Math.max(maxY, t.y + t.fontSize);
        });

        if (minX !== Infinity) {
            const padding = 10;
            setBounds({
                x: minX - padding,
                y: minY - padding,
                w: (maxX - minX) + padding * 2,
                h: (maxY - minY) + padding * 2
            });
        } else {
            setBounds(null);
        }
    }, [selectedStrokes, selectedTexts, strokes, textElements]);

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setDragStart({ x: clientX, y: clientY });
    };

    const handleScaleStart = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
        e.stopPropagation();
        setIsScaling(handle);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setDragStart({ x: clientX, y: clientY });
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const effectiveScale = camera.z * paperScale;

            if (isDragging) {
                const dx = (clientX - dragStart.x) / effectiveScale;
                const dy = (clientY - dragStart.y) / effectiveScale;
                onMove(dx, dy);
                setDragStart({ x: clientX, y: clientY });
            } else if (isScaling && bounds) {
                const dx = (clientX - dragStart.x) / effectiveScale;
                const dy = (clientY - dragStart.y) / effectiveScale;
                
                let sx = 1;
                let sy = 1;
                let originX = bounds.x;
                let originY = bounds.y;

                if (isScaling === 'br') {
                    sx = (bounds.w + dx) / bounds.w;
                    sy = (bounds.h + dy) / bounds.h;
                    originX = bounds.x;
                    originY = bounds.y;
                } else if (isScaling === 'tr') {
                    originY = bounds.y + bounds.h;
                    sx = (bounds.w + dx) / bounds.w;
                    sy = (bounds.h - dy) / bounds.h;
                } else if (isScaling === 'tl') {
                    originX = bounds.x + bounds.w;
                    originY = bounds.y + bounds.h;
                    sx = (bounds.w - dx) / bounds.w;
                    sy = (bounds.h - dy) / bounds.h;
                } else if (isScaling === 'bl') {
                    originX = bounds.x + bounds.w;
                    sx = (bounds.w - dx) / bounds.w;
                    sy = (bounds.h + dy) / bounds.h;
                }

                // Minimum scale guard
                if (sx > 0.01 && sy > 0.01) {
                    onScale(sx, sy, originX, originY);
                    setDragStart({ x: clientX, y: clientY });
                }
            }
        };

        const handleEnd = () => {
            setIsDragging(false);
            setIsScaling(null);
        };

        if (isDragging || isScaling) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchmove', handleMove);
            window.addEventListener('touchend', handleEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, isScaling, dragStart, camera.z, paperScale, onMove, onScale, bounds]);

    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        width: '12px',
        height: '12px',
        background: 'white',
        border: '2px solid #007aff',
        borderRadius: '50%',
        pointerEvents: 'auto',
        zIndex: 60
    };

    if (!bounds || (selectedStrokes.length === 0 && selectedTexts.length === 0)) return null;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${bounds.x * paperScale}px`,
                top: `${bounds.y * paperScale}px`,
                width: `${bounds.w * paperScale}px`,
                height: `${bounds.h * paperScale}px`,
                border: '2px dashed #007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.05)',
                pointerEvents: 'none',
                zIndex: 50,
            }}
        >
            {/* Resize Handles */}
            <div style={{ ...handleStyle, top: '-6px', left: '-6px', cursor: 'nwse-resize' }} onMouseDown={(e) => handleScaleStart(e, 'tl')} onTouchStart={(e) => handleScaleStart(e, 'tl')} />
            <div style={{ ...handleStyle, top: '-6px', right: '-6px', cursor: 'nesw-resize' }} onMouseDown={(e) => handleScaleStart(e, 'tr')} onTouchStart={(e) => handleScaleStart(e, 'tr')} />
            <div style={{ ...handleStyle, bottom: '-6px', left: '-6px', cursor: 'nesw-resize' }} onMouseDown={(e) => handleScaleStart(e, 'bl')} onTouchStart={(e) => handleScaleStart(e, 'bl')} />
            <div style={{ ...handleStyle, bottom: '-6px', right: '-6px', cursor: 'nwse-resize' }} onMouseDown={(e) => handleScaleStart(e, 'br')} onTouchStart={(e) => handleScaleStart(e, 'br')} />

            <div
                style={{
                    position: 'absolute',
                    top: '-36px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '4px',
                    background: 'var(--toolbar-bg)',
                    backdropFilter: 'blur(10px)',
                    padding: '4px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    pointerEvents: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
            >
                <button
                    style={{ cursor: 'move', padding: '6px', background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex' }}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    title="Taşı"
                >
                    <Move size={16} />
                </button>
                {selectedStrokes.length > 0 && onConvertToText && (
                    <button
                        style={{ cursor: 'pointer', padding: '6px', background: 'none', border: 'none', color: '#007aff', display: 'flex' }}
                        onClick={(e) => { e.stopPropagation(); onConvertToText(selectedStrokes); }}
                        title="Metne Dönüştür"
                    >
                        <Sparkles size={16} />
                    </button>
                )}
                <button
                    style={{ cursor: 'pointer', padding: '6px', background: 'none', border: 'none', color: '#ff3b30', display: 'flex' }}
                    onClick={(e) => { e.stopPropagation(); onDelete(); onClearSelection(); }}
                    title="Sil"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};
