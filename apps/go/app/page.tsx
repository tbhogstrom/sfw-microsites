export default function HomePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f7f4',
        fontFamily: '-apple-system, sans-serif',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#1a3a2a', margin: 0 }}>SFW Links</h1>
      <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
        Short-link service — setup in progress.
      </p>
    </div>
  );
}
