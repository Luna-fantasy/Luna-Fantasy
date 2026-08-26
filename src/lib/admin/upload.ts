'use client';

// Shared direct-to-R2 upload for admin clients.
//
// The old path pushed base64 through /api/admin/v2/r2/upload, which inflates
// bodies ~33% and forced every caller to cap at 4MB. Presigned PUTs go
// straight to R2 (the server never sees the bytes), so the ceiling is the
// presign route's 100MB. The presign route also purges the CDN and bumps
// bot_config.asset_versions so bots can bust Discord's image proxy.

import { adminPost } from './http';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // keep in sync with assets/presign
export const MAX_UPLOAD_LABEL = '100MB';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

export interface PresignUploadResult {
  publicUrl: string;
  key: string;
  /** Stamp for `data.imageVersion`-style fields — Date.now() at upload time. */
  version: number;
}

export interface PresignUploadOptions {
  maxBytes?: number;
  /** Allowed lower-case extensions; defaults to common image types. */
  extensions?: string[];
}

export async function uploadFileViaPresign(
  file: File,
  key: string,
  opts: PresignUploadOptions = {},
): Promise<PresignUploadResult> {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  const allowed = opts.extensions ?? IMAGE_EXTENSIONS;

  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  if (!allowed.includes(ext)) {
    throw new Error(`That file type isn't supported — use ${allowed.join(', ')}`);
  }
  if (file.size > maxBytes) {
    throw new Error(`File is too large — max ${Math.round(maxBytes / (1024 * 1024))}MB`);
  }

  const contentType = file.type || 'application/octet-stream';
  const presign = await adminPost<{ presignedUrl: string; publicUrl: string; key: string }>(
    '/api/admin/assets/presign',
    { key, contentType, size: file.size },
  );

  const putRes = await fetch(presign.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (HTTP ${putRes.status})`);
  }

  return { publicUrl: presign.publicUrl, key: presign.key, version: Date.now() };
}

/** Extension from a File's name, defaulting to png — matches the old routes' behaviour. */
export function fileExtension(file: File, fallback = 'png'): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : fallback;
}
