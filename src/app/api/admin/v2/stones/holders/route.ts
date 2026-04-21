import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface Holder {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  count: number;
}

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const sp = req.nextUrl.searchParams;
  const name = (sp.get('name') ?? '').trim().slice(0, 80);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50', 10)));
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const client = await clientPromise;
  const db = client.db('Database');

  try {
    const pipeline: any[] = [
      { $project: { _id: 1, items: { $ifNull: ['$items', '$stones'] } } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      { $match: { 'items.name': name } },
      { $group: { _id: '$_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ];

    const rows = await db.collection('stones').aggregate(pipeline).toArray();
    const ids = rows.map((r: any) => String(r._id));
    const discord = ids.length === 0 ? [] : await db.collection('discord_users')
      .find({ _id: { $in: ids } as any })
      .project({ _id: 1, username: 1, globalName: 1, avatar: 1 })
      .toArray();
    const byId = new Map(discord.map((d: any) => [String(d._id), d]));

    const holders: Holder[] = rows.map((r: any) => {
      const id = String(r._id);
      const d = byId.get(id) as any;
      return {
        discordId: id,
        username: d?.username ?? null,
        globalName: d?.globalName ?? null,
        image: d?.avatar ? `https://cdn.discordapp.com/avatars/${id}/${d.avatar}.png?size=128` : null,
        count: Number(r.count ?? 0),
      };
    });

    return NextResponse.json({ holders, total: holders.length });
  } catch (err) {
    console.error('Stones holders error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
