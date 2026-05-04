'use client';
import React from 'react';

export function HelpPanel() {
  return (
    <aside className="hidden w-[200px] shrink-0 border-r border-slate-200 bg-white px-4 py-6 lg:block">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        How to use
      </h4>
      <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600">
        <li>
          <span className="font-semibold text-slate-700">1.</span> Pick a tool above (wall, window,
          door…).
        </li>
        <li>
          <span className="font-semibold text-slate-700">2.</span> Click and drag on the canvas to
          draw it to scale.
        </li>
        <li>
          <span className="font-semibold text-slate-700">3.</span> Drag any opening to reposition
          it. Click to edit dimensions in the drawer.
        </li>
        <li>
          <span className="font-semibold text-slate-700">4.</span> Hold{' '}
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1 py-0.5 text-[10px]">
            Ctrl
          </kbd>{' '}
          and scroll to zoom.
        </li>
      </ol>
      <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
        Once you've drawn the wall, scroll down to pick materials and download your scope.
      </p>
    </aside>
  );
}
