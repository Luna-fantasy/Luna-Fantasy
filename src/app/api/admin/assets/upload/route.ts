import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { uploadObject, isR2Configured } from '@/lib/admin/r2';

export const runtime = 'nodejs';

// Override body size limit for uploads
export const dynamic = 'force-dynamic';

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadObject(key, buffer, file.type || 'application/octet-stream');

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'r2_upload',
      before: null,
      after: { key, size: file.size, type: file.type },
      metadata: { url },
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    });

    return NextResponse.json({ success: true, url, key });
  } catch (error) {
    console.error('R2 upload error:', error);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}
