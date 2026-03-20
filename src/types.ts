export type PenType = 'ballpoint' | 'fountain' | 'highlighter' | 'eraser' | 'text' | 'select' | 'rectangle' | 'circle' | 'line' | 'arrow';

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
