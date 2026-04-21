import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { uploadObject, deleteObject, isR2Configured } from '@/lib/admin/r2';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp , sanitizeErrorMessage } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB per song

/**
 * Upload an MP3 (or compatible audio file) to R2 for Oracle's music library.
 * Stored at `oracle-music/{timestamp}-{safeName}.{ext}`.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('oracle_music_upload', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs, 'Rate limited — 10 uploads/min max');

  if (!isR2Configured()) return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });

  let body: { title?: string; filename?: string; contentType?: string; data?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, filename, contentType, data } = body;
  if (!data || typeof data !== 'string') {
    return NextResponse.json({ error: 'data (base64) is required' }, { status: 400 });
  }
  const mime = (contentType ?? 'audio/mpeg').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: `Unsupported type: ${mime}` }, { status: 400 });
  }

  const buffer = Buffer.from(data, 'base64');
  if (buffer.length === 0) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  if (buffer.length > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: `File too large (>${MAX_SIZE_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }

  const extMap: Record<string, string> = {
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
    'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/ogg': 'ogg', 'audio/opus': 'opus', 'audio/webm': 'webm',
  };
  const ext = extMap[mime] ?? 'mp3';

  const safeName = (filename ?? title ?? 'song')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
    .replace(/\.[^.]+$/, '') || 'song';

  const key = `oracle-music/${Date.now()}-${safeName}.${ext}`;

  try {
    const url = await uploadObject(key, buffer, mime);
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user.globalName ?? auth.session.user.username ?? 'Unknown',
      action: 'oracle_music_upload',
      before: null,
      after: { key, url, title: title ?? safeName, sizeBytes: buffer.length, contentType: mime },
      metadata: { filename, contentType: mime },
      ip: getClientIp(req),
    });
    return NextResponse.json({
      success: true,
      url,
      key,
      title: title ?? safeName,
      sizeBytes: buffer.length,
      contentType: mime,
    });
  } catch (err) {
    console.error('[oracle/music/upload POST] Error:', err);
    return NextResponse.json({ error: sanitizeErrorMessage((err as Error).message) || 'Upload failed' }, { status: 500 });
  }
}

/**
 * Delete an Oracle music object from R2. Scoped to `oracle-music/` prefix only.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('oracle_music_delete', adminId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });

  let body: { key?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const key = String(body.key ?? '');
  if (!key.startsWith('oracle-music/')) {
    return NextResponse.json({ error: 'Can only delete oracle-music keys' }, { status: 400 });
  }

  try {
    await deleteObject(key);
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user.globalName ?? auth.session.user.username ?? 'Unknown',
      action: 'oracle_music_delete',
      before: { key },
      after: null,
      metadata: { key },
      ip: getClientIp(req),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[oracle/music/upload DELETE] Error:', err);
    return NextResponse.json({ error: sanitizeErrorMessage((err as Error).message) || 'Delete failed' }, { status: 500 });
  }
}
