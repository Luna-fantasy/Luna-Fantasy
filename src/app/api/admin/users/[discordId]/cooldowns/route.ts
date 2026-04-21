import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const DB = 'Database';

const DEFAULT_DURATIONS_MS: Record<string, number> = {
  daily: 86_400_000,
  salary: 2_592_000_000,
  vip: 86_400_000,
  hunt: 3_000,
  coinflip: 10_000,
  roulette: 10_000,
  luna21: 10_000,
  steal: 3_600_000,
};

const LABELS: Record<string, string> = {
  daily: 'Daily Reward', salary: 'Monthly Salary', vip: 'VIP Reward',
  hunt: 'Hunt', coinflip: 'Coin Flip', roulette: 'Russian Roulette',
  luna21: 'Luna 21', steal: 'Steal',
};

export async function GET(_req: NextRequest, { params }: { params: { discordId: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('user_cooldowns_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const userId = String(params.discordId).replace(/[^\d]/g, '');
  if (!userId) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const now = Date.now();

    const docs = await db.collection('cooldowns')
      .find({ _id: { $regex: `_${userId}$` } as any })
      .toArray();

    const cooldowns = docs
      .map((d: any) => {
        const id = String(d._id);
        const m = id.match(/^(.+)_(\d+)$/);
        if (!m) return null;
        const action = m[1];
        const triggeredAt = typeof d.value === 'number' ? d.value : 0;
        const duration = DEFAULT_DURATIONS_MS[action] ?? 0;
        const expiresAt = triggeredAt + duration;
        const remainingMs = Math.max(0, expiresAt - now);
        return {
          key: id,
          action,
          label: LABELS[action] || action,
          triggeredAt,
          expiresAt,
          remainingMs,
          durationMs: duration,
          active: remainingMs > 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.remainingMs - a.remainingMs);

    return NextResponse.json({ cooldowns });
  } catch (err: any) {
    console.error('[users/cooldowns GET]', err);
    return NextResponse.json({ error: 'Failed to load cooldowns' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { discordId: string } }) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('user_cooldowns_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const userId = String(params.discordId).replace(/[^\d]/g, '');
  if (!userId) return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });

  let body: { action?: string; key?: string } = {};
  try { body = await req.json(); } catch {}

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const col = db.collection('cooldowns');

    let deletedCount = 0;
    let clearedKeys: string[] = [];

    if (body.key) {
      const id = String(body.key);
      if (!id.endsWith(`_${userId}`)) {
        return NextResponse.json({ error: 'Key does not belong to this user' }, { status: 400 });
      }
      const res = await col.deleteOne({ _id: id as any });
      deletedCount = res.deletedCount ?? 0;
      if (deletedCount) clearedKeys = [id];
    } else if (body.action) {
      const action = String(body.action).replace(/[^a-z0-9_]/gi, '');
      const id = `${action}_${userId}`;
      const res = await col.deleteOne({ _id: id as any });
      deletedCount = res.deletedCount ?? 0;
      if (deletedCount) clearedKeys = [id];
    } else {
      const docs = await col.find({ _id: { $regex: `_${userId}$` } as any }).project({ _id: 1 }).toArray();
      const ids = docs.map((d: any) => d._id);
      if (ids.length > 0) {
        const res = await col.deleteMany({ _id: { $in: ids as any[] } });
        deletedCount = res.deletedCount ?? 0;
        clearedKeys = ids.map((i: any) => String(i));
      }
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      action: 'cooldowns_cleared',
      targetDiscordId: userId,
      metadata: { targetUserId: userId, clearedKeys, count: deletedCount },
      before: clearedKeys,
      after: null,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, deletedCount, clearedKeys });
  } catch (err: any) {
    console.error('[users/cooldowns DELETE]', err);
    return NextResponse.json({ error: 'Failed to clear cooldowns' }, { status: 500 });
  }
}
