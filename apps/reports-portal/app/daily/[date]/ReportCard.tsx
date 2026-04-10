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
          <div
            style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}
          >
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
