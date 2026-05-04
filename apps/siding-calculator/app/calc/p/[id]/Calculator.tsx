'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import type { Project, Opening, OpeningType, Elevation, Wall, Canvas } from '@/lib/types';
import { getActiveElevation } from '@/lib/types';
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
import { ElevationTabs } from '@/components/canvas/ElevationTabs';
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

function blankElevation(name: string): Elevation {
  return {
    id: ulid(),
    name,
    canvas: { widthFt: 30, heightFt: 12, snapInches: 12 },
    wall: { rect: { x: 3, y: 1, widthFt: 24, heightFt: 9 } },
    openings: [],
  };
}

export function Calculator({ initial }: { initial: Project }) {
  const [project, setProject] = useState<Project>(initial);
  const [selectedId, setSelectedId] = useState<string | null>('wall');
  const [leadIntent, setLeadIntent] = useState<'export' | 'quote' | null>(null);
  const draw = useDrawingTool();

  const active = getActiveElevation(project);

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
      const fitW = w / active.canvas.widthFt;
      const fitH = h / active.canvas.heightFt;
      setBasePixelsPerFt(Math.max(8, Math.min(fitW, fitH) * 0.95));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [active.canvas.widthFt, active.canvas.heightFt]);

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

  /** Apply an updater to the currently-active elevation. */
  function updateActive(updater: (e: Elevation) => Elevation) {
    setProject((p) => ({
      ...p,
      elevations: p.elevations.map((e) => (e.id === p.activeElevationId ? updater(e) : e)),
    }));
  }

  function setCanvas(c: Canvas) {
    updateActive((e) => ({ ...e, canvas: c }));
  }
  function setWall(w: Wall) {
    updateActive((e) => ({ ...e, wall: w }));
  }
  function updateOpening(op: Opening) {
    updateActive((e) => ({
      ...e,
      openings: e.openings.map((o) => (o.id === op.id ? op : o)),
    }));
  }
  function deleteOpening(id: string) {
    updateActive((e) => ({ ...e, openings: e.openings.filter((o) => o.id !== id) }));
  }

  function addElevation() {
    const name = `Elevation ${project.elevations.length + 1}`;
    const next = blankElevation(name);
    setProject((p) => ({
      ...p,
      elevations: [...p.elevations, next],
      activeElevationId: next.id,
    }));
    setSelectedId('wall');
  }
  function removeElevation(id: string) {
    if (project.elevations.length <= 1) return;
    setProject((p) => {
      const remaining = p.elevations.filter((e) => e.id !== id);
      return {
        ...p,
        elevations: remaining,
        activeElevationId: p.activeElevationId === id ? remaining[0].id : p.activeElevationId,
      };
    });
    setSelectedId('wall');
  }
  function renameElevation(id: string, name: string) {
    setProject((p) => ({
      ...p,
      elevations: p.elevations.map((e) => (e.id === id ? { ...e, name } : e)),
    }));
  }
  function selectElevation(id: string) {
    setProject((p) => ({ ...p, activeElevationId: id }));
    setSelectedId('wall');
  }

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
      setWall({ ...active.wall, rect });
    } else if (draw.tool === 'gable') {
      setWall({ ...active.wall, gable: { peakHeightFt: 4, peakOffsetFt: 0 } });
    } else {
      const type = draw.tool as OpeningType;
      const def = OPENING_DEFAULTS[type];
      const wallW = active.wall.rect.widthFt;
      const wallH = active.wall.rect.heightFt;
      const totalH = wallH + (active.wall.gable?.peakHeightFt ?? 0);
      const wx = Math.max(0, rect.x - active.wall.rect.x);
      const wy = Math.max(0, rect.y - active.wall.rect.y);
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
      updateActive((e) => ({ ...e, openings: [...e.openings, op] }));
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
  const wallExists = project.elevations.some(
    (e) => e.wall.rect.widthFt > 0 && e.wall.rect.heightFt > 0,
  );
  const materialsPicked = lines.length > 0;

  return (
    <main className="flex min-h-screen flex-col">
      <ElevationTabs
        elevations={project.elevations}
        activeId={project.activeElevationId}
        onSelect={selectElevation}
        onAdd={addElevation}
        onRemove={removeElevation}
        onRename={renameElevation}
      />

      {/* Stage 1: canvas with help gutter */}
      <div className="flex h-[calc(100vh-200px)] min-h-[420px] shrink-0">
        <HelpPanel />
        <div ref={containerRef} className="relative flex-1 bg-[var(--paper)]">
          <Toolbar
            canvas={active.canvas}
            onCanvasChange={setCanvas}
            tool={draw.tool}
            onToolChange={draw.setTool}
            zoom={zoom}
            onZoomChange={setZoom}
          />
          <div className="grid h-full place-items-center overflow-auto">
            <CanvasSurface
              size={active.canvas}
              pixelsPerFt={pixelsPerFt}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <FinishDefs
                pixelsPerFt={pixelsPerFt}
                sidingMaterialId={project.scope.phases.siding.materialId}
                sidingColorHex={
                  (project.scope.phases.paint.enabled && project.scope.phases.paint.colorHex) ||
                  project.scope.phases.siding.colorHex
                }
              />
              <WallShape
                wall={active.wall}
                pixelsPerFt={pixelsPerFt}
                selected={selectedId === 'wall'}
                onSelect={() => setSelectedId('wall')}
                sidingFill={
                  project.scope.phases.siding.enabled
                    ? sidingFillFor(
                        project.scope.phases.siding.materialId,
                        (project.scope.phases.paint.enabled &&
                          project.scope.phases.paint.colorHex) ||
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
              {active.openings.map((o) => (
                <OpeningEl
                  key={o.id}
                  opening={o}
                  wall={active.wall}
                  pixelsPerFt={pixelsPerFt}
                  selected={selectedId === o.id}
                  onSelect={setSelectedId}
                  onMove={(id, xFt, yFt) => {
                    const wallW = active.wall.rect.widthFt;
                    const totalH =
                      active.wall.rect.heightFt + (active.wall.gable?.peakHeightFt ?? 0);
                    updateActive((e) => ({
                      ...e,
                      openings: e.openings.map((op) => {
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
                canvasHeightPx={active.canvas.heightFt * pixelsPerFt}
              />
            </CanvasSurface>
          </div>
        </div>
      </div>

      {/* Bottom drawer */}
      <ElementsDrawer
        elevation={active}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUpdateWall={setWall}
        onUpdateOpening={updateOpening}
        onDeleteOpening={deleteOpening}
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
            {(['insulation', 'sheathing', 'vaporBarrier', 'siding', 'trim', 'paint'] as const).map(
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
