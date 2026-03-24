import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { uploadObject, isR2Configured } from '@/lib/admin/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s timeout for large uploads

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const key = formData.get('key') as string | null;

    if (!file || !key) {
      return NextResponse.json({ error: 'file and key are required' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_\-/.]+$/.test(key) || key.includes('..')) {
      return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const validImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!file.type || !validImageTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files allowed (PNG, JPEG, WebP, GIF, SVG)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file magic bytes (don't trust MIME type alone) — SVG is text-based, skip magic check
    if (file.type !== 'image/svg+xml') {
      const head = buffer.subarray(0, 12);
      const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
      const isJpeg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
      const isWebp = head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
      const isGif = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
      if (!isPng && !isJpeg && !isWebp && !isGif) {
        return NextResponse.json({ error: 'File content does not match an image format' }, { status: 400 });
      }
    }

    const url = await uploadObject(key, buffer, file.type || 'application/octet-stream');

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'r2_upload',
      before: null,
      after: { key, size: file.size, type: file.type },
      metadata: { url },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, url, key });
  } catch (error) {
    console.error('R2 upload error:', error);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}
