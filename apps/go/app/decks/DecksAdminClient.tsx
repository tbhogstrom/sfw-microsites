'use client';

import { useEffect, useState } from 'react';
import type { Deck, Slide, SlideType } from '@/lib/decks';

const GREEN = '#1a3a2a';

export default function DecksAdminClient({
  initialDecks,
  storageError,
}: {
  initialDecks: Deck[];
  storageError: string | null;
}) {
  const [decks, setDecks] = useState<Deck[]>(initialDecks);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function refresh() {
    // Re-fetch each deck in full so the per-deck editors stay in sync.
    const res = await fetch('/api/decks');
    if (!res.ok) return;
    const { decks: summaries } = await res.json();
    const full = await Promise.all(
      (summaries ?? []).map(async (s: { slug: string }) => {
        const r = await fetch(`/api/decks/${encodeURIComponent(s.slug)}`);
        return r.ok ? (await r.json()).deck : null;
      }),
    );
    setDecks(full.filter(Boolean));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug: slug || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setTitle('');
      setSlug('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteDeck(s: string) {
    if (!confirm(`Delete deck "${s}" and all its slides?`)) return;
    await fetch(`/api/decks/${encodeURIComponent(s)}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8f7f4',
        fontFamily: '-apple-system, sans-serif',
        color: '#222',
        padding: '32px 16px',
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <a href="/" style={{ fontSize: '13px', color: GREEN }}>
          ← Short links
        </a>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: GREEN, margin: '8px 0 4px' }}>
          SFW Decks
        </h1>
        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>
          Create and manage slide decks.
        </p>

        {storageError && (
          <div
            style={{
              background: '#fff4e5',
              border: '1px solid #f0c890',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#8a5a00',
              marginBottom: '20px',
            }}
          >
            Storage isn&apos;t ready yet: {storageError}.
          </div>
        )}

        <form
          onSubmit={handleCreate}
          style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '20px',
            marginBottom: '28px',
          }}
        >
          <label style={labelStyle}>Deck title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly Review — Week 12"
            style={inputStyle}
          />
          <label style={labelStyle}>Custom slug (optional)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-generated"
            style={inputStyle}
          />
          {error && (
            <p style={{ color: '#e53e3e', fontSize: '13px', margin: '4px 0 0' }}>{error}</p>
          )}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, marginTop: '14px' }}>
            {busy ? 'Creating…' : 'Create deck'}
          </button>
        </form>

        {decks.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#999', textAlign: 'center' }}>No decks yet.</p>
        ) : (
          decks.map((deck) => (
            <DeckEditor
              key={deck.slug}
              deck={deck}
              origin={origin}
              onChange={refresh}
              onDelete={deleteDeck}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DeckEditor({
  deck,
  origin,
  onChange,
  onDelete,
}: {
  deck: Deck;
  origin: string;
  onChange: () => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
}) {
  const [type, setType] = useState<SlideType>('markdown');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  function bodyFor(): Record<string, unknown> | null {
    if (type === 'markdown')
      return value.trim() ? { type, content: value, notes: notes || undefined } : null;
    if (type === 'html')
      return value.trim() ? { type, html: value, notes: notes || undefined } : null;
    return value.trim() ? { type, url: value.trim(), notes: notes || undefined } : null;
  }

  async function addSlide() {
    const body = bodyFor();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(deck.slug)}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? 'Failed to add slide');
        return;
      }
      setValue('');
      setNotes('');
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/decks/${encodeURIComponent(deck.slug)}/media`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? 'Upload failed');
        return;
      }
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function patch(op: unknown) {
    const res = await fetch(`/api/decks/${encodeURIComponent(deck.slug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? 'Operation failed');
      return;
    }
    await onChange();
  }

  async function move(index: number, dir: -1 | 1) {
    const order = deck.slides.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    setBusy(true);
    try {
      await patch({ op: 'reorder', order });
    } finally {
      setBusy(false);
    }
  }

  function describe(s: Slide): string {
    if (s.type === 'markdown') return s.content.split('\n')[0].slice(0, 60);
    if (s.type === 'html') return '<html block>';
    if (s.type === 'image') return `image: ${s.url.split('/').pop() ?? ''}`.trim();
    return s.url;
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '18px',
        marginBottom: '18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: GREEN }}>{deck.title}</div>
          <a
            href={`${origin}/d/${deck.slug}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#888' }}
          >
            {origin}/d/{deck.slug} · {deck.slides.length} slides
          </a>
        </div>
        <button onClick={() => onDelete(deck.slug)} style={{ ...ghostButton, color: '#e53e3e' }}>
          Delete deck
        </button>
      </div>

      {deck.slides.length > 0 && (
        <div style={{ margin: '12px 0', borderTop: '1px solid #f0efec' }}>
          {deck.slides.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 0',
                borderBottom: '1px solid #f6f5f2',
                fontSize: '13px',
              }}
            >
              <span style={{ color: '#aaa', width: '64px' }}>{s.type}</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#555',
                }}
                title={describe(s)}
              >
                {describe(s)}
              </span>
              <button onClick={() => void move(i, -1)} disabled={busy} style={ghostButton}>
                ↑
              </button>
              <button onClick={() => void move(i, 1)} disabled={busy} style={ghostButton}>
                ↓
              </button>
              <button
                onClick={() => patch({ op: 'deleteSlide', id: s.id })}
                style={{ ...ghostButton, color: '#e53e3e' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: '10px',
        }}
      >
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SlideType)}
          style={selectStyle}
        >
          {/* Image slides are added via the Upload button (-> /media), not by URL, so no
              'image' option here. The API/normalizeSlideInput still accept image-by-url. */}
          <option value="markdown">markdown</option>
          <option value="embed">embed (url)</option>
          <option value="html">html</option>
        </select>
        <label style={{ ...ghostButton, cursor: 'pointer' }}>
          Upload image
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          type === 'embed'
            ? 'https://dashboard.example.com'
            : type === 'html'
              ? '<div>…</div>'
              : '## Markdown heading'
        }
        rows={type === 'embed' ? 1 : 3}
        style={{ ...inputStyle, marginTop: '8px', fontFamily: 'monospace' }}
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Speaker notes (optional)"
        style={inputStyle}
      />
      <button onClick={addSlide} disabled={busy} style={buttonStyle}>
        {busy ? 'Working…' : 'Add slide'}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#666',
  margin: '0 0 4px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  marginBottom: '12px',
  boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '13px',
};
const buttonStyle: React.CSSProperties = {
  padding: '9px 18px',
  background: GREEN,
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  cursor: 'pointer',
  fontWeight: 500,
};
const ghostButton: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
  color: '#444',
  whiteSpace: 'nowrap',
};
