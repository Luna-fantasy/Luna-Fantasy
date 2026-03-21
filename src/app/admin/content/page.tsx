'use client';

import { useState } from 'react';

export default function ContentPage() {
  const [selectedLocale, setSelectedLocale] = useState<'en' | 'ar'>('en');

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">✏️</span> Website Content</h1>
        <p className="admin-page-subtitle">
          Edit the live website visually — click any text or image to modify it
        </p>
      </div>

      <div className="admin-card" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ marginBottom: 32 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          Inline Website Editor
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
          Open the live website in edit mode. Click any text to modify it inline,
          or click any image to replace it. Changes are saved to the database
          and committed to GitHub automatically.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          <button
            className={`admin-btn ${selectedLocale === 'en' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
            onClick={() => setSelectedLocale('en')}
          >
            English
          </button>
          <button
            className={`admin-btn ${selectedLocale === 'ar' ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
            onClick={() => setSelectedLocale('ar')}
          >
            Arabic
          </button>
        </div>

        <a
          href={`/${selectedLocale}?editMode=1`}
          className="admin-btn admin-btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 32px',
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Website
        </a>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          Only Masterminds can access edit mode. Changes take effect immediately.
        </p>
      </div>
    </>
  );
}
