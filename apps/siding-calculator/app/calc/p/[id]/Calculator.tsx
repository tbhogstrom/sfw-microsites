'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import type { Project, Opening, OpeningType } from '@/lib/types';
import { applyPreset } from '@/lib/presets';
import { computeMaterialsList } from '@/lib/materials';
import { CanvasSurface } from '@/components/canvas/CanvasSurface';
import { Toolbar } from '@/components/canvas/Toolbar';
import { WallShape } from '@/components/canvas/WallShape';
import { Opening as OpeningEl } from '@/components/canvas/Opening';
import { DimensionOverlay } from '@/components/canvas/DimensionOverlay';
import { useDrawingTool } from '@/components/canvas/useDrawingTool';
import { FinishDefs, sidingFillFor, trimColorFor } from '@/components/canvas/finishPatterns';
import { HelpPanel } from '@/components/canvas/HelpPanel';
import { ElementsDrawer } from '@/components/drawer/ElementsDrawer';
import { PresetPicker } from '@/components/materials/PresetPicker';
import { PhaseRow } from '@/components/materials/PhaseRow';
import { MaterialsTable } from '@/components/outputs/MaterialsTable';
import { ExportButtons } from '@/components/outputs/ExportButtons';
import { LeadForm } from '@/components/outputs/LeadForm';
import { QuoteCTA } from '@/components/outputs/QuoteCTA';
import { useIsDesktop, MobileFallback } from '@/components/mobile/MobileFallback';

const OPENING_DEFAULTS: Record<OpeningType, { widthFt: number; heightFt: number }> = {
  window: { widthFt: 3, heightFt: 4 },
  door: { widthFt: 3, heightFt: 7 },
  'garage-door': { widthFt: 16, heightFt: 7 },
  vent: { widthFt: 1, heightFt: 1 },
};

