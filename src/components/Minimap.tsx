import React, { useRef, useState, useEffect } from 'react';
import type { Stroke } from '../types';

interface MinimapProps {
    camera: { x: number, y: number, z: number };
    setCamera: React.Dispatch<React.SetStateAction<{ x: number, y: number, z: number }>>;
    strokes: Stroke[];
    isFixed: boolean;
    paperSize?: { width: number, height: number };
}

export const Minimap: React.FC<MinimapProps> = ({ camera, setCamera, strokes, isFixed, paperSize }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Configurable Minimap size
    const MAP_WIDTH = 150;
    const MAP_HEIGHT = 100;
    
    // Calculate global bounds of all drawing
    const calculateBounds = () => {
        if (isFixed && paperSize) {
            return {
                minX: 0,
                minY: 0,
                width: paperSize.width,
                height: paperSize.height
            };
        }
        
        // Infinite canvas mode: calculate bounds from strokes
        let minX = -1000, minY = -1000, maxX = 1000, maxY = 1000;
        
        if (strokes.length > 0) {
            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            strokes.forEach(s => {
                s.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            });
            // Add padding
            minX -= 500;
            minY -= 500;
            maxX += 500;
            maxY += 500;
        }
        
        return {
            minX,
            minY,
            width: maxX - minX,
            height: maxY - minY
        };
    };
    
    const bounds = calculateBounds();
    const scaleX = MAP_WIDTH / bounds.width;
    const scaleY = MAP_HEIGHT / bounds.height;
    // Use uniform scale to preserve aspect ratio in minimap
    const scale = Math.min(scaleX, scaleY);
    
    const actualMapWidth = bounds.width * scale;
    const actualMapHeight = bounds.height * scale;

    const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const viewportRect = {
        x: (-camera.x - bounds.minX * camera.z) * scale / camera.z,
        y: (-camera.y - bounds.minY * camera.z) * scale / camera.z,
        width: viewportSize.w / camera.z * scale,
        height: viewportSize.h / camera.z * scale
    };

    const handleInteract = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;
        
        if (clientX === undefined || clientY === undefined) return;

        const xOnMap = clientX - rect.left - (MAP_WIDTH - actualMapWidth) / 2;
        const yOnMap = clientY - rect.top - (MAP_HEIGHT - actualMapHeight) / 2;

        const worldX = xOnMap / scale + bounds.minX;
        const worldY = yOnMap / scale + bounds.minY;

        setCamera(c => ({
            ...c,
            x: -(worldX * c.z) + viewportSize.w / 2,
            y: -(worldY * c.z) + viewportSize.h / 2
        }));
    };

    const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsDragging(true);
        handleInteract(e);
    };

    useEffect(() => {
        const onMove = (e: MouseEvent | TouchEvent) => {
            if (isDragging) {
                e.preventDefault();
                handleInteract(e);
            }
        };
        const onUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', onMove, { passive: false });
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onUp);
        }

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging, bounds, scale, viewportSize]); // Added dependencies to capture fresh state

    return (
        <div 
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                width: `${MAP_WIDTH}px`,
                height: `${MAP_HEIGHT}px`,
                backgroundColor: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 40,
                overflow: 'hidden'
            }}
        >
            <div 
                ref={mapRef}
                onMouseDown={onPointerDown}
                onTouchStart={onPointerDown}
                style={{
                    position: 'relative',
                    width: `${actualMapWidth}px`,
                    height: `${actualMapHeight}px`,
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    cursor: isDragging ? 'grabbing' : 'pointer'
                }}
            >
                {/* Viewport Indicator */}
                <div 
                    style={{
                        position: 'absolute',
                        left: `${Math.max(0, viewportRect.x)}px`,
                        top: `${Math.max(0, viewportRect.y)}px`,
                        width: `${Math.min(actualMapWidth - Math.max(0, viewportRect.x), viewportRect.width)}px`,
                        height: `${Math.min(actualMapHeight - Math.max(0, viewportRect.y), viewportRect.height)}px`,
                        border: '2px solid var(--accent-color)',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        boxSizing: 'border-box'
                    }}
                />
            </div>
        </div>
    );
};
