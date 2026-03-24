import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { getPresignedUploadUrl, getPublicUrl, isR2Configured } from '@/lib/admin/r2';

// Client uploads directly to R2 using the presigned URL — no body size limit on our server
export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });
  }

  let body: { key: string; contentType: string; size: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { key, contentType, size } = body;

  if (!key || !contentType) {
    return NextResponse.json({ error: 'key and contentType required' }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_\-/.]+$/.test(key) || key.includes('..')) {
    return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
  }

  // 100MB max
  if (size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 });
  }

  try {
    const presignedUrl = await getPresignedUploadUrl(key, contentType, 600);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'r2_presign',
      before: null,
      after: { key, contentType, size },
      metadata: {},
      ip: getClientIp(request),
    });

    return NextResponse.json({
      presignedUrl,
      publicUrl: getPublicUrl(key),
      key,
    });
  } catch (error) {
    console.error('R2 presign error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
