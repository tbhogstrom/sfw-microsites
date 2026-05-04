'use client';
import React, { useRef, useState } from 'react';
import type { Opening as OpeningT, Project } from '@/lib/types';

type Props = {
  opening: OpeningT;
  wall: Project['wall'];
  pixelsPerFt: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (id: string, xFt: number, yFt: number) => void;
  /**
   * Color for the trim casing rendered around the opening. Casing is always
   * rendered (trim is a visual default on every opening); pass null/undefined
   * to use a sensible fallback white.
   */
  trimColor?: string | null;
};

type DragBaseline = {
  pointerId: number;
  baseClientX: number;
  baseClientY: number;
  baseX: number;
  baseY: number;
};

// 3.5" wide casing around each opening (matches typical 4/4 trim).
const CASING_WIDTH_FT = 3.5 / 12;

export function Opening({
  opening,
  wall,
  pixelsPerFt,
  selected,
  onSelect,
  onMove,
  trimColor,
}: Props) {
  const x = (wall.rect.x + opening.x) * pixelsPerFt;
  const y = (wall.rect.y + opening.y) * pixelsPerFt;
  const w = opening.widthFt * pixelsPerFt;
  const h = opening.heightFt * pixelsPerFt;
  const casing = CASING_WIDTH_FT * pixelsPerFt;

  const casingFill = trimColor ?? '#fafafa';
  const casingStroke = selected ? '#2a4d8f' : '#9aa3ae';
  const casingStrokeWidth = selected ? 1.5 : 0.5;

  const dragRef = useRef<DragBaseline | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function onPointerDown(e: React.PointerEvent<SVGGElement>) {
    if (!onMove) return;
    e.stopPropagation();
    onSelect?.(opening.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      baseClientX: e.clientX,
      baseClientY: e.clientY,
      baseX: opening.x,
      baseY: opening.y,
    };
    setIsDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    const base = dragRef.current;
    if (!base || !onMove) return;
    e.stopPropagation();
    const dxFt = (e.clientX - base.baseClientX) / pixelsPerFt;
    const dyFt = -(e.clientY - base.baseClientY) / pixelsPerFt;
    onMove(opening.id, base.baseX + dxFt, base.baseY + dyFt);
  }

  function endDrag(e: React.PointerEvent<SVGGElement>) {
    if (!dragRef.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(dragRef.current.pointerId);
    } catch {
      /* already released */
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(opening.id);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ cursor: onMove ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
    >
      {/* Trim casing — outer frame */}
      <rect
        x={x - casing}
        y={y - casing}
        width={w + casing * 2}
        height={h + casing * 2}
        fill={casingFill}
        stroke={casingStroke}
        strokeWidth={casingStrokeWidth}
      />
      {/* Glass / opening — inner */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="white"
        stroke="#34507a"
        strokeWidth={selected ? 1.5 : 0.6}
      />
      <text
        x={x + w / 2}
        y={y + h / 2}
        fontSize={Math.min(w, h) * 0.18}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`scale(1,-1) translate(0, ${-(2 * (y + h / 2))})`}
        fill="#34507a"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {opening.type}
      </text>
    </g>
  );
}
