'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { useTimezone } from '../_components/TimezoneProvider';
import CopyValue from '../_components/CopyValue';
import { uploadFileViaPresign } from '@/lib/admin/upload';

interface Props {
  id: string;
  tone: string;
  title: string;
  description: string;
  image: string;
  imageVersion?: number;
  updatedAt: string | null;
  onSave: (patch: { title?: string; description?: string; image?: string; imageVersion?: number }) => Promise<void>;
}

function versioned(url: string, version: number | undefined, updatedAt: string | null): string {
  if (!url) return url;
  // Strip any existing ?v=... query so we can apply the canonical version cleanly
  const base = url.split('?')[0];
  const v = version || (updatedAt ? Date.parse(updatedAt) || 0 : 0);
  return v ? `${base}?v=${v}` : base;
}

async function uploadVendorImage(vendorId: string, file: File): Promise<string> {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const { publicUrl } = await uploadFileViaPresign(file, `shops/${vendorId}.${ext}`);
  // Return the CLEAN base URL (no cache-buster). Caller writes imageVersion separately
  // so the Discord bot + website bazaar can bust the cache consistently.
  return publicUrl.split('?')[0];
}

export default function VendorHero({ id, tone, title, description, image, imageVersion, updatedAt, onSave }: Props) {
  const toast = useToast();
  const { fmtRel, absolute } = useTimezone();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [descDraft, setDescDraft] = useState(description);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setTitleDraft(title), [title]);
  useEffect(() => setDescDraft(description), [description]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadVendorImage(id, file);
      await onSave({ image: url, imageVersion: Date.now() });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="av-vendor-hero" style={{ ['--vendor-tone' as any]: tone }}>
      <div className="av-vendor-portrait-wrap">
        <div className="av-vendor-portrait">
          {image
            ? <img src={versioned(image, imageVersion, updatedAt)} alt={title} key={`${image}?${imageVersion ?? ''}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            : <div className="av-vendor-portrait-placeholder">{title.slice(0, 1)}</div>}
          {uploading && <div className="av-vendor-uploading">Uploading…</div>}
        </div>
        <button
          type="button"
          className="av-vendor-portrait-change"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <span aria-hidden="true">⬆</span> Change portrait
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="av-vendor-meta">
        {editingTitle ? (
          <input
            className="av-vendor-title-edit"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (titleDraft !== title) onSave({ title: titleDraft });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setTitleDraft(title); setEditingTitle(false); }
            }}
            autoFocus
          />
        ) : (
          <div className="av-vendor-title-row">
            <button type="button" className="av-vendor-title" onClick={() => setEditingTitle(true)} title="Click to rename">
              {title}
            </button>
            <CopyValue value={id} label="vendor id">
              <span className="av-vendor-title-id" title={`vendor_config/${id}`}>{id}</span>
            </CopyValue>
          </div>
        )}

        {editingDesc ? (
          <textarea
            className="av-vendor-desc-edit"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => {
              setEditingDesc(false);
              if (descDraft !== description) onSave({ description: descDraft });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDescDraft(description); setEditingDesc(false); }
            }}
            autoFocus
            rows={3}
          />
        ) : (
          <button type="button" className="av-vendor-desc" onClick={() => setEditingDesc(true)} title="Click to edit description">
            {description || <em>Click to add a vendor description…</em>}
            <span className="av-vendor-edit-hint">✎ edit</span>
          </button>
        )}

        <div className="av-vendor-meta-foot">
          {updatedAt && mounted && (
            <span className="av-vendor-updated" title={absolute(updatedAt)}>
              Updated {fmtRel(updatedAt)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
