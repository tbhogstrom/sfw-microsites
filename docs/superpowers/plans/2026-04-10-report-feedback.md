# Report Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow team members to give feedback on individual daily project reports, have Claude Opus revise the report, and display the revision with the ability to view the original or revert.

**Architecture:** New API route calls Claude to revise report HTML based on user feedback, stores the revision as a sibling blob. A client-side ReportCard wrapper renders the report HTML with controls outside it. The daily page server component fetches both original and revised blobs and passes them to ReportCard.

**Tech Stack:** Next.js 16 App Router, Vercel Blob, Anthropic SDK (`@anthropic-ai/sdk`), React 19

---

### File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Create | `app/api/feedback/route.ts` | POST handler: apply feedback via Claude |
| Create | `app/api/feedback/revert/route.ts` | POST handler: delete revision blobs |
| Create | `app/daily/[date]/ReportCard.tsx` | Client component: report wrapper with feedback UI |
| Modify | `app/daily/[date]/page.tsx` | Refactor to extract projectId per report, fetch revisions, render ReportCard |
| Modify | `package.json` | Add `@anthropic-ai/sdk` dependency |

---

### Task 1: Install Anthropic SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the SDK**

Run from `apps/reports-portal`:

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Verify it installed**

Run: `node -e "require('@anthropic-ai/sdk')"`
Expected: No error

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(reports-portal): add anthropic SDK for report feedback"
```

Note: The root `package-lock.json` is at `/c/Users/tfalcon/microsites/package-lock.json`. Add that too if it changed.

---

### Task 2: Create POST /api/feedback route

**Files:**
- Create: `app/api/feedback/route.ts`

- [ ] **Step 1: Create the feedback API route**

Create `app/api/feedback/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 503 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const { date, projectId, feedback } = await request.json();
  if (!date || !projectId || !feedback) {
    return NextResponse.json({ error: 'date, projectId, and feedback are required' }, { status: 400 });
  }

  // Fetch the current report HTML (revised if exists, otherwise original)
  const prefix = `daily/${date}/${projectId}`;
  const { blobs } = await list({ prefix, token });

  const revisedBlob = blobs.find((b) => b.pathname === `${prefix}.revised.html`);
  const originalBlob = blobs.find((b) => b.pathname === `${prefix}.html`);
  const sourceBlob = revisedBlob || originalBlob;

  if (!sourceBlob) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const resp = await fetch(sourceBlob.downloadUrl, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
  const reportHtml = await resp.text();

  // Call Claude to apply the feedback
  const anthropic = new Anthropic({ apiKey });
  let revisedHtml: string;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: `You are editing a construction field report. Apply the following feedback to the report HTML below. Only change what the feedback asks for. Preserve all HTML structure, styling, and formatting. Return only the revised HTML with no other text.

Feedback: ${feedback}

Report HTML:
${reportHtml}`,
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Claude returned no text' }, { status: 500 });
    }
    revisedHtml = textBlock.text;
  } catch (e) {
    return NextResponse.json(
      { error: `Claude API error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  // Store revised HTML
  await put(`${prefix}.revised.html`, revisedHtml, {
    access: 'private',
    contentType: 'text/html',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  // Store feedback metadata
  await put(
    `${prefix}.feedback.json`,
    JSON.stringify({ feedback, applied_at: new Date().toISOString() }),
    {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    },
  );

  return NextResponse.json({ ok: true, html: revisedHtml });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat(reports-portal): add feedback API route with Claude integration"
```

---

### Task 3: Create POST /api/feedback/revert route

**Files:**
- Create: `app/api/feedback/revert/route.ts`

- [ ] **Step 1: Create the revert API route**

Create `app/api/feedback/revert/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 503 });
  }

  const { date, projectId } = await request.json();
  if (!date || !projectId) {
    return NextResponse.json({ error: 'date and projectId are required' }, { status: 400 });
  }

  const prefix = `daily/${date}/${projectId}`;
  const { blobs } = await list({ prefix, token });

  const toDelete = blobs.filter(
    (b) => b.pathname === `${prefix}.revised.html` || b.pathname === `${prefix}.feedback.json`,
  );

  for (const blob of toDelete) {
    await del(blob.url, { token });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/feedback/revert/route.ts
git commit -m "feat(reports-portal): add feedback revert API route"
```

---

### Task 4: Create ReportCard client component

**Files:**
- Create: `app/daily/[date]/ReportCard.tsx`

- [ ] **Step 1: Create the ReportCard component**

Create `app/daily/[date]/ReportCard.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';

interface ReportCardProps {
  originalHtml: string;
  revisedHtml: string | null;
  projectId: string;
  date: string;
  feedbackAppliedAt: string | null;
}

export default function ReportCard({
  originalHtml,
  revisedHtml: initialRevisedHtml,
  projectId,
  date,
  feedbackAppliedAt: initialAppliedAt,
}: ReportCardProps) {
  const [revisedHtml, setRevisedHtml] = useState(initialRevisedHtml);
  const [appliedAt, setAppliedAt] = useState(initialAppliedAt);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reverting, setReverting] = useState(false);

  const isRevised = revisedHtml !== null;
  const displayHtml = showingOriginal ? originalHtml : (revisedHtml ?? originalHtml);

  const applyFeedback = useCallback(async () => {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, projectId, feedback: feedbackText }),
      });
      const data = await resp.json();
      if (data.ok && data.html) {
        setRevisedHtml(data.html);
        setAppliedAt(new Date().toISOString());
        setShowingOriginal(false);
        setFeedbackText('');
        setFeedbackOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }, [date, projectId, feedbackText]);

  const revert = useCallback(async () => {
    setReverting(true);
    try {
      await fetch('/api/feedback/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, projectId }),
      });
      setRevisedHtml(null);
      setAppliedAt(null);
      setShowingOriginal(false);
    } finally {
      setReverting(false);
    }
  }, [date, projectId]);

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Revised status bar */}
      {isRevised && !showingOriginal && (
        <div
          style={{
            background: '#e8f5e9',
            border: '1px solid #c8e6c9',
            borderRadius: '8px 8px 0 0',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#2e7d32' }}>Revised</span>
          {appliedAt && (
            <span style={{ fontSize: '11px', color: '#666' }}>
              Feedback applied {new Date(appliedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Showing-original status bar */}
      {isRevised && showingOriginal && (
        <div
          style={{
            background: '#fff3e0',
            border: '1px solid #ffe0b2',
            borderRadius: '8px 8px 0 0',
            padding: '6px 16px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e65100' }}>
            Viewing Original
          </span>
        </div>
      )}

      {/* Report HTML */}
      <div
        style={{
          borderLeft: '1px solid #e0ddd8',
          borderRight: '1px solid #e0ddd8',
          borderBottom: '1px solid #e0ddd8',
          borderTop: isRevised ? 'none' : '1px solid #e0ddd8',
          borderRadius: isRevised ? '0' : '8px 8px 0 0',
        }}
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />

      {/* Controls bar */}
      <div
        style={{
          background: '#f0efeb',
          border: '1px solid #e0ddd8',
          borderTop: 'none',
          borderRadius: feedbackOpen ? '0' : '0 0 8px 8px',
          padding: '8px 16px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        {isRevised && (
          <>
            <button
              onClick={() => setShowingOriginal(!showingOriginal)}
              style={{
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '12px',
                color: '#666',
                cursor: 'pointer',
              }}
            >
              {showingOriginal ? 'View Revised' : 'View Original'}
            </button>
            <button
              onClick={revert}
              disabled={reverting}
              style={{
                background: 'none',
                border: '1px solid #e57373',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '12px',
                color: reverting ? '#999' : '#c62828',
                cursor: reverting ? 'default' : 'pointer',
              }}
            >
              {reverting ? 'Reverting...' : 'Revert to Original'}
            </button>
          </>
        )}
        <button
          onClick={() => setFeedbackOpen(!feedbackOpen)}
          style={{
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '4px 12px',
            fontSize: '12px',
            color: '#666',
            cursor: 'pointer',
          }}
        >
          Give Feedback
        </button>
      </div>

      {/* Feedback panel */}
      {feedbackOpen && (
        <div
          style={{
            background: '#f8f7f4',
            border: '1px solid #e0ddd8',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: '12px 16px',
          }}
        >
          <label
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#1a3a2a',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            What needs to change?
          </label>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="e.g. It was 8 joists not 12, and we also installed flashing along the ledger board..."
            disabled={submitting}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '13px',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setFeedbackOpen(false);
                setFeedbackText('');
              }}
              disabled={submitting}
              style={{
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '5px 14px',
                fontSize: '12px',
                color: '#666',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={applyFeedback}
              disabled={submitting || !feedbackText.trim()}
              style={{
                background: submitting ? '#999' : '#1a3a2a',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 14px',
                fontSize: '12px',
                color: '#fff',
                cursor: submitting ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Applying...' : 'Apply Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/daily/[date]/ReportCard.tsx
git commit -m "feat(reports-portal): add ReportCard component with feedback UI"
```

---

### Task 5: Refactor daily page to use ReportCard

**Files:**
- Modify: `app/daily/[date]/page.tsx`

- [ ] **Step 1: Rewrite the daily page to fetch per-report metadata and render ReportCard**

Replace the contents of `app/daily/[date]/page.tsx` with:

```tsx
import { list } from '@vercel/blob';
import TeamNotes from './TeamNotes';
import ReportCard from './ReportCard';

export const dynamic = 'force-dynamic';

interface ReportData {
  projectId: string;
  originalHtml: string;
  revisedHtml: string | null;
  feedbackAppliedAt: string | null;
}

export default async function DailyReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const { blobs } = await list({ prefix: `daily/${date}/`, token });

  // Find all original report HTML files (exclude .revised.html)
  const originalBlobs = blobs.filter(
    (b) => b.pathname.endsWith('.html') && !b.pathname.endsWith('.revised.html'),
  );

  const reports: ReportData[] = [];

  for (const blob of originalBlobs) {
    // Extract projectId: "daily/2026-04-10/abc123.html" -> "abc123"
    const filename = blob.pathname.split('/').pop() || '';
    const projectId = filename.replace('.html', '');

    // Fetch original HTML
    const origResp = await fetch(blob.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!origResp.ok) continue;
    const originalHtml = await origResp.text();

    // Check for revised version
    let revisedHtml: string | null = null;
    const revisedBlob = blobs.find(
      (b) => b.pathname === `daily/${date}/${projectId}.revised.html`,
    );
    if (revisedBlob) {
      const revResp = await fetch(revisedBlob.downloadUrl, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (revResp.ok) {
        revisedHtml = await revResp.text();
      }
    }

    // Check for feedback metadata
    let feedbackAppliedAt: string | null = null;
    const feedbackBlob = blobs.find(
      (b) => b.pathname === `daily/${date}/${projectId}.feedback.json`,
    );
    if (feedbackBlob) {
      const fbResp = await fetch(feedbackBlob.downloadUrl, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fbResp.ok) {
        const fbData = await fbResp.json();
        feedbackAppliedAt = fbData.applied_at || null;
      }
    }

    reports.push({ projectId, originalHtml, revisedHtml, feedbackAppliedAt });
  }

  const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: '-apple-system, sans-serif' }}
    >
      <header
        style={{
          background: '#1a3a2a',
          padding: '16px 24px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px' }}>
          ← Back
        </a>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
          Daily Reports — {dateFormatted}
        </h1>
      </header>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px' }}>
        <TeamNotes date={date} />
        {reports.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
            No reports found for this date.
          </p>
        ) : (
          reports.map((report) => (
            <ReportCard
              key={report.projectId}
              originalHtml={report.originalHtml}
              revisedHtml={report.revisedHtml}
              projectId={report.projectId}
              date={date}
              feedbackAppliedAt={report.feedbackAppliedAt}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page still renders**

Run: `npm run dev` from `apps/reports-portal` and visit a daily report page. Confirm reports render with the "Give Feedback" button below each one.

- [ ] **Step 3: Commit**

```bash
git add app/daily/[date]/page.tsx
git commit -m "feat(reports-portal): refactor daily page to use ReportCard with feedback support"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Test the full feedback flow locally**

1. Run `npm run dev` from `apps/reports-portal`.
2. Navigate to a daily report page with existing reports.
3. Click "Give Feedback" on a report card.
4. Enter feedback text like "Change 12 joists to 8 joists".
5. Click "Apply Feedback" — verify loading state shows, then the revised report appears with the green "Revised" badge.
6. Click "View Original" — verify it toggles to the original report with an orange "Viewing Original" bar.
7. Click "View Revised" — verify it toggles back.
8. Click "Give Feedback" again on the revised report — verify you can apply another round.
9. Click "Revert to Original" — verify it removes the revision and returns to the original.

- [ ] **Step 2: Commit all remaining changes and push**

```bash
git add -A
git commit -m "feat(reports-portal): report feedback feature complete"
```

Then push with `./pushall.ps1` from the repo root.
