import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function safeId(id: string): string {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const id = safeId(context.params.id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const client = await clientPromise;
  const doc = await client.db('Database').collection('bot_config').findOne({ _id: id as any });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: String((doc as any)._id),
    data: (doc as any).data ?? null,
    updatedAt: (doc as any).updatedAt ?? null,
    updatedBy: (doc as any).updatedBy ?? null,
  });
}

export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const id = safeId(context.params.id);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { data: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (body.data === undefined) return NextResponse.json({ error: 'data required' }, { status: 400 });

  // Size guard — refuse anything over ~256KB
  const serialized = JSON.stringify(body.data);
  if (serialized.length > 256 * 1024) {
    return NextResponse.json({ error: 'Document too large (>256KB).' }, { status: 413 });
  }

  try {
    const client = await clientPromise;
    const col = client.db('Database').collection('bot_config');

    const before = await col.findOne({ _id: id as any });
    const now = new Date();
    await col.updateOne(
      { _id: id as any },
      { $set: { data: body.data, updatedAt: now, updatedBy: adminId } },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: id.startsWith('butler') ? 'config_butler_update'
            : id.startsWith('jester') ? 'config_jester_update'
            : id.startsWith('oracle') ? 'config_oracle_update'
            : id.startsWith('sage')   ? 'config_sage_update'
            : 'bot_config_update',
      before: before ? { id, size: JSON.stringify((before as any).data ?? null).length } : null,
      after: { id, size: serialized.length },
      metadata: { configId: id },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, updatedAt: now.toISOString() });
  } catch (err) {
    console.error('Bot config PUT error:', err);
    return NextResponse.json({ error: 'Internal error', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
