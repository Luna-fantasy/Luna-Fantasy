'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import AssetPreviewDialog from './AssetPreviewDialog';
import type { BrowseResult, R2Object } from './types';

interface Props {
  initial: BrowseResult;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function uploadFile(file: File, key: string): Promise<void> {
  const token = await fetchCsrf();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('key', key);
  const res = await fetch('/api/admin/assets/upload', {
    method: 'POST',
    headers: { 'x-csrf-token': token },
    credentials: 'include',
    body: fd,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtRel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AssetsPanel({ initial }: Props) {
  const toast = useToast();

  const [prefix, setPrefix] = useState<string>('');
  const [result, setResult] = useState<BrowseResult>(initial);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<R2Object | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const url = `/api/admin/assets?mode=browse${p ? `&prefix=${encodeURIComponent(p)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Fetch failed');
      setResult(body as BrowseResult);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Only reload when prefix changes to something different from initial
    if (prefix === '') return;
    void load(prefix);
  }, [prefix, load]);

  const filteredObjects = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return result.objects;
    return result.objects.filter((o) => o.key.toLowerCase().includes(term));
  }, [result.objects, q]);

  const crumbs = useMemo(() => {
    if (!prefix) return [{ label: 'root', value: '' }];
    const parts = prefix.replace(/\/$/, '').split('/');
    const out: { label: string; value: string }[] = [{ label: 'root', value: '' }];
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      out.push({ label: p, value: `${acc}/` });
    }
    return out;
  }, [prefix]);

  const handleUpload = async (file: File) => {
    const name = file.name.replace(/\s+/g, '_');
    const key = `${prefix}${name}`;
    setUploading(true);
    try {
      await uploadFile(file, key);
      toast.show({ tone: 'success', title: 'Uploaded', message: name });
      await load(prefix);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleUpload(file);
  };

  return (
    <section className="av-media av-media-assets">
      <aside className="av-media-tree">
        <h4 className="av-media-tree-head">Folders</h4>
        <button
          type="button"
          className={`av-media-tree-item${prefix === '' ? ' av-media-tree-item--active' : ''}`}
          onClick={() => setPrefix('')}
        >
          <span className="av-media-tree-glyph">🗂</span>
          <span>root</span>
        </button>
        {result.folders.map((f) => (
          <button
            key={f}
            type="button"
            className={`av-media-tree-item${prefix === f ? ' av-media-tree-item--active' : ''}`}
            onClick={() => setPrefix(f)}
          >
            <span className="av-media-tree-glyph">📁</span>
            <span>{f.replace(/\/$/, '').split('/').pop()}</span>
          </button>
        ))}
      </aside>

      <main className="av-media-main">
        <header className="av-media-head">
          <nav className="av-media-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.value} className="av-media-crumb-wrap">
                <button type="button" className="av-media-crumb" onClick={() => setPrefix(c.value)}>{c.label}</button>
                {i < crumbs.length - 1 && <span className="av-media-crumb-sep" aria-hidden="true">/</span>}
              </span>
            ))}
            {loading && <span className="av-media-crumb-loading">loading…</span>}
          </nav>

          <input
            className="av-audit-input av-media-filter"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter files by name…"
          />

          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : '⬆ Upload file'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = '';
            }}
          />
        </header>

        <div
          className={`av-media-dropzone${dragActive ? ' av-media-dropzone--active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          {result.objects.length === 0 && result.folders.length === 0
            ? <span>Empty folder — drop an image here to upload.</span>
            : <span>Drop a file here to upload into <code>{prefix || 'root'}</code></span>}
        </div>

        {result.truncated && (
          <div className="av-media-truncated">
            Showing first 200 entries. Enter a deeper folder for the full list.
          </div>
        )}

        <div className="av-media-grid">
          {filteredObjects.map((o) => {
            const name = o.key.split('/').pop() ?? o.key;
            const ext = name.split('.').pop()?.toLowerCase() ?? '';
            const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
            return (
              <button
                key={o.key}
                type="button"
                className="av-media-card"
                onClick={() => setPreview(o)}
                title={o.key}
              >
                <div className="av-media-card-thumb">
                  {isImage
                    ? <img src={o.url} alt="" loading="lazy" />
                    : <span className="av-media-card-ext">.{ext}</span>}
                </div>
                <div className="av-media-card-meta">
                  <strong className="av-media-card-name">{name}</strong>
                  <span className="av-media-card-sub">{formatSize(o.size)} · {fmtRel(o.lastModified)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {filteredObjects.length === 0 && !loading && (
          <div className="av-commands-empty">No files in this folder{q ? ` match “${q}”` : ''}.</div>
        )}
      </main>

      {preview && (
        <AssetPreviewDialog
          object={preview}
          onDeleted={() => { setPreview(null); void load(prefix); }}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
