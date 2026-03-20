import React, { useState, useRef, useEffect } from 'react';
import { Move, Trash2 } from 'lucide-react';

export interface ImageElement {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ImageToolProps {
    elements: ImageElement[];
    onUpdate: (id: string, updates: Partial<ImageElement>) => void;
    onDelete: (id: string) => void;
    camera: { x: number, y: number, z: number };
    paperScale?: number;
    isFixed?: boolean;
}

export const ImageTool: React.FC<ImageToolProps> = ({ elements, onUpdate, onDelete, camera, paperScale = 1, isFixed = false }) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const originalSize = useRef({ width: 0, height: 0, x: 0, y: 0 });

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
        e.stopPropagation();
        setDraggingId(id);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX, y: clientY };
    };

    const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, el: ImageElement) => {
        e.stopPropagation();
        e.preventDefault();
        setResizingId(el.id);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX, y: clientY };
        originalSize.current = { width: el.width, height: el.height, x: el.x, y: el.y };
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!draggingId && !resizingId) return;

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            const effectiveScale = camera.z * paperScale;
            const dx = (clientX - dragStartPos.current.x) / effectiveScale;
            const dy = (clientY - dragStartPos.current.y) / effectiveScale;

            if (draggingId) {
                const element = elements.find(el => el.id === draggingId);
                if (element) {
                    onUpdate(draggingId, {
                        x: element.x + dx,
                        y: element.y + dy
                    });
                }
                dragStartPos.current = { x: clientX, y: clientY };
            } else if (resizingId) {
                // Keep aspect ratio resize from bottom-right corner
                const element = elements.find(el => el.id === resizingId);
                if (element) {
                    const aspect = originalSize.current.width / originalSize.current.height;
                    const newWidth = Math.max(50, originalSize.current.width + dx);
                    const newHeight = newWidth / aspect;
                    
                    onUpdate(resizingId, {
                        width: newWidth,
                        height: newHeight
                    });
                }
            }
        };

        const handleEnd = () => {
            setDraggingId(null);
            setResizingId(null);
        };

        if (draggingId || resizingId) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchmove', handleMove);
            window.addEventListener('touchend', handleEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchmove', handleMove); // Bug fix (duplicate touchedend replaced)
            window.removeEventListener('touchend', handleEnd);
        };
    }, [draggingId, resizingId, elements, onUpdate, camera.z, paperScale]);


    return (
        <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%', zIndex: 10 }}>
            {elements.map((el) => (
                <div
                    key={el.id}
                    onMouseEnter={() => setHoveredId(el.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                        position: 'absolute',
                        left: `${el.x * paperScale}px`,
                        top: `${el.y * paperScale}px`,
                        width: `${el.width * paperScale}px`,
                        height: `${el.height * paperScale}px`,
                        pointerEvents: 'auto',
                        border: hoveredId === el.id || draggingId === el.id || resizingId === el.id ? '2px dashed var(--accent-color)' : '2px solid transparent',
                        transition: 'border 0.2s',
                    }}
                >
                    <img 
                        src={el.src} 
                        alt="Inserted content" 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain',
                            pointerEvents: 'none' // Let the container handle dragging
                        }} 
                        draggable={false}
                    />

                    {(hoveredId === el.id || draggingId === el.id || resizingId === el.id) && (
                        <>
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '-32px',
                                    left: '0',
                                    display: 'flex',
                                    gap: '4px',
                                    background: 'var(--glass-bg)',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--glass-border)',
                                    pointerEvents: 'auto',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    zIndex: 20
                                }}
                            >
                                <button
                                    style={{ cursor: 'move', padding: '4px', background: 'none', border: 'none', color: 'var(--text-color)' }}
                                    onMouseDown={(e) => handleDragStart(e, el.id)}
                                    onTouchStart={(e) => handleDragStart(e, el.id)}
                                    title="Taşı"
                                >
                                    <Move size={16} />
                                </button>
                                <button
                                    style={{ cursor: 'pointer', padding: '4px', background: 'none', border: 'none', color: '#ff3b30' }}
                                    onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}
                                    title="Sil"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            
                            {/* Resize Handle */}
                            <div 
                                style={{
                                    position: 'absolute',
                                    bottom: '-6px',
                                    right: '-6px',
                                    width: '12px',
                                    height: '12px',
                                    backgroundColor: 'var(--accent-color)',
                                    borderRadius: '50%',
                                    cursor: 'nwse-resize',
                                    pointerEvents: 'auto',
                                    zIndex: 20,
                                    border: '2px solid white'
                                }}
                                onMouseDown={(e) => handleResizeStart(e, el)}
                                onTouchStart={(e) => handleResizeStart(e, el)}
                            />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};
