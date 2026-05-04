'use client';
import React from 'react';
import type { Project, Opening as OpeningT } from '@/lib/types';

type Props = {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateWall: (next: Project['wall']) => void;
  onUpdateOpening: (next: OpeningT) => void;
  onDeleteOpening: (id: string) => void;
  onAdvance: () => void;
};

function NumberCell({
  label,
  value,
  onChange,
  suffix = "'",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <input
        type="number"
        step={0.5}
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 border-b border-slate-300 px-1 text-right"
      />
      <span className="text-slate-400">{suffix}</span>
    </label>
  );
}

export function ElementsDrawer({
  project,
  selectedId,
  onSelect,
  onUpdateWall,
  onUpdateOpening,
  onDeleteOpening,
  onAdvance,
}: Props) {
  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start gap-6 overflow-x-auto">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect('wall')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect('wall');
          }}
          className={`shrink-0 cursor-pointer rounded border px-3 py-2 ${selectedId === 'wall' ? 'border-slate-900' : 'border-slate-200'}`}
        >
          <div className="text-xs uppercase tracking-wide text-slate-500">Wall</div>
          <div className="mt-1 flex items-center gap-2">
            <NumberCell
              label="W"
              value={project.wall.rect.widthFt}
              onChange={(v) =>
                onUpdateWall({ ...project.wall, rect: { ...project.wall.rect, widthFt: v } })
              }
            />
            <NumberCell
              label="H"
              value={project.wall.rect.heightFt}
              onChange={(v) =>
                onUpdateWall({ ...project.wall, rect: { ...project.wall.rect, heightFt: v } })
              }
            />
          </div>
          {project.wall.gable && (
            <div className="mt-1 flex items-center gap-2">
              <NumberCell
                label="Gable peak"
                value={project.wall.gable.peakHeightFt}
                onChange={(v) =>
                  onUpdateWall({
                    ...project.wall,
                    gable: { peakOffsetFt: project.wall.gable!.peakOffsetFt, peakHeightFt: v },
                  })
                }
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateWall({ ...project.wall, gable: undefined });
                }}
                className="text-xs text-slate-500 underline"
              >
                remove gable
              </button>
            </div>
          )}
        </div>

        {project.openings.map((o) => (
          <div
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`shrink-0 rounded border px-3 py-2 ${selectedId === o.id ? 'border-slate-900' : 'border-slate-200'}`}
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{o.type}</div>
            <div className="mt-1 flex items-center gap-2">
              <NumberCell
                label="W"
                value={o.widthFt}
                onChange={(v) => onUpdateOpening({ ...o, widthFt: v })}
              />
              <NumberCell
                label="H"
                value={o.heightFt}
                onChange={(v) => onUpdateOpening({ ...o, heightFt: v })}
              />
              <NumberCell label="x" value={o.x} onChange={(v) => onUpdateOpening({ ...o, x: v })} />
              <NumberCell label="y" value={o.y} onChange={(v) => onUpdateOpening({ ...o, y: v })} />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOpening(o.id);
              }}
              className="mt-1 text-xs text-red-600 underline"
            >
              delete
            </button>
          </div>
        ))}

        <div className="ml-auto self-center">
          <button
            onClick={onAdvance}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-white"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
