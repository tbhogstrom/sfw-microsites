'use client';
import { useState, useRef, useCallback } from 'react';

export type DrawTool = 'wall' | 'gable' | 'window' | 'door' | 'garage-door' | 'vent' | null;

export type DragRect = { x: number; y: number; widthFt: number; heightFt: number };

export type DrawState = {
  active: boolean;
  start: { x: number; y: number } | null;
  current: { x: number; y: number } | null;
};

export type UseDrawingToolReturn = {
  tool: DrawTool;
  setTool: (t: DrawTool) => void;
  draw: DrawState;
  beginDrag: (pt: { x: number; y: number }) => void;
  updateDrag: (pt: { x: number; y: number }) => void;
  endDrag: () => DragRect | null; // null if no movement
};

const INITIAL: DrawState = { active: false, start: null, current: null };

export function useDrawingTool(): UseDrawingToolReturn {
  const [tool, setTool] = useState<DrawTool>(null);
  const [draw, setDrawState] = useState<DrawState>(INITIAL);
  // Mirror state in a ref so endDrag can read the latest value synchronously
  // without relying on the setState updater callback (which runs during reconcile).
  const drawRef = useRef<DrawState>(INITIAL);

  const setDraw = useCallback((next: DrawState) => {
    drawRef.current = next;
    setDrawState(next);
  }, []);

  const beginDrag = useCallback(
    (pt: { x: number; y: number }) => {
      setDraw({ active: true, start: pt, current: pt });
    },
    [setDraw],
  );

  const updateDrag = useCallback(
    (pt: { x: number; y: number }) => {
      if (drawRef.current.active) {
        setDraw({ ...drawRef.current, current: pt });
      }
    },
    [setDraw],
  );

  const endDrag = useCallback((): DragRect | null => {
    const prev = drawRef.current;
    let result: DragRect | null = null;
    if (prev.active && prev.start && prev.current) {
      const x = Math.min(prev.start.x, prev.current.x);
      const y = Math.min(prev.start.y, prev.current.y);
      const widthFt = Math.abs(prev.current.x - prev.start.x);
      const heightFt = Math.abs(prev.current.y - prev.start.y);
      if (widthFt > 0.1 && heightFt > 0.1) {
        result = { x, y, widthFt, heightFt };
      }
    }
    setDraw(INITIAL);
    return result;
  }, [setDraw]);

  return { tool, setTool, draw, beginDrag, updateDrag, endDrag };
}
