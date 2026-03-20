import type { Stroke } from '../types';

/**
 * Google IME Handwriting API implementation.
 * It's an unofficial but widely used public API for handwriting recognition.
 */
export const recognizeHandwriting = async (strokes: Stroke[], language: string = 'tr'): Promise<string> => {
    if (strokes.length === 0) return '';

    // 1. Normalize coordinates while maintaining aspect ratio
    // Shifting to 0,0 and scaling to a standard size helps the model
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(s => s.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }));

    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height) || 1;
    const scale = 1000 / maxDim;

    // API expects: [ [ [xs], [ys], [ts] ], ... ]
    const htrStrokes = strokes.map(stroke => {
        const xs = stroke.points.map(p => Math.round((p.x - minX) * scale));
        const ys = stroke.points.map(p => Math.round((p.y - minY) * scale));
        const ts = stroke.points.map((_, i) => i * 10);
        return [xs, ys, ts];
    });

    const payload = {
        options: 'enable_pre_space',
        requests: [
            {
                writing_guide: {
                    writing_area_width: 1000,
                    writing_area_height: 1000,
                },
                ink: htrStrokes,
                language: language,
            },
        ],
    };

    try {
        const response = await fetch(
            'https://www.google.com.tr/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) throw new Error('HTR API Hatası');

        const data = await response.json();

        // Response format: ["SUCCESS", [ ["text", ["alt1", "alt2"], [], {"debug":...} ] ] ]
        if (data[0] === 'SUCCESS' && data[1][0][1][0]) {
            return data[1][0][1][0]; // Return the most likely result
        }

        return '';
    } catch (error) {
        console.error('El yazısı tanıma başarısız:', error);
        return '';
    }
};
