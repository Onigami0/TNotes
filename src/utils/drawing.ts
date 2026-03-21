import { getStroke } from 'perfect-freehand';
import type { Stroke } from '../types';

export function getSvgPathFromStroke(stroke: number[][]) {
    if (!stroke.length) return '';

    const d = stroke.reduce(
        (acc: any[], [x0, y0]: number[], i: number, arr: number[][]) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
}

export const drawStrokeOnCanvas = (
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    cachedPath?: Path2D
): Path2D | undefined => {
    // Reset composite operation to default at the start of each stroke
    ctx.globalCompositeOperation = 'source-over';

    if (stroke.points.length === 0) return;

    // Set common stroke properties for shapes and non-pressure tools
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;

    // Handle Geometric Shapes (These are not cached as Path2D currently)
    if (['rectangle', 'circle', 'line', 'arrow'].includes(stroke.tool)) {
        ctx.globalCompositeOperation = 'source-over';
        if (stroke.points.length < 2) return;
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];

        ctx.beginPath();
        if (stroke.tool === 'rectangle') {
            ctx.strokeRect(
                Math.min(start.x, end.x),
                Math.min(start.y, end.y),
                Math.abs(end.x - start.x),
                Math.abs(end.y - start.y)
            );
        } else if (stroke.tool === 'circle') {
            const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (stroke.tool === 'line') {
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        } else if (stroke.tool === 'arrow') {
            const headlen = Math.max(stroke.size * 3, 10);
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = stroke.color;
            ctx.fill();
        }
        return undefined;
    }

    // Hand-drawn strokes (with pressure/smoothing)
    let path = cachedPath;
    if (!path) {
        let options = {};
        if (stroke.tool === 'ballpoint') {
            options = { size: stroke.size, thinning: 0, smoothing: 0.5, streamline: 0.5 };
        } else if (stroke.tool === 'fountain') {
            options = { size: stroke.size + 4, thinning: 0.7, smoothing: 0.5, streamline: 0.5 };
        } else if (stroke.tool === 'highlighter') {
            options = { size: stroke.size * 2, thinning: -0.1, smoothing: 0.2, streamline: 0.8 };
        } else if (stroke.tool === 'eraser') {
            options = { size: stroke.size * 3, thinning: 0, smoothing: 0.5, streamline: 0.5 };
        }

        const outlinePoints = getStroke(stroke.points as any, options);
        const pathData = getSvgPathFromStroke(outlinePoints);
        path = new Path2D(pathData);
    }

    if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
    } else if (stroke.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        const hex = stroke.color.replace('#', '');
        let r = parseInt(hex.substring(0, 2), 16) || 255;
        let g = parseInt(hex.substring(2, 4), 16) || 255;
        let b = parseInt(hex.substring(4, 6), 16) || 0;
        if (r < 50 && g < 50 && b < 50) { r = 255; g = 255; b = 0; }
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
    } else {
        ctx.fillStyle = stroke.color;
    }

    ctx.fill(path);
    return path;
};

export const isPointInRect = (x: number, y: number, rect: { x: number, y: number, width: number, height: number }) => {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
};

export const isStrokeInRect = (stroke: Stroke, rect: { x: number, y: number, width: number, height: number }) => {
    // A stroke is considered in the rect if at least one of its points is inside the rect
    return stroke.points.some(p => isPointInRect(p.x, p.y, rect));
};
