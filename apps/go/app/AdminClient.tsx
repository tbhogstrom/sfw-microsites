'use client';

import { useEffect, useState } from 'react';
import type { Link } from '@/lib/links';

const GREEN = '#1a3a2a';

export default function AdminClient({
  initialLinks,
  storageError,
}: {
  initialLinks: Link[];
  storageError: string | null;
}) {
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function refresh() {
    const res = await fetch('/api/links');
    if (res.ok) {
      const data = await res.json();
      setLinks(data.links ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, slug: slug || undefined, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setUrl('');
      setSlug('');
      setNote('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(s: string) {
    if (!confirm(`Delete short link "${s}"?`)) return;
    await fetch(`/api/links/${encodeURIComponent(s)}`, { method: 'DELETE' });
    await refresh();
  }

  async function handleEdit(link: Link) {
    const next = prompt(`New destination URL for "${link.slug}":`, link.url);
    if (next === null || next.trim() === link.url) return;
    const res = await fetch(`/api/links/${encodeURIComponent(link.slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: next.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Update failed');
      return;
    }
    await refresh();
  }

  async function copyShort(s: string) {
    const short = `${origin}/${s}`;
    await navigator.clipboard.writeText(short);
    setCopied(s);
    setTimeout(() => setCopied(''), 1200);
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
        <a href="/decks" style={{ fontSize: '13px', color: GREEN, float: 'right' }}>
          Decks →
        </a>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: GREEN, margin: '0 0 4px' }}>
          SFW Links
        </h1>
        <p style={{ fontSize: '13px', color: '#888', margin: '0 0 24px' }}>
          Create and manage short links.
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
            Storage isn&apos;t ready yet: {storageError}. Attach a Vercel Blob store to this
            project, then reload.
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
          <label style={labelStyle}>Destination URL</label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/some/long/link"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={labelStyle}>Custom slug (optional)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={labelStyle}>Label (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Spring campaign"
                style={inputStyle}
              />
            </div>
          </div>
          {error && (
            <p style={{ color: '#e53e3e', fontSize: '13px', margin: '4px 0 0' }}>{error}</p>
          )}
          <button type="submit" disabled={busy} style={{ ...buttonStyle, marginTop: '14px' }}>
            {busy ? 'Creating…' : 'Create short link'}
          </button>
        </form>

        {links.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#999', textAlign: 'center' }}>No links yet.</p>
        ) : (
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            {links.map((link, i) => (
              <div
                key={link.slug}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  borderTop: i === 0 ? 'none' : '1px solid #f0efec',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: GREEN }}>
                    /{link.slug}
                    {link.note && (
                      <span style={{ fontWeight: 400, color: '#999', marginLeft: '8px' }}>
                        {link.note}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#888',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={link.url}
                  >
                    → {link.url}
                  </div>
                </div>
                <button onClick={() => copyShort(link.slug)} style={ghostButton}>
                  {copied === link.slug ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={() => handleEdit(link)} style={ghostButton}>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(link.slug)}
                  style={{ ...ghostButton, color: '#e53e3e' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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
