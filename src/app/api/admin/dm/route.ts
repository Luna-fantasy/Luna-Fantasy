import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp, hasMongoOperator } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const DB = 'Database';

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('dm_list', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));

  try {
    const client = await clientPromise;
    const db = client.db(DB);

    const filter: any = {};
    if (status && ['pending', 'processing', 'sent', 'failed'].includes(status)) filter.status = status;

    const [dms, stats] = await Promise.all([
      db.collection('pending_dms').aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        { $lookup: { from: 'discord_users', localField: 'targetUserId', foreignField: '_id', as: 'target' } },
        { $unwind: { path: '$target', preserveNullAndEmptyArrays: true } },
        { $project: {
          _id: 1, targetUserId: 1, type: 1, content: 1, embed: 1,
          createdBy: 1, createdAt: 1, status: 1, sentAt: 1, error: 1, processingAt: 1,
          targetUsername: '$target.username', targetAvatar: '$target.avatar',
        }},
      ]).toArray(),

      db.collection('pending_dms').aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const statsMap: Record<string, number> = { pending: 0, processing: 0, sent: 0, failed: 0 };
    for (const s of stats) statsMap[String(s._id)] = s.count;

    return NextResponse.json({ dms, stats: statsMap });
  } catch (err: any) {
    console.error('[dm GET]', err);
    return NextResponse.json({ error: 'Failed to load DMs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('dm_queue', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs, 'Rate limited — 10 DMs/minute max');

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const targetUserId = String(body.targetUserId ?? '').replace(/[^\d]/g, '');
  if (!/^\d{17,20}$/.test(targetUserId)) {
    return NextResponse.json({ error: 'Invalid targetUserId' }, { status: 400 });
  }

  // Which bot delivers this DM. Default Butler for back-compat with the existing
  // dm_poller.ts that already runs there. Other bots need their own poller —
  // see BOT_CHANGES.md §9 for the bot-side change required.
  const VALID_BOTS = ['butler', 'jester', 'sage', 'oracle'] as const;
  const bot: typeof VALID_BOTS[number] = (VALID_BOTS as readonly string[]).includes(body.bot)
    ? body.bot
    : 'butler';

  const type = body.type === 'embed' ? 'embed' : 'content';
  const content = typeof body.content === 'string' ? body.content.slice(0, 2000) : undefined;

  let embed: any = undefined;
  if (type === 'embed') {
    const e = body.embed ?? {};
    embed = {
      title: String(e.title ?? '').slice(0, 256),
      description: String(e.description ?? '').slice(0, 4000),
      color: typeof e.color === 'number' ? e.color : 0x48D8FF,
      footer: e.footer ? String(e.footer).slice(0, 2048) : undefined,
    };
    if (!embed.title && !embed.description) {
      return NextResponse.json({ error: 'Embed must have title or description' }, { status: 400 });
    }
    if (hasMongoOperator(embed)) {
      return NextResponse.json({ error: 'Invalid characters in embed' }, { status: 400 });
    }
  } else if (!content) {
    return NextResponse.json({ error: 'content is required for plain DMs' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB);

    const doc = {
      targetUserId,
      bot,
      type,
      content,
      embed,
      createdBy: adminId,
      createdByUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      createdAt: new Date(),
      status: 'pending' as const,
    };

    const result = await db.collection('pending_dms').insertOne(doc as any);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      action: 'dm_queued',
      targetDiscordId: targetUserId,
      metadata: { bot, type, hasContent: !!content, hasEmbed: !!embed },
      before: null,
      after: { targetUserId, bot, type },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, id: String(result.insertedId), status: 'pending' });
  } catch (err: any) {
    console.error('[dm POST]', err);
    return NextResponse.json({ error: 'Failed to queue DM' }, { status: 500 });
  }
}
