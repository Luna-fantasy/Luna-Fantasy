'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';

interface Props {
  vendorId: string;
  image: string;
  imageVersion?: number;
  tone: string;
  onChange: (url: string, version: number) => void;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function versioned(url: string, version: number | undefined): string {
  if (!url) return url;
  const base = url.split('?')[0];
  return version ? `${base}?v=${version}` : base;
}

async function uploadVendorImage(vendorId: string, file: File): Promise<string> {
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
      folder: 'shops',
      filename: `${vendorId}.${ext}`,
      imageData: base64,
      contentType: file.type || 'image/png',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return String(data.url).split('?')[0];
}

export default function VendorPortraitUploader({ vendorId, image, imageVersion, tone, onChange }: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.show({ tone: 'error', title: 'Too large', message: 'Image must be under 4MB.' });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadVendorImage(vendorId, file);
      onChange(url, Date.now());
      toast.show({ tone: 'success', title: 'Portrait uploaded', message: 'Save to publish to the bot.' });
    } catch (e) {
      toast.show({ tone: 'error', title: 'Upload failed', message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="av-vendor-portrait-wrap" style={{ ['--vendor-tone' as any]: tone }}>
      <div className="av-vendor-portrait">
        {image
          ? <img src={versioned(image, imageVersion)} alt={vendorId} key={`${image}?${imageVersion ?? ''}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : <div className="av-vendor-portrait-placeholder">{vendorId.slice(0, 1).toUpperCase()}</div>}
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
  );
}
