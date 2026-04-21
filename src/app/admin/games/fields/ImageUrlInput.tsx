'use client';

import { useRef, useState } from 'react';
import { useToast } from '../../_components/Toast';

interface Props {
  value: string;
  onChange: (next: string) => void;
  folder: 'butler' | 'jester' | 'oracle' | 'sage';
  filenameHint: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
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
  return `${data.url}?v=${Date.now()}`;
}

export default function ImageUrlInput({ value, onChange, folder, filenameHint }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (file: File) => {
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

  return (
    <div className="av-games-field-control av-games-image-control">
      {value
        ? <div className="av-games-image-preview"><img src={value} alt="" /></div>
        : <div className="av-games-image-preview av-games-image-preview--empty">no image</div>}

      <div className="av-games-image-actions">
        <input
          className="av-games-field-input av-games-field-input--mono"
          value={value ?? ''}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="av-games-image-upload"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload a new image"
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
