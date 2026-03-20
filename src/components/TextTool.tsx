import React, { useState, useRef, useEffect } from 'react';
import { Move, Trash2 } from 'lucide-react';

export interface TextElement {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    isBold?: boolean;
    isItalic?: boolean;
    textAlign?: 'left' | 'center' | 'right';
}

interface TextToolProps {
    elements: TextElement[];
    onUpdate: (id: string, updates: Partial<TextElement>) => void;
    onDelete: (id: string) => void;
    camera: { x: number, y: number, z: number };
    paperScale?: number;
    gridSize?: number;
    containerOffset?: { x: number, y: number };
    isFixed?: boolean;
}

export const TextTool: React.FC<TextToolProps> = ({ elements, onUpdate, onDelete, camera, paperScale = 1, gridSize = 40, containerOffset = { x: 0, y: 0 }, isFixed = false }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
        e.stopPropagation();
        setDraggingId(id);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX, y: clientY };
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!draggingId) return;

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            // Effective scale for converting screen distance to world distance
            const effectiveScale = camera.z * paperScale;
            const dx = (clientX - dragStartPos.current.x) / effectiveScale;
            const dy = (clientY - dragStartPos.current.y) / effectiveScale;

            const element = elements.find(el => el.id === draggingId);
            if (element) {
                onUpdate(draggingId, {
                    x: element.x + dx,
                    y: element.y + dy
                });
            }

            dragStartPos.current = { x: clientX, y: clientY };
        };

        const handleEnd = () => setDraggingId(null);

        if (draggingId) {
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
    }, [draggingId, elements, onUpdate, camera.z, paperScale]);


    return (
        <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }}>
            {elements.map((el) => (
                <div
                    key={el.id}
                    className="text-element-container"
                    style={{
                        position: 'absolute',
                        left: isFixed ? `${el.x * paperScale}px` : `${el.x * camera.z + (camera.x - containerOffset.x)}px`,
                        top: isFixed ? `${el.y * paperScale - (27 * paperScale)}px` : `${(el.y - 27) * camera.z + (camera.y - containerOffset.y)}px`,
                        pointerEvents: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: editingId === el.id ? 100 : 5,
                        transform: isFixed ? 'none' : `scale(${camera.z})`,
                        transformOrigin: 'top left'
                    }}
                >
                    <style>{`
                        .text-element-container:hover .text-controls { opacity: 1 !important; }
                    `}</style>

                    {editingId === el.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <textarea
                                autoFocus
                                spellCheck="false"
                                autoCorrect="off"
                                autoCapitalize="off"
                                value={el.text}
                                onChange={(e) => onUpdate(el.id, { text: e.target.value })}
                                onBlur={() => {
                                    setEditingId(null);
                                    if (el.text.trim() === '') {
                                        onDelete(el.id);
                                    }
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: el.color,
                                    fontSize: `${el.fontSize * paperScale}px`,
                                    fontFamily: el.fontFamily,
                                    fontWeight: el.isBold ? 'bold' : 'normal',
                                    fontStyle: el.isItalic ? 'italic' : 'normal',
                                    textAlign: el.textAlign || 'left',
                                    lineHeight: `${gridSize * paperScale}px`,
                                    width: '100%',
                                    resize: 'none',
                                    padding: '0 !important',
                                    margin: 0,
                                    overflow: 'hidden',
                                    height: 'auto',
                                    cursor: 'text',
                                    minWidth: '200px'
                                }}
                            />
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start'
                            }}
                            onClick={() => setEditingId(el.id)}
                        >
                            <span
                                style={{
                                    display: 'block',
                                    color: el.color,
                                    fontSize: `${el.fontSize * paperScale}px`,
                                    fontFamily: el.fontFamily,
                                    fontWeight: el.isBold ? 'bold' : 'normal',
                                    fontStyle: el.isItalic ? 'italic' : 'normal',
                                    textAlign: el.textAlign || 'left',
                                    lineHeight: `${gridSize * paperScale}px`,
                                    whiteSpace: 'pre-wrap',
                                    cursor: 'text',
                                    padding: 0,
                                    margin: 0,
                                    minWidth: '20px',
                                    minHeight: '1em',
                                    width: '100%'
                                }}
                            >
                                {el.text || ' '}
                            </span>
                        </div>
                    )}

                    <div
                        className="text-controls"
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '0',
                            display: 'flex',
                            gap: '2px',
                            background: 'var(--glass-bg)',
                            padding: '2px',
                            borderRadius: '4px',
                            border: '1px solid var(--glass-border)',
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            pointerEvents: 'auto',
                            transform: 'scale(0.8)',
                            transformOrigin: 'bottom left'
                        }}
                    >
                        <div
                            style={{ cursor: 'move', padding: '2px' }}
                            onMouseDown={(e) => handleDragStart(e, el.id)}
                            onTouchStart={(e) => handleDragStart(e, el.id)}
                        >
                            <Move size={12} />
                        </div>
                        <div
                            style={{ cursor: 'pointer', padding: '2px', color: '#ff3b30' }}
                            onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}
                        >
                            <Trash2 size={12} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
