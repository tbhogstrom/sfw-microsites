'use client';
import React from 'react';
import type { Elevation, Wall, Opening as OpeningT } from '@/lib/types';

type Props = {
  elevation: Elevation;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateWall: (next: Wall) => void;
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

function Bubble({
  label,
  dims,
  selected,
  onClick,
}: {
  label: string;
  dims: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
        selected
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className="font-medium uppercase tracking-wide">{label}</span>
      <span className={`ml-2 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{dims}</span>
    </button>
  );
}

function fmtDim(v: number): string {
  return `${Number.isInteger(v) ? v : v.toFixed(1)}'`;
}

export function ElementsDrawer({
  elevation,
  selectedId,
  onSelect,
  onUpdateWall,
  onUpdateOpening,
  onDeleteOpening,
  onAdvance,
}: Props) {
  const project = { wall: elevation.wall, openings: elevation.openings };
  const selectedOpening =
    selectedId && selectedId !== 'wall'
      ? (elevation.openings.find((o) => o.id === selectedId) ?? null)
      : null;
  const wallSelected = selectedId === 'wall';

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      {/* Header row — always visible */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          Wall {fmtDim(project.wall.rect.widthFt)}×{fmtDim(project.wall.rect.heightFt)}
          {project.wall.gable && (
            <span className="ml-1 text-slate-400">
              + gable {fmtDim(project.wall.gable.peakHeightFt)}
            </span>
          )}
          {project.openings.length > 0 && (
            <span className="ml-2 text-slate-400">
              · {project.openings.length} opening{project.openings.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <button
          onClick={onAdvance}
          className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white"
        >
          Next → materials
        </button>
      </div>

      {/* Bubbles row — wraps */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Bubble
          label="Wall"
          dims={`${fmtDim(project.wall.rect.widthFt)}×${fmtDim(project.wall.rect.heightFt)}`}
          selected={wallSelected}
          onClick={() => onSelect(wallSelected ? null : 'wall')}
        />
        {project.openings.map((o) => (
          <Bubble
            key={o.id}
            label={o.type}
            dims={`${fmtDim(o.widthFt)}×${fmtDim(o.heightFt)}`}
            selected={selectedId === o.id}
            onClick={() => onSelect(selectedId === o.id ? null : o.id)}
          />
        ))}
      </div>

      {/* Inspector — only shows when something is selected */}
      {wallSelected && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Wall</span>
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
          {project.wall.gable && (
            <>
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
                onClick={() => onUpdateWall({ ...project.wall, gable: undefined })}
                className="text-xs text-slate-500 underline"
              >
                remove gable
              </button>
            </>
          )}
        </div>
      )}

      {selectedOpening && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {selectedOpening.type}
          </span>
          <NumberCell
            label="W"
            value={selectedOpening.widthFt}
            onChange={(v) => onUpdateOpening({ ...selectedOpening, widthFt: v })}
          />
          <NumberCell
            label="H"
            value={selectedOpening.heightFt}
            onChange={(v) => onUpdateOpening({ ...selectedOpening, heightFt: v })}
          />
          <NumberCell
            label="x"
            value={selectedOpening.x}
            onChange={(v) => onUpdateOpening({ ...selectedOpening, x: v })}
          />
          <NumberCell
            label="y"
            value={selectedOpening.y}
            onChange={(v) => onUpdateOpening({ ...selectedOpening, y: v })}
          />
          <button
            onClick={() => onDeleteOpening(selectedOpening.id)}
            className="ml-auto text-xs text-red-600 underline"
          >
            delete
          </button>
        </div>
      )}
    </div>
  );
}
