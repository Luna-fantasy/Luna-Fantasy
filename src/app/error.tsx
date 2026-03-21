'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root error boundary caught:', error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030306',
          color: '#e2e8f0',
          fontFamily: 'Outfit, system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 460, padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>500</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            An unexpected error occurred. Please try again.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid #334155',
                background: 'transparent',
                color: '#e2e8f0',
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
      </body>
    </html>
  );
}
