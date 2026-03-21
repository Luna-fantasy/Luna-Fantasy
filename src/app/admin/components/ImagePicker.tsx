'use client';

import { useId, useRef, useState } from 'react';
import AdminLightbox from './AdminLightbox';
import { getCsrfToken } from '../utils/csrf';

interface ImagePickerProps {
  label: string;
  description?: string;
  value: string;
  onChange: (url: string) => void;
  uploadPrefix?: string;
  defaultUrl?: string;
}

export default function ImagePicker({
  label, description, value, onChange, uploadPrefix = '', defaultUrl,
}: ImagePickerProps) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(false);

  async function handleFile(file: File) {
    setError('');
    setUploading(true);
    try {
      const key = uploadPrefix + file.name.replace(/[^a-zA-Z0-9_\-./]/g, '_');
      const form = new FormData();
      form.append('file', file);
      form.append('key', key);

      const res = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      onChange(data.url);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="admin-form-group">
      <label htmlFor={id} className="admin-form-label">{label}</label>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Thumbnail preview */}
        <div
          onClick={() => (value || defaultUrl) && setLightbox(true)}
          style={{
            width: '80px',
            height: '80px',
            flexShrink: 0,
            borderRadius: '8px',
            background: 'var(--bg-void)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: (value || defaultUrl) ? 'pointer' : 'default',
            position: 'relative',
          }}
        >
          {value ? (
            <img
              src={value}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : defaultUrl ? (
            <>
              <img
                src={defaultUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.5 }}
              />
              <span style={{
                position: 'absolute', bottom: 2, right: 2,
                fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
                background: 'rgba(0,0,0,0.7)', color: '#aaa',
              }}>
                Default
              </span>
            </>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>
              No image
            </span>
          )}
        </div>

        {/* Controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            id={id}
            className="admin-form-input"
            value={value}
            onChange={(e) => { setError(''); onChange(e.target.value); }}
            placeholder="https://assets.lunarian.app/..."
            style={{ fontSize: '12px' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              style={{ padding: '4px 10px', fontSize: '11px' }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {!value && defaultUrl && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--text-accent, #58a6ff)' }}
                onClick={() => { setError(''); onChange(defaultUrl); }}
              >
                Use Default
              </button>
            )}
            {value && (
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--text-muted)' }}
                onClick={() => { setError(''); onChange(''); }}
              >
                Clear
              </button>
            )}
          </div>
          {description && !error && (
            <span className="admin-form-description">{description}</span>
          )}
          {error && (
            <span style={{ display: 'block', fontSize: '12px', color: '#f43f5e', marginTop: '4px' }}>{error}</span>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {/* Lightbox for full-size preview */}
      <AdminLightbox isOpen={lightbox} onClose={() => setLightbox(false)} title={label} size="lg">
        {(value || defaultUrl) && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <img
              src={value || defaultUrl}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', opacity: value ? 1 : 0.6 }}
            />
            {!value && defaultUrl && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Default image (not saved to config)</span>
            )}
          </div>
        )}
      </AdminLightbox>
    </div>
  );
}
