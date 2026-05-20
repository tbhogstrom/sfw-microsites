'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageDrop } from '@/components/ImageDrop';
import { TraceCanvas } from '@/components/TraceCanvas';
import { Toolbar } from '@/components/Toolbar';
import { SegmentsTable } from '@/components/SegmentsTable';
import { AnglesTable } from '@/components/AnglesTable';
import { ShareUrl } from '@/components/ShareUrl';
import { PrintView } from '@/components/PrintView';
import { rotateAroundVertex, stretchSegmentLength } from '@/lib/geometry';
import type { ImageRef, LabelOffset, ToolMode, Trace, TraceProject } from '@/lib/types';

type Props = { initial: TraceProject };

export function Editor({ initial }: Props) {
  const [project, setProject] = useState<TraceProject>(initial);
  const [tool, setTool] = useState<ToolMode>('trace');
  const [zoom, setZoom] = useState(1);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const firstRender = useRef(true);

  // Autosave debounce.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(project),
        });
        setSaveState(res.ok ? 'idle' : 'error');
      } catch {
        setSaveState('error');
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [project]);

  // Esc → switch to select while tracing or labeling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tool !== 'select') setTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);

  const updateTrace = useCallback((next: Trace) => {
    setProject((p) => ({ ...p, trace: next }));
  }, []);

  const setImage = useCallback((image: ImageRef | null) => {
    setProject((p) => ({ ...p, image }));
  }, []);

  const setView = useCallback((view: 'image' | 'detail') => {
    setProject((p) => ({ ...p, view }));
  }, []);

  const setLabel = useCallback((pointId: string, label: string) => {
    setProject((p) => {
      const next = { ...p.labels };
      if (label.trim() === '') delete next[pointId];
      else next[pointId] = label.trim();
      return { ...p, labels: next };
    });
  }, []);

  const setLabelOffset = useCallback((pointId: string, offset: LabelOffset | null) => {
    setProject((p) => {
      const next = { ...p.labelOffsets };
      if (offset == null || (offset.dx === 0 && offset.dy === 0)) {
        delete next[pointId];
      } else {
        next[pointId] = offset;
      }
      return { ...p, labelOffsets: next };
    });
  }, []);

  const editSegmentLength = useCallback((segmentIndex: number, newLengthInches: number) => {
    setProject((p) => {
      const ipp = p.trace.inchesPerPixel;
      if (ipp == null || ipp <= 0) return p;
      const newLengthPx = newLengthInches / ipp;
      return {
        ...p,
        trace: {
          ...p.trace,
          points: stretchSegmentLength(p.trace.points, segmentIndex, newLengthPx),
        },
      };
    });
  }, []);

  const editAngle = useCallback((vertexIndex: number, newAngleDeg: number) => {
    setProject((p) => ({
      ...p,
      trace: { ...p.trace, points: rotateAroundVertex(p.trace.points, vertexIndex, newAngleDeg) },
    }));
  }, []);

  if (!project.image) {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-xl font-semibold">Flashing Tracer</h1>
          <p className="text-sm text-slate-500">Step 1 — load a drawing image to trace.</p>
        </header>
        <ImageDrop projectId={project.id} onUploaded={setImage} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col print-root">
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onClearPoints={() => updateTrace({ points: [], inchesPerPixel: null })}
        onNewImage={() => setImage(null)}
        pointCount={project.trace.points.length}
        scaleSet={project.trace.inchesPerPixel != null}
        zoom={zoom}
        onZoomChange={setZoom}
        view={project.view}
        onViewChange={setView}
        saveState={saveState}
        onPrint={() => window.print()}
      />

      <PrintView
        projectId={project.id}
        trace={project.trace}
        labels={project.labels}
        labelOffsets={project.labelOffsets}
      />

      <div className="flex flex-1 min-h-[60vh] print-body">
        <div className="relative flex-1 border-r border-slate-200 print-screen">
          <TraceCanvas
            projectId={project.id}
            image={project.image}
            trace={project.trace}
            labels={project.labels}
            labelOffsets={project.labelOffsets}
            tool={tool}
            view={project.view}
            zoom={zoom}
            onZoomChange={setZoom}
            onTraceChange={updateTrace}
            onLabelChange={setLabel}
            onLabelOffsetChange={setLabelOffset}
          />
        </div>
        <aside className="print-sidebar flex w-96 flex-col gap-4 overflow-auto bg-slate-50 p-4">
          <ShareUrl projectId={project.id} />
          <SegmentsTable
            trace={project.trace}
            labels={project.labels}
            onEditLength={editSegmentLength}
            onEditLabel={setLabel}
          />
          <AnglesTable trace={project.trace} onEditAngle={editAngle} />
          <div className="rounded-md bg-white p-3 text-xs leading-relaxed text-slate-600 no-print">
            <div className="font-medium text-slate-700">Tips</div>
            <ul className="mt-1 list-disc pl-4">
              <li>Trace: click to drop points. Esc to finish.</li>
              <li>Select: drag a vertex; right-click deletes it.</li>
              <li>Click a segment in Select mode to set the real length.</li>
              <li>Label: click a segment, type a name (e.g. &quot;Drip leg&quot;).</li>
              <li>Detail view hides the image for a clean shop-drawing print.</li>
              <li>Edit any length or angle directly in the tables.</li>
              <li>Ctrl/Cmd+scroll zoom · Space+drag (or middle-mouse) pan.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
