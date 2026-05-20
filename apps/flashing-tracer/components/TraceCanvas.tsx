'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import {
  interiorAngleDeg,
  interiorVertices,
  segmentLengthInches,
  segmentLengthPx,
  segments,
} from '@/lib/geometry';
import { formatLength } from '@/lib/parse';
import type { ImageRef, LabelOffset, Point, ToolMode, Trace, ViewMode } from '@/lib/types';
import { ScaleDialog } from './ScaleDialog';
import { LabelDialog } from './LabelDialog';

type Props = {
  projectId: string;
  image: ImageRef;
  trace: Trace;
  labels: Record<string, string>;
  labelOffsets: Record<string, LabelOffset>;
  tool: ToolMode;
  view: ViewMode;
  zoom: number;
  onZoomChange: (z: number) => void;
  onTraceChange: (t: Trace) => void;
  onLabelChange: (pointId: string, label: string) => void;
  onLabelOffsetChange: (pointId: string, offset: LabelOffset | null) => void;
};

type ScaleTarget = { segmentIndex: number; xPx: number; yPx: number; pxLength: number };
type LabelTarget = {
  startPointId: string;
  xPx: number;
  yPx: number;
  initial: string;
};

const PAD_PX = 60;

export function TraceCanvas({
  projectId,
  image,
  trace,
  labels,
  labelOffsets,
  tool,
  view,
  zoom,
  onZoomChange,
  onTraceChange,
  onLabelChange,
  onLabelOffsetChange,
}: Props) {
  const imageProxyHref = `/api/projects/${projectId}/image`;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panState, setPanState] = useState<null | {
    startClient: { x: number; y: number };
    startPan: { x: number; y: number };
  }>(null);
  const [scaleTarget, setScaleTarget] = useState<ScaleTarget | null>(null);
  const [labelTarget, setLabelTarget] = useState<LabelTarget | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [labelDrag, setLabelDrag] = useState<null | {
    pointId: string;
    startClient: { x: number; y: number };
    startOffset: LabelOffset;
  }>(null);

  // Track container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    observer.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Reset pan when project (and thus image) changes.
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [projectId]);

  // Auto-fit in detail view to the trace bounding box.
  const detailFit = useMemo(() => {
    if (view !== 'detail' || trace.points.length < 2 || containerSize.w === 0) return null;
    const xs = trace.points.map((p) => p.x);
    const ys = trace.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const fitZoom = Math.max(
      0.05,
      Math.min(8, Math.min((containerSize.w - PAD_PX * 2) / w, (containerSize.h - PAD_PX * 2) / h)),
    );
    const panX = (containerSize.w - w * fitZoom) / 2 / fitZoom - minX;
    const panY = (containerSize.h - h * fitZoom) / 2 / fitZoom - minY;
    return { zoom: fitZoom, panX, panY };
  }, [view, trace.points, containerSize.w, containerSize.h]);

  // Apply detail-view fit once when entering detail view or when points change.
  useEffect(() => {
    if (view === 'detail' && detailFit) {
      onZoomChange(detailFit.zoom);
      setPan({ x: detailFit.panX, y: detailFit.panY });
    }
  }, [view, detailFit, onZoomChange]);

  // Ctrl/Cmd + wheel zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      onZoomChange(Math.max(0.25, Math.min(8, Number((zoom + delta).toFixed(2)))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, onZoomChange]);

  // Spacebar pan toggle.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFormFocused()) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const clientToImage = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      const xPxDisplay = clientX - r.left - pan.x * zoom;
      const yPxDisplay = clientY - r.top - pan.y * zoom;
      return { x: xPxDisplay / zoom, y: yPxDisplay / zoom };
    },
    [pan.x, pan.y, zoom],
  );

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (scaleTarget || labelTarget) return;

    const isMiddle = e.button === 1;
    if (isMiddle || (spaceDown && e.button === 0)) {
      setPanState({
        startClient: { x: e.clientX, y: e.clientY },
        startPan: { ...pan },
      });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    if (e.button !== 0) return;
    const pt = clientToImage(e.clientX, e.clientY);
    if (!pt) return;

    if (tool === 'trace') {
      const newPoint: Point = { id: ulid(), x: pt.x, y: pt.y };
      onTraceChange({ ...trace, points: [...trace.points, newPoint] });
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (panState) {
      const dx = (e.clientX - panState.startClient.x) / zoom;
      const dy = (e.clientY - panState.startClient.y) / zoom;
      setPan({ x: panState.startPan.x + dx, y: panState.startPan.y + dy });
      return;
    }
    const pt = clientToImage(e.clientX, e.clientY);
    if (pt) setCursor(pt);
  }

  function onPointerUp(_e: React.PointerEvent<SVGSVGElement>) {
    setPanState(null);
  }

  function startVertexDrag(id: string, e: React.PointerEvent<SVGCircleElement>) {
    if (tool !== 'select') return;
    e.stopPropagation();
    setDraggingId(id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onVertexPointerMove(e: React.PointerEvent<SVGCircleElement>) {
    if (!draggingId) return;
    const pt = clientToImage(e.clientX, e.clientY);
    if (!pt) return;
    onTraceChange({
      ...trace,
      points: trace.points.map((p) => (p.id === draggingId ? { ...p, x: pt.x, y: pt.y } : p)),
    });
  }

  function onVertexPointerUp() {
    setDraggingId(null);
  }

  function onVertexContext(e: React.MouseEvent<SVGCircleElement>, id: string) {
    if (tool !== 'select') return;
    e.preventDefault();
    onTraceChange({ ...trace, points: trace.points.filter((p) => p.id !== id) });
  }

  function onSegmentClick(e: React.MouseEvent<SVGLineElement>, a: Point, b: Point, index: number) {
    e.stopPropagation();
    if (tool === 'select') {
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      setScaleTarget({
        segmentIndex: index,
        xPx: midX,
        yPx: midY,
        pxLength: segmentLengthPx(a, b),
      });
    } else if (tool === 'label') {
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      setLabelTarget({
        startPointId: a.id,
        xPx: midX,
        yPx: midY,
        initial: labels[a.id] ?? '',
      });
    }
  }

  const segs = useMemo(() => segments(trace.points), [trace.points]);
  const interior = useMemo(() => interiorVertices(trace.points), [trace.points]);

  const polylinePoints = useMemo(
    () => trace.points.map((p) => `${p.x},${p.y}`).join(' '),
    [trace.points],
  );

  const cursorClass =
    panState || spaceDown
      ? 'cursor-grabbing'
      : tool === 'trace'
        ? 'cursor-crosshair'
        : tool === 'label'
          ? 'cursor-pointer'
          : 'cursor-default';

  const vertexR = 6 / zoom;
  const hitR = 14 / zoom;
  const segStroke = (view === 'detail' ? 2.5 : 2) / zoom;
  const segHit = 16 / zoom;
  const labelFont = 13 / zoom;
  const dimFont = 11 / zoom;
  const angleArcR = 28 / zoom;

  const rubber =
    tool === 'trace' && trace.points.length > 0 && cursor
      ? trace.points[trace.points.length - 1]
      : null;

  const dialogAnchor = (xPx: number, yPx: number) => ({
    x: xPx * zoom + pan.x * zoom,
    y: yPx * zoom + pan.y * zoom,
  });

  const segmentDimLabel = (a: Point, b: Point) => {
    const px = segmentLengthPx(a, b);
    const inches = segmentLengthInches(a, b, trace.inchesPerPixel);
    if (inches == null) return `${px.toFixed(0)} px`;
    return formatLength(inches).ftIn;
  };

  const containerBg = view === 'detail' ? 'bg-white' : 'bg-[var(--paper)]';

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${containerBg} ${cursorClass}`}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
      >
        <g transform={`translate(${pan.x * zoom}, ${pan.y * zoom}) scale(${zoom})`}>
          {view === 'image' && (
            <image
              href={imageProxyHref}
              x={0}
              y={0}
              width={image.widthPx}
              height={image.heightPx}
            />
          )}

          {/* rubber-band */}
          {rubber && cursor && (
            <line
              x1={rubber.x}
              y1={rubber.y}
              x2={cursor.x}
              y2={cursor.y}
              stroke="var(--trace)"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              opacity={0.6}
              pointerEvents="none"
            />
          )}

          {/* polyline */}
          {trace.points.length >= 2 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={view === 'detail' ? '#1c2230' : 'var(--trace)'}
              strokeWidth={segStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* angle arcs (detail view only) */}
          {view === 'detail' &&
            interior.map(({ prev, vertex, next, index }) => {
              const a = Math.atan2(prev.y - vertex.y, prev.x - vertex.x);
              const b = Math.atan2(next.y - vertex.y, next.x - vertex.x);
              const deg = interiorAngleDeg(prev, vertex, next);
              const midA = (a + b) / 2;
              // Position label outside the arc, on the bisector going AWAY from the chain.
              const labelDist = angleArcR + 8 / zoom;
              const lx = vertex.x + Math.cos(midA) * labelDist;
              const ly = vertex.y + Math.sin(midA) * labelDist;
              return (
                <g key={`angle-${index}`} pointerEvents="none">
                  <path
                    d={describeArc(vertex.x, vertex.y, angleArcR, a, b)}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1 / zoom}
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={dimFont}
                    fill="#475569"
                  >
                    {deg.toFixed(1)}°
                  </text>
                </g>
              );
            })}

          {/* segment hit lines + labels */}
          {(tool === 'select' || tool === 'label' || view === 'detail') &&
            segs.map(({ a, b, index }) => {
              const midX = (a.x + b.x) / 2;
              const midY = (a.y + b.y) / 2;
              const label = labels[a.id];
              const offset = labelOffsets[a.id] ?? { dx: 0, dy: 0 };
              const hasOffset = offset.dx !== 0 || offset.dy !== 0;
              const labelX = midX + offset.dx;
              const labelY = midY + offset.dy - 8 / zoom; // default lift
              const interactive = tool === 'select' || tool === 'label';
              const dragEnabled = view === 'detail' && tool !== 'label';
              const isDragging = labelDrag?.pointId === a.id;

              return (
                <g key={`seg-${index}`}>
                  {interactive && (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={segHit}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => onSegmentClick(e, a, b, index)}
                    />
                  )}

                  {hasOffset && (
                    <line
                      x1={midX}
                      y1={midY}
                      x2={labelX}
                      y2={labelY + 4 / zoom}
                      stroke="#94a3b8"
                      strokeWidth={1 / zoom}
                      pointerEvents="none"
                    />
                  )}
                  {hasOffset && (
                    <circle cx={midX} cy={midY} r={2 / zoom} fill="#94a3b8" pointerEvents="none" />
                  )}

                  <g
                    style={{
                      cursor: dragEnabled ? (isDragging ? 'grabbing' : 'grab') : 'default',
                      touchAction: 'none',
                    }}
                    onPointerDown={(e) => {
                      if (!dragEnabled) return;
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      setLabelDrag({
                        pointId: a.id,
                        startClient: { x: e.clientX, y: e.clientY },
                        startOffset: offset,
                      });
                    }}
                    onPointerMove={(e) => {
                      if (!labelDrag || labelDrag.pointId !== a.id) return;
                      const dx =
                        labelDrag.startOffset.dx + (e.clientX - labelDrag.startClient.x) / zoom;
                      const dy =
                        labelDrag.startOffset.dy + (e.clientY - labelDrag.startClient.y) / zoom;
                      onLabelOffsetChange(a.id, { dx, dy });
                    }}
                    onPointerUp={() => setLabelDrag(null)}
                    onContextMenu={(e) => {
                      if (!dragEnabled || !hasOffset) return;
                      e.preventDefault();
                      onLabelOffsetChange(a.id, null);
                    }}
                  >
                    {dragEnabled && (
                      // Invisible hit-pad so the user can grab anywhere over the label stack.
                      <rect
                        x={labelX - 50 / zoom}
                        y={labelY - (labelFont + dimFont + 6) / zoom}
                        width={100 / zoom}
                        height={(labelFont + dimFont + 10) / zoom}
                        fill="transparent"
                      />
                    )}
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      fontSize={dimFont}
                      fill={view === 'detail' ? '#1c2230' : '#334155'}
                    >
                      {segmentDimLabel(a, b)}
                    </text>
                    {label && (
                      <text
                        x={labelX}
                        y={labelY - (dimFont + 2) / zoom}
                        textAnchor="middle"
                        fontSize={labelFont}
                        fontWeight={600}
                        fill="var(--accent)"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

          {/* vertices */}
          {trace.points.map((p, i) => (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hitR}
                fill="transparent"
                style={{
                  cursor:
                    tool === 'select' ? (draggingId === p.id ? 'grabbing' : 'grab') : 'default',
                }}
                onPointerDown={(e) => startVertexDrag(p.id, e)}
                onPointerMove={onVertexPointerMove}
                onPointerUp={onVertexPointerUp}
                onContextMenu={(e) => onVertexContext(e, p.id)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={vertexR}
                fill={i === 0 || i === trace.points.length - 1 ? '#ffffff' : 'var(--vertex)'}
                stroke="var(--vertex)"
                strokeWidth={1.5 / zoom}
                pointerEvents="none"
              />
              <text
                x={p.x + 8 / zoom}
                y={p.y - 8 / zoom}
                fontSize={10 / zoom}
                fill="#475569"
                pointerEvents="none"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {scaleTarget &&
        (() => {
          const a = dialogAnchor(scaleTarget.xPx, scaleTarget.yPx);
          return (
            <ScaleDialog
              pixelLength={scaleTarget.pxLength}
              anchorXPx={a.x}
              anchorYPx={a.y}
              initialValue={
                trace.inchesPerPixel != null
                  ? (scaleTarget.pxLength * trace.inchesPerPixel).toFixed(2)
                  : ''
              }
              onCancel={() => setScaleTarget(null)}
              onConfirm={(ipp) => {
                onTraceChange({ ...trace, inchesPerPixel: ipp });
                setScaleTarget(null);
              }}
            />
          );
        })()}

      {labelTarget &&
        (() => {
          const a = dialogAnchor(labelTarget.xPx, labelTarget.yPx);
          return (
            <LabelDialog
              initialValue={labelTarget.initial}
              anchorXPx={a.x}
              anchorYPx={a.y}
              onCancel={() => setLabelTarget(null)}
              onConfirm={(text) => {
                onLabelChange(labelTarget.startPointId, text);
                setLabelTarget(null);
              }}
            />
          );
        })()}
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  // Draw the short arc between the two rays.
  let diff = endRad - startRad;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const sweep = diff > 0 ? 1 : 0;
  const x1 = cx + Math.cos(startRad) * r;
  const y1 = cy + Math.sin(startRad) * r;
  const x2 = cx + Math.cos(endRad) * r;
  const y2 = cy + Math.sin(endRad) * r;
  const largeArc = Math.abs(diff) > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

function isFormFocused(): boolean {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
