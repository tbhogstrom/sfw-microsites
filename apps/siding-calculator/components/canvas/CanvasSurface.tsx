'use client';
import React from 'react';

export type CanvasSize = { widthFt: number; heightFt: number };

export type CanvasViewProps = {
  size: CanvasSize;
  pixelsPerFt: number; // computed from container dims
  children?: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>, ptFt: { x: number; y: number }) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>, ptFt: { x: number; y: number }) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>, ptFt: { x: number; y: number }) => void;
};

export function clientToFt(
  e: React.PointerEvent<SVGSVGElement>,
  pixelsPerFt: number,
  size: CanvasSize,
): { x: number; y: number } {
  const svg = e.currentTarget;
  const rect = svg.getBoundingClientRect();
  const xPx = e.clientX - rect.left;
  const yPx = e.clientY - rect.top;
  return {
    x: xPx / pixelsPerFt,
    y: size.heightFt - yPx / pixelsPerFt, // SVG y-down → world y-up
  };
}

export function CanvasSurface({
  size,
  pixelsPerFt,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: CanvasViewProps) {
  const widthPx = size.widthFt * pixelsPerFt;
  const heightPx = size.heightFt * pixelsPerFt;

  return (
    <svg
      viewBox={`0 0 ${widthPx} ${heightPx}`}
      width={widthPx}
      height={heightPx}
      style={{ background: 'var(--paper)', display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      onPointerDown={
        onPointerDown ? (e) => onPointerDown(e, clientToFt(e, pixelsPerFt, size)) : undefined
      }
      onPointerMove={
        onPointerMove ? (e) => onPointerMove(e, clientToFt(e, pixelsPerFt, size)) : undefined
      }
      onPointerUp={
        onPointerUp ? (e) => onPointerUp(e, clientToFt(e, pixelsPerFt, size)) : undefined
      }
    >
      <defs>
        <pattern
          id="grid-minor"
          width={pixelsPerFt / 12}
          height={pixelsPerFt / 12}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${pixelsPerFt / 12} 0 L 0 0 0 ${pixelsPerFt / 12}`}
            fill="none"
            stroke="var(--grid-minor)"
            strokeWidth={0.5}
          />
        </pattern>
        <pattern
          id="grid-major"
          width={pixelsPerFt}
          height={pixelsPerFt}
          patternUnits="userSpaceOnUse"
        >
          <rect width={pixelsPerFt} height={pixelsPerFt} fill="url(#grid-minor)" />
          <path
            d={`M ${pixelsPerFt} 0 L 0 0 0 ${pixelsPerFt}`}
            fill="none"
            stroke="var(--grid-major)"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width={widthPx} height={heightPx} fill="url(#grid-major)" />
      {/* Children get a coordinate system in pixels (origin top-left). World-y conversion happens at the consumer. */}
      <g transform={`translate(0, ${heightPx})`}>
        <g transform="scale(1, -1)">{children}</g>
      </g>
    </svg>
  );
}
