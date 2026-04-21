import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { uploadObject, deleteObject, isR2Configured } from '@/lib/admin/r2';
import { getCanvasDefinition } from '@/lib/admin/canvas-definitions';

export const dynamic = 'force-dynamic';

const VALID_BOTS = ['butler', 'jester'] as const;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

/**
 * Upload a trial background image for the canvas editor. The image is stored
 * in `canvas-trials/{bot}/{canvasType}/{timestamp}-{filename}` on R2 and is
 * NOT referenced by the bot until explicitly saved as `_backgroundOverride`
 * via the canvas layout PUT endpoint.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('canvas_trial_upload', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs, 'Too many uploads — slow down.');

  if (!isR2Configured()) return NextResponse.json({ error: 'R2 is not configured.' }, { status: 503 });

  let body: { bot: string; canvasType: string; imageData: string; contentType?: string; filename?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { bot, canvasType, imageData, contentType, filename } = body;

  if (!VALID_BOTS.includes(bot as any)) {
    return NextResponse.json({ error: 'bot must be butler or jester' }, { status: 400 });
  }
  const def = getCanvasDefinition(canvasType);
  if (!def || def.bot !== bot) {
    return NextResponse.json({ error: `Unknown canvasType "${canvasType}" for "${bot}"` }, { status: 400 });
  }
  if (!imageData || typeof imageData !== 'string') {
    return NextResponse.json({ error: 'imageData (base64) is required' }, { status: 400 });
  }
  const mime = (contentType ?? 'image/png').toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json({ error: `Unsupported type: ${mime}` }, { status: 400 });
  }

  const buffer = Buffer.from(imageData, 'base64');
  if (buffer.length === 0) return NextResponse.json({ error: 'Empty image' }, { status: 400 });
  if (buffer.length > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: `Image too large (>${MAX_SIZE_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const extMap: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif',
  };
  const ext = extMap[mime] ?? 'png';
  const safeName = (filename ?? 'trial')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
    .replace(/\.[^.]+$/, '') || 'trial';

  const key = `canvas-trials/${bot}/${canvasType}/${Date.now()}-${safeName}.${ext}`;

  try {
    const url = await uploadObject(key, buffer, mime);
    return NextResponse.json({ success: true, url, key });
  } catch (err) {
    console.error('[canvas/upload-trial POST] Error:', err);
    return NextResponse.json({ error: sanitizeErrorMessage((err as Error).message) || 'Upload failed' }, { status: 500 });
  }
}

/**
 * Delete a trial image from R2. Only keys beginning with `canvas-trials/`
 * may be deleted via this endpoint — prevents this admin from wiping
 * any other R2 asset.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('canvas_trial_delete', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) return NextResponse.json({ error: 'R2 is not configured.' }, { status: 503 });

  let body: { key?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const key = String(body.key ?? '');
  if (!key.startsWith('canvas-trials/')) {
    return NextResponse.json({ error: 'Can only delete trial keys' }, { status: 400 });
  }

  try {
    await deleteObject(key);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[canvas/upload-trial DELETE] Error:', err);
    return NextResponse.json({ error: sanitizeErrorMessage((err as Error).message) || 'Delete failed' }, { status: 500 });
  }
}
