'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Incorrect password');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f7f4',
        fontFamily: '-apple-system, sans-serif',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          width: '360px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a3a2a', marginBottom: '8px' }}>
          SFW Construction
        </h1>
        <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px' }}>
          Project Reports Portal
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
          autoFocus
        />
        {error && (
          <p style={{ color: '#e53e3e', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
        )}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            background: '#1a3a2a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
