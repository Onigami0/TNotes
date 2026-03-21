export type PenType = 'hand' | 'ballpoint' | 'fountain' | 'highlighter' | 'eraser' | 'text' | 'select' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'triangle' | 'star' | 'diamond' | 'pentagon' | 'hexagon';

export interface Point {
    x: number;
    y: number;
    pressure?: number;
}

export interface Stroke {
    id: string;
    points: Point[];
    color: string;
    size: number;
    tool: PenType;
}
