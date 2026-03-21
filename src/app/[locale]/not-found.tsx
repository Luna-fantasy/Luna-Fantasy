export default function LocaleNotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ fontSize: 64, fontWeight: 700, marginBottom: 8, opacity: 0.3 }}>404</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Page not found</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
          The page you are looking for does not exist.
        </p>
        <a
          href="/"
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
