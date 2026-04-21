import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { uploadObject, isR2Configured } from '@/lib/admin/r2';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

const ALLOWED_FOLDERS = new Set([
  'shops', 'profiles', 'cards', 'stones', 'jester', 'butler', 'sage', 'oracle', 'avatars', 'bots', 'badges',
]);

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
  }

  let body: { folder: string; filename: string; imageData: string; contentType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { folder, filename, imageData, contentType } = body;

  if (!folder || !ALLOWED_FOLDERS.has(folder)) {
    return NextResponse.json({ error: `Folder must be one of: ${Array.from(ALLOWED_FOLDERS).join(', ')}` }, { status: 400 });
  }
  if (!filename || typeof filename !== 'string') {
    return NextResponse.json({ error: 'filename required' }, { status: 400 });
  }
  if (!imageData || typeof imageData !== 'string') {
    return NextResponse.json({ error: 'imageData (base64) required' }, { status: 400 });
  }

  // Sanitize filename — allow safe chars only, strip path separators
  const safeName = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  if (!safeName) return NextResponse.json({ error: 'invalid filename' }, { status: 400 });

  // Size guard — base64 expands ~33%, so 6MB base64 ≈ 4.5MB binary
  if (imageData.length > 6 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (>4MB)' }, { status: 413 });
  }

  try {
    const r2Key = `${folder}/${safeName}`;
    const buffer = Buffer.from(imageData, 'base64');
    const mimeType = contentType || 'image/png';
    const url = await uploadObject(r2Key, buffer, mimeType);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: 'r2_upload',
      before: null,
      after: { folder, filename: safeName, url, sizeBytes: buffer.length },
      metadata: { folder, key: r2Key, sizeBytes: buffer.length },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, url, key: r2Key });
  } catch (err) {
    console.error('R2 upload error:', err);
    return NextResponse.json({ error: 'Upload failed', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
