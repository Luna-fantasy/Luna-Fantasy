import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

type Action = 'close' | 'reopen';

function safeThreadId(raw: string): string {
  return String(raw).replace(/[^\d]/g, '').slice(0, 20);
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

async function archiveThread(threadId: string, archived: boolean, locked: boolean): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived, locked }),
    });
  } catch (e) {
    // Best-effort — bot may not be in the thread any more. DB state is canonical.
    console.warn('[admin/v2/inbox/ticket] archive best-effort failed:', (e as Error).message);
  }
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const adminUsername = auth.session.user?.globalName ?? 'Unknown';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 15, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const threadId = safeThreadId(context.params.id);
  if (!threadId) return NextResponse.json({ error: 'Invalid threadId' }, { status: 400 });

  let body: { action: Action };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (body.action !== 'close' && body.action !== 'reopen') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const client = await clientPromise;
  const col = client.db('Database').collection('tickets_support');

  const docId = `ticket_${threadId}`;
  const existing = await col.findOne({ _id: docId as any });
  if (!existing) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const now = Date.now();
  const nextStatus = body.action === 'close' ? 'closed' : 'open';

  const set: Record<string, any> = { status: nextStatus };
  const unset: Record<string, any> = {};
  if (body.action === 'close') {
    set.closedAt = now;
    set.closedBy = adminId;
  } else {
    set.reopenedAt = now;
    unset.closedAt = '';
    unset.closedBy = '';
  }

  await col.updateOne({ _id: docId as any }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });

  await logAdminAction({
    adminDiscordId: adminId,
    adminUsername,
    action: body.action === 'close' ? 'ticket_close' : 'ticket_reopen',
    targetDiscordId: String((existing as any).userId ?? ''),
    before: { status: (existing as any).status ?? null },
    after: { status: nextStatus },
    metadata: { threadId, ticketNumber: (existing as any).ticketNumber },
    ip: getClientIp(req),
  });

  // Best-effort: archive or unarchive the thread on Discord
  void archiveThread(threadId, body.action === 'close', body.action === 'close');

  return NextResponse.json({ success: true, status: nextStatus, updatedAt: new Date(now).toISOString() });
}
