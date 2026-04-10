import { list } from '@vercel/blob';
import TeamNotes from './TeamNotes';

export const dynamic = 'force-dynamic';

export default async function DailyReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const { blobs } = await list({ prefix: `daily/${date}/`, token });
  const htmlBlobs = blobs.filter((b) => b.pathname.endsWith('.html'));

  const reports: string[] = [];
  for (const blob of htmlBlobs) {
    const resp = await fetch(blob.downloadUrl, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      reports.push(await resp.text());
    }
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
          reports.map((html, i) => <div key={i} dangerouslySetInnerHTML={{ __html: html }} />)
        )}
      </div>
    </div>
  );
}
