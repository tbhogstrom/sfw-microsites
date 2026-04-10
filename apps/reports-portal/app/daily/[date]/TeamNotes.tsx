'use client';

import { useState, useEffect, useCallback } from 'react';

export default function TeamNotes({ date }: { date: string }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/notes?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes || '');
        if (data.updated_at) setLastSaved(data.updated_at);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [date]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, notes }),
      });
      setLastSaved(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  }, [date, notes]);

  if (!loaded) return null;

  return (
    <div
      style={{
        margin: '24px 0',
        padding: '16px',
        background: '#fff',
        border: '1px solid #e0ddd8',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1a3a2a' }}>
          Team Notes
        </h3>
        {lastSaved && (
          <span style={{ fontSize: '11px', color: '#999' }}>
            Last saved {new Date(lastSaved).toLocaleString()}
          </span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this day's reports..."
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          fontFamily: 'inherit',
          fontSize: '13px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ marginTop: '8px', textAlign: 'right' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '6px 16px',
            background: saving ? '#999' : '#1a3a2a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  );
}
