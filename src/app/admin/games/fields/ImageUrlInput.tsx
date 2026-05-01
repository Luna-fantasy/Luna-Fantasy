'use client';

import { useRef, useState } from 'react';
import { useToast } from '../../_components/Toast';

interface Props {
  value: string;
  onChange: (next: string) => void;
  folder: 'butler' | 'jester' | 'oracle' | 'sage' | 'valecroft';
  filenameHint: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

// Append (or replace) a `?v=<timestamp>` cache-buster on every URL change.
// Cloudflare's cache key is the base URL plus query, so a fresh `?v=` value
// forces the CDN to miss its old entry and re-fetch from R2.
function withCacheBust(url: string, ts: number = Date.now()): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  // Keep non-http URLs (e.g., relative paths) untouched.
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  const [base] = trimmed.split('?');
  return `${base}?v=${ts}`;
}

async function uploadImage(folder: Props['folder'], filename: string, file: File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
  const token = await fetchCsrf();
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const res = await fetch('/api/admin/v2/r2/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({
      folder,
      filename: `${filename}.${ext}`,
      imageData: base64,
      contentType: file.type || 'image/png',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return withCacheBust(String(data.url));
}

export default function ImageUrlInput({ value, onChange, folder, filenameHint }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handle = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.show({ tone: 'error', title: 'Not an image', message: 'Only image files are accepted.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 4 MB.' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(folder, filenameHint, file);
      onChange(url);
      toast.show({ tone: 'success', title: 'Uploaded', message: filenameHint });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes('Files')) setDragActive(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void handle(file);
  };

  // Append cache-bust on manual URL paste/edit too — pasted URLs without `?v=`
  // would otherwise hit Cloudflare's cached copy.
  const handleManualChange = (raw: string) => {
    const trimmed = raw.trim();
    // If user is mid-typing, don't append cache-bust until they finish (we re-bust on blur).
    onChange(trimmed);
  };
  const handleManualBlur = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) { onChange(''); return; }
    // Only append cache-bust if the user pasted a URL without one.
    if (/^https?:\/\//i.test(trimmed) && !/[?&]v=/i.test(trimmed)) {
      onChange(withCacheBust(trimmed));
    }
  };

  return (
    <div className="av-games-field-control av-games-image-control">
      <div
        className={`av-games-image-preview${dragActive ? ' av-games-image-preview--drag' : ''}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop or click to upload image"
        title={value ? 'Drop a new image to replace · click to browse' : 'Drop an image here · or click to browse'}
        style={{ cursor: uploading ? 'wait' : 'pointer', position: 'relative' }}
      >
        {value
          // key forces React to remount the <img> on every URL change so a new
          // upload's preview never shows the previously cached image.
          ? <img key={value} src={value} alt="" />
          : <span style={{ opacity: 0.55, fontSize: 12 }}>{dragActive ? 'Drop to upload' : 'no image · drop or click'}</span>}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, letterSpacing: '0.05em',
          }}>Uploading…</div>
        )}
        {dragActive && !uploading && (
          <div style={{
            position: 'absolute', inset: 0, border: '2px dashed currentColor',
            borderRadius: 'inherit', pointerEvents: 'none', opacity: 0.9,
          }} />
        )}
      </div>

      <div className="av-games-image-actions">
        <input
          className="av-games-field-input av-games-field-input--mono"
          value={value ?? ''}
          placeholder="https://… (or drop an image above)"
          onChange={(e) => handleManualChange(e.target.value)}
          onBlur={(e) => handleManualBlur(e.target.value)}
        />
        <button
          type="button"
          className="av-games-image-upload"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Browse for an image"
        >
          {uploading ? 'Uploading…' : '⬆ Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