export function Calculator({ initial }: { initial: Project }) {
  const [project, setProject] = useState<Project>(initial);
  const [selectedId, setSelectedId] = useState<string | null>('wall');
  const [leadIntent, setLeadIntent] = useState<'export' | 'quote' | null>(null);
  const draw = useDrawingTool();

  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);
  const [basePixelsPerFt, setBasePixelsPerFt] = useState(20);
  const [zoom, setZoom] = useState(1);
  const pixelsPerFt = basePixelsPerFt * zoom;

  // Fit canvas to container at zoom = 1.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      const fitW = w / project.canvas.widthFt;
      const fitH = h / project.canvas.heightFt;
      setBasePixelsPerFt(Math.max(8, Math.min(fitW, fitH) * 0.95));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [project.canvas.widthFt, project.canvas.heightFt]);

  // Ctrl/Cmd + wheel to zoom over the canvas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => Math.max(0.4, Math.min(3, Number((z + delta).toFixed(2)))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Autosave on change (debounced 1s).
  useEffect(() => {
    const t = setTimeout(async () => {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(project),
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [project]);

  if (!isDesktop)
    return <MobileFallback projectId={project.id} onQuote={() => setLeadIntent('quote')} />;

  function onPointerDown(_e: React.PointerEvent<SVGSVGElement>, pt: { x: number; y: number }) {
    if (!draw.tool) return;
    draw.beginDrag(pt);
  }
  function onPointerMove(_e: React.PointerEvent<SVGSVGElement>, pt: { x: number; y: number }) {
    draw.updateDrag(pt);
  }
  function onPointerUp() {
    const rect = draw.endDrag();
    if (!rect || !draw.tool) return;

    if (draw.tool === 'wall') {
      setProject((p) => ({ ...p, wall: { ...p.wall, rect } }));
    } else if (draw.tool === 'gable') {
      setProject((p) => ({
        ...p,
        wall: { ...p.wall, gable: { peakHeightFt: 4, peakOffsetFt: 0 } },
      }));
    } else {
      const type = draw.tool as OpeningType;
      const def = OPENING_DEFAULTS[type];
      const wallW = project.wall.rect.widthFt;
      const wallH = project.wall.rect.heightFt;
      // Allow openings into the gable area (wall+gable bounding box).
      const totalH = wallH + (project.wall.gable?.peakHeightFt ?? 0);
      const wx = Math.max(0, rect.x - project.wall.rect.x);
      const wy = Math.max(0, rect.y - project.wall.rect.y);
      const widthFt = rect.widthFt > 0.5 ? rect.widthFt : def.widthFt;
      const heightFt = rect.heightFt > 0.5 ? rect.heightFt : def.heightFt;
      const op: Opening = {
        id: ulid(),
        type,
        x: Math.min(wx, Math.max(0, wallW - widthFt)),
        y: Math.min(wy, Math.max(0, totalH - heightFt)),
        widthFt,
        heightFt,
      };
      setProject((p) => ({ ...p, openings: [...p.openings, op] }));
    }
    draw.setTool(null);
  }

  const draftRect =
    draw.draw.start && draw.draw.current
      ? {
          x: Math.min(draw.draw.start.x, draw.draw.current.x),
          y: Math.min(draw.draw.start.y, draw.draw.current.y),
          widthFt: Math.abs(draw.draw.current.x - draw.draw.start.x),
          heightFt: Math.abs(draw.draw.current.y - draw.draw.start.y),
        }
      : null;

  const lines = useMemo(() => computeMaterialsList(project), [project]);
  const wallExists = project.wall.rect.widthFt > 0 && project.wall.rect.heightFt > 0;
  const materialsPicked = lines.length > 0;

  return (
    <main className="flex min-h-screen flex-col">
      {/* Stage 1: canvas with help gutter */}
      <div className="flex h-[calc(100vh-160px)] min-h-[420px] shrink-0">
        <HelpPanel />
        <div ref={containerRef} className="relative flex-1 bg-[var(--paper)]">
          <Toolbar
            canvas={project.canvas}
            onCanvasChange={(c) => setProject((p) => ({ ...p, canvas: c }))}
            tool={draw.tool}
            onToolChange={draw.setTool}
            zoom={zoom}
            onZoomChange={setZoom}
          />
          <div className="grid h-full place-items-center overflow-auto">
            <CanvasSurface
              size={project.canvas}
              pixelsPerFt={pixelsPerFt}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <FinishDefs
                pixelsPerFt={pixelsPerFt}
                sidingMaterialId={project.scope.phases.siding.materialId}
                sidingColorHex={project.scope.phases.siding.colorHex}
              />
              <WallShape
                wall={project.wall}
                pixelsPerFt={pixelsPerFt}
                selected={selectedId === 'wall'}
                onSelect={() => setSelectedId('wall')}
                sidingFill={
                  project.scope.phases.siding.enabled
                    ? sidingFillFor(
                        project.scope.phases.siding.materialId,
                        project.scope.phases.siding.colorHex,
                      )
                    : undefined
                }
                trimColor={
                  project.scope.phases.trim.enabled && project.scope.phases.trim.materialId
                    ? trimColorFor(
                        project.scope.phases.trim.materialId,
                        project.scope.phases.trim.colorHex,
                      )
                    : null
                }
              />
              {project.openings.map((o) => (
                <OpeningEl
                  key={o.id}
                  opening={o}
                  wall={project.wall}
                  pixelsPerFt={pixelsPerFt}
                  selected={selectedId === o.id}
                  onSelect={setSelectedId}
                  onMove={(id, xFt, yFt) => {
                    const wallW = project.wall.rect.widthFt;
                    const totalH =
                      project.wall.rect.heightFt + (project.wall.gable?.peakHeightFt ?? 0);
                    setProject((p) => ({
                      ...p,
                      openings: p.openings.map((op) => {
                        if (op.id !== id) return op;
                        const clampedX = Math.max(0, Math.min(xFt, wallW - op.widthFt));
                        const clampedY = Math.max(0, Math.min(yFt, totalH - op.heightFt));
                        return { ...op, x: clampedX, y: clampedY };
                      }),
                    }));
                  }}
                  trimColor={trimColorFor(
                    project.scope.phases.trim.materialId,
                    project.scope.phases.trim.colorHex,
                  )}
                />
              ))}
              <DimensionOverlay
                draft={draftRect}
                pixelsPerFt={pixelsPerFt}
                canvasHeightPx={project.canvas.heightFt * pixelsPerFt}
              />
            </CanvasSurface>
          </div>
        </div>
      </div>

      {/* Bottom drawer */}
      <ElementsDrawer
        project={project}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUpdateWall={(w) => setProject((p) => ({ ...p, wall: w }))}
        onUpdateOpening={(op) =>
          setProject((p) => ({ ...p, openings: p.openings.map((x) => (x.id === op.id ? op : x)) }))
        }
        onDeleteOpening={(id) =>
          setProject((p) => ({ ...p, openings: p.openings.filter((o) => o.id !== id) }))
        }
        onAdvance={() =>
          document.getElementById('materials')?.scrollIntoView({ behavior: 'smooth' })
        }
      />

      {/* Stage 2: materials */}
      {wallExists && (
        <section id="materials" className="border-t border-slate-200 bg-white px-6 py-6">
          <h2 className="text-lg font-semibold">Phases & materials</h2>
          <div className="mt-3">
            <PresetPicker
              selected={project.scope.presetId}
              onChange={(id) =>
                setProject((p) => ({
                  ...p,
                  scope:
                    id === 'custom'
                      ? { ...p.scope, presetId: id }
                      : { presetId: id, phases: applyPreset(id, p.scope.phases) },
                }))
              }
            />
          </div>
          <div className="mt-4 max-w-2xl">
            {(['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim'] as const).map(
              (phase) => (
                <PhaseRow
                  key={phase}
                  phase={phase}
                  enabled={project.scope.phases[phase].enabled}
                  materialId={project.scope.phases[phase].materialId}
                  colorHex={project.scope.phases[phase].colorHex}
                  onToggle={(en) =>
                    setProject((p) => ({
                      ...p,
                      scope: {
                        ...p.scope,
                        presetId: 'custom',
                        phases: {
                          ...p.scope.phases,
                          [phase]: { ...p.scope.phases[phase], enabled: en },
                        },
                      },
                    }))
                  }
                  onPick={(id) =>
                    setProject((p) => ({
                      ...p,
                      scope: {
                        ...p.scope,
                        phases: {
                          ...p.scope.phases,
                          [phase]: { ...p.scope.phases[phase], materialId: id },
                        },
                      },
                    }))
                  }
                  onColorChange={(hex) =>
                    setProject((p) => ({
                      ...p,
                      scope: {
                        ...p.scope,
                        phases: {
                          ...p.scope.phases,
                          [phase]: { ...p.scope.phases[phase], colorHex: hex },
                        },
                      },
                    }))
                  }
                />
              ),
            )}
          </div>
        </section>
      )}

      {/* Stage 3: outputs */}
      {materialsPicked && (
        <section id="outputs" className="border-t border-slate-200 bg-white px-6 py-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Materials list</h2>
            <QuoteCTA onClick={() => setLeadIntent('quote')} />
          </div>
          <div className="mt-3">
            <MaterialsTable lines={lines} />
          </div>
          <div className="mt-4">
            <ExportButtons projectId={project.id} />
          </div>
        </section>
      )}

      {leadIntent && (
        <LeadForm
          projectId={project.id}
          intent={leadIntent}
          onSuccess={() => {
            fetch(`/api/projects/${project.id}`, { cache: 'no-store' })
              .then((r) => r.json())
              .then((p: Project) => {
                setProject(p);
                setLeadIntent(null);
              });
          }}
          onClose={() => setLeadIntent(null)}
        />
      )}
    </main>
  );
}
