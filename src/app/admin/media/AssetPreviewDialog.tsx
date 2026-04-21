'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { useFocusTrap } from '../_components/a11y';
import type { R2Object } from './types';

interface Props {
  object: R2Object;
  onDeleted: () => void;
  onClose: () => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

async function deleteKey(key: string): Promise<void> {
  const token = await fetchCsrf();
  const res = await fetch('/api/admin/assets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    credentials: 'include',
    body: JSON.stringify({ key }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function AssetPreviewDialog({ object, onDeleted, onClose }: Props) {
  const toast = useToast();
  const pending = usePendingAction();
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(object.url);
      setCopied(true);
      toast.show({ tone: 'success', title: 'Copied', message: object.key });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.show({ tone: 'error', title: 'Copy failed', message: 'Clipboard unavailable' });
    }
  };

  const handleDelete = () => {
    pending.queue({
      label: `Delete ${object.key.split('/').pop()}`,
      detail: `From R2 bucket · irreversible`,
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          await deleteKey(object.key);
          toast.show({ tone: 'success', title: 'Deleted', message: object.key.split('/').pop() ?? object.key });
          onDeleted();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  const fileName = object.key.split('/').pop() ?? object.key;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);

  return createPortal(
    <>
      <div className="av-peek-scrim" onClick={onClose} />
      <div ref={dialogRef} className="av-itemdialog av-media-preview" role="dialog" aria-modal="true" aria-label={`Preview ${fileName}`}>
        <header className="av-itemdialog-head">
          <div>
            <h3>{fileName}</h3>
            <p><code>{object.key}</code></p>
          </div>
          <button type="button" className="av-peek-close" onClick={onClose}>×</button>
        </header>

        <div className="av-itemdialog-body">
          <div className="av-media-preview-stage">
            {isImage
              ? <img src={object.url} alt={fileName} />
              : <div className="av-media-preview-fallback">.{ext} · no image preview</div>}
          </div>

          <dl className="av-media-preview-meta">
            <div>
              <dt>Size</dt>
              <dd>{formatSize(object.size)}</dd>
            </div>
            <div>
              <dt>Last modified</dt>
              <dd>{new Date(object.lastModified).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Public URL</dt>
              <dd><code>{object.url}</code></dd>
            </div>
          </dl>
        </div>

        <footer className="av-itemdialog-foot">
          <button type="button" className="av-btn av-btn-primary av-btn-danger" onClick={handleDelete}>Delete</button>
          <div style={{ flex: 1 }} />
          <a href={object.url} target="_blank" rel="noreferrer" className="av-btn av-btn-ghost">Open ↗</a>
          <button type="button" className="av-btn av-btn-primary" onClick={copyUrl}>{copied ? 'Copied ✓' : 'Copy URL'}</button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
