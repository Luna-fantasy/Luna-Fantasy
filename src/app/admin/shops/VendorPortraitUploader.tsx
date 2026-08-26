'use client';

import { useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { uploadFileViaPresign } from '@/lib/admin/upload';

interface Props {
  vendorId: string;
  image: string;
  imageVersion?: number;
  tone: string;
  onChange: (url: string, version: number) => void;
}

function versioned(url: string, version: number | undefined): string {
  if (!url) return url;
  const base = url.split('?')[0];
  return version ? `${base}?v=${version}` : base;
}

async function uploadVendorImage(vendorId: string, file: File): Promise<string> {
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const { publicUrl } = await uploadFileViaPresign(file, `shops/${vendorId}.${ext}`);
  return publicUrl.split('?')[0];
}

export default function VendorPortraitUploader({ vendorId, image, imageVersion, tone, onChange }: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
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
