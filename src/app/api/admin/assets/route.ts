import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { listObjects, listPrefixes, deleteObject, uploadObject, isR2Configured } from '@/lib/admin/r2';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 not configured', configured: false }, { status: 503 });
  }

  const prefix = request.nextUrl.searchParams.get('prefix') ?? undefined;
  const mode = request.nextUrl.searchParams.get('mode');

  try {
    if (mode === 'browse') {
      const result = await listPrefixes(prefix);
      return NextResponse.json(result);
    }
    const result = await listObjects(prefix);
    return NextResponse.json(result);
  } catch (error) {
    console.error('R2 list error:', error);
    return NextResponse.json({ error: 'Failed to list objects' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });
  }

  let body: { key: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  try {
    await deleteObject(body.key);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'r2_delete',
      before: { key: body.key },
      after: null,
      metadata: {},
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('R2 delete error:', error);
    return NextResponse.json({ error: 'Failed to delete object' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 });
  }

  let body: { action: string; prefix: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.action !== 'create_folder') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const { prefix } = body;
  if (!prefix || typeof prefix !== 'string' || !prefix.endsWith('/')) {
    return NextResponse.json({ error: 'Prefix must end with /' }, { status: 400 });
  }
  if (prefix.includes('..') || prefix.startsWith('/') || prefix.length > 200) {
    return NextResponse.json({ error: 'Invalid prefix format' }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9/_-]+\/$/.test(prefix)) {
    return NextResponse.json({ error: 'Folder name can only contain letters, numbers, hyphens, and underscores' }, { status: 400 });
  }

  try {
    await uploadObject(`${prefix}.folder`, Buffer.alloc(0), 'application/x-empty');

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'r2_create_folder',
      before: null,
      after: { prefix },
      metadata: {},
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('R2 create folder error:', error);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
