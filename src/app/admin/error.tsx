'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error boundary caught:', error);
  }, [error]);

  return (
    <div className="admin-card" style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>500</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        An unexpected error occurred in the admin dashboard.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="admin-btn admin-btn-primary" onClick={reset}>
          Try again
        </button>
        <a href="/admin" className="admin-btn admin-btn-ghost" style={{ textDecoration: 'none' }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
