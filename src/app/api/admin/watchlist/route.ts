import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const DB = 'Database';

const FLAG_TYPES = ['suspicious_lunari', 'alt_account', 'grinding', 'manual', 'trade_abuse', 'chargeback_risk'] as const;
type FlagType = typeof FLAG_TYPES[number];

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('watchlist_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);

    const docs = await db.collection('user_watchlist').aggregate([
      { $sort: { updatedAt: -1 } },
      { $limit: 500 },
      { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'points', localField: '_id', foreignField: '_id', as: 'pts' } },
      { $unwind: { path: '$pts', preserveNullAndEmptyArrays: true } },
      { $project: {
        userId: '$_id', flags: 1, notes: 1, createdAt: 1, updatedAt: 1,
        username: '$user.username', avatar: '$user.avatar',
        balance: '$pts.balance',
      }},
    ]).toArray();

    const stats = await db.collection('user_watchlist').aggregate([
      { $unwind: '$flags' },
      { $group: { _id: '$flags.type', count: { $sum: 1 } } },
    ]).toArray();

    const statsMap: Record<string, number> = {};
    for (const s of stats) statsMap[String(s._id)] = s.count;

    return NextResponse.json({ watchlist: docs, stats: statsMap, flagTypes: FLAG_TYPES });
  } catch (err: any) {
    console.error('[watchlist GET]', err);
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('watchlist_write', adminId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const userId = String(body.userId ?? '').replace(/[^\d]/g, '');
  if (!/^\d{17,20}$/.test(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  const flagType = String(body.type ?? '');
  if (!FLAG_TYPES.includes(flagType as FlagType)) {
    return NextResponse.json({ error: `Invalid flag type. Allowed: ${FLAG_TYPES.join(', ')}` }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : '';
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : undefined;

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const col = db.collection('user_watchlist');

    const now = new Date();
    const flag = {
      type: flagType,
      reason,
      addedBy: adminId,
      addedByUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      addedAt: now,
    };

    const before = await col.findOne({ _id: userId as any });

    await col.updateOne(
      { _id: userId as any },
      {
        $push: { flags: flag as any },
        $set: { updatedAt: now, ...(notes !== undefined ? { notes } : {}) },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      action: 'watchlist_add',
      targetDiscordId: userId,
      metadata: { type: flagType, reason },
      before: before?.flags ?? [],
      after: flag,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, flag });
  } catch (err: any) {
    console.error('[watchlist POST]', err);
    return NextResponse.json({ error: 'Failed to add flag' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('watchlist_write', adminId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const userId = String(body.userId ?? '').replace(/[^\d]/g, '');
  if (!/^\d{17,20}$/.test(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

  const clearAll = body.clearAll === true;
  const flagIndex = typeof body.flagIndex === 'number' ? body.flagIndex : null;

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const col = db.collection('user_watchlist');

    const before = await col.findOne({ _id: userId as any });

    if (clearAll) {
      await col.deleteOne({ _id: userId as any });
    } else if (flagIndex !== null && before?.flags) {
      const newFlags = (before.flags as any[]).filter((_, i) => i !== flagIndex);
      if (newFlags.length === 0) {
        await col.deleteOne({ _id: userId as any });
      } else {
        await col.updateOne({ _id: userId as any }, { $set: { flags: newFlags, updatedAt: new Date() } });
      }
    } else {
      return NextResponse.json({ error: 'Provide clearAll or flagIndex' }, { status: 400 });
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      action: clearAll ? 'watchlist_clear' : 'watchlist_remove_flag',
      targetDiscordId: userId,
      metadata: { clearAll, flagIndex },
      before: before?.flags ?? [],
      after: null,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[watchlist DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove flag' }, { status: 500 });
  }
}
