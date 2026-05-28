'use client';

import React from 'react';

/**
 * Submittal cover sheet — an editable, printable one-page form.
 * Modeled on the Autodesk Construction Cloud "Submittal item detail" sheet,
 * rebranded for WRB Construction. Fields removed per markup: Ball in court,
 * Manager, Responsible contractor, Watchers, Spec sub section, and the
 * CERTA review stamp. Every remaining field is editable; use the browser's
 * print dialog to produce a clean copy.
 */
export default function SubmittalCoverSheet() {
  return (
    <main className="submittal-sheet mx-auto max-w-[8.5in] px-6 py-6 print:px-0 print:py-0">
      <div className="no-print mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Click any field to edit, then print (system print is fine).
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Print
        </button>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
          <div className="min-w-0 flex-1">
            <Line
              aria-label="Project"
              defaultValue=""
              placeholder="25-015 · RIVERPLACE CONDOMINIUMS"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            />
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Submittal item detail
            </p>
            <Line
              aria-label="Submittal title"
              defaultValue=""
              placeholder="#085313-1-2: VINYL WINDOWS"
              className="mt-1 text-2xl font-semibold text-[var(--accent)]"
            />
          </div>
          <img
            src="/wrb-logo.png"
            alt="WRB Construction"
            className="h-20 w-20 shrink-0 object-contain"
          />
        </header>

        {/* Status band */}
        <section className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 print:border-slate-300">
          <BandCell label="Status">
            <Line aria-label="Status" placeholder="Open · In Review" className="font-semibold" />
          </BandCell>
          <BandCell label="Created on">
            <Line aria-label="Created on" placeholder="Aug 5, 2025" />
          </BandCell>
          <BandCell label="Ball in court due date">
            <Line aria-label="Ball in court due date" placeholder="Dec 16, 2025" />
          </BandCell>
        </section>

        {/* Field rows */}
        <section className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <Row label="ID">
            <Line aria-label="ID" placeholder="7" />
          </Row>
          <Row label="Pending action from">
            <Line aria-label="Pending action from" placeholder="Name (Company)" />
          </Row>
          <Row label="Spec section">
            <Line aria-label="Spec section" placeholder="085313 VINYL WINDOWS" />
          </Row>
          <Row label="Type">
            <Line aria-label="Type" placeholder="Product Data" />
          </Row>
          <Row label="Description">
            <Area aria-label="Description" rows={2} />
          </Row>
          <Row label="Final Response">
            <Area aria-label="Final Response" rows={2} />
          </Row>
          <Row label="Final Response Attachments">
            <Line aria-label="Final Response Attachments" />
          </Row>
          <Row label="Final Response Comments">
            <Area aria-label="Final Response Comments" rows={2} />
          </Row>
          <Row label="Package">
            <Line aria-label="Package" />
          </Row>
        </section>
      </article>
    </main>
  );
}

/** A label/value table row matching the source sheet's gray-label layout. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[170px_1fr] border-b border-slate-200 last:border-b-0">
      <div className="bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500 print:bg-transparent">
        {label}
      </div>
      <div className="px-3 py-1.5">{children}</div>
    </div>
  );
}

/** A cell in the top status band: small gray label over an editable value. */
function BandCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const fieldBase =
  'w-full rounded-sm bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-300 ' +
  'hover:bg-slate-50 focus:bg-blue-50/50';

/** Single-line editable field. */
function Line({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={`${fieldBase} ${className}`} {...props} />;
}

/** Multi-line editable field. */
function Area({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} resize-y leading-snug ${className}`} {...props} />;
}
