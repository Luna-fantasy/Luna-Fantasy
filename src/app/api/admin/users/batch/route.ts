import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  let body: { ids: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
  }

  // Cap at 100 IDs, validate format
  const ids = body.ids
    .filter((id): id is string => typeof id === 'string' && /^\d{17,20}$/.test(id))
    .slice(0, 100);

  if (ids.length === 0) {
    return NextResponse.json({ users: [] });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const [webUsers, discordUsers] = await Promise.all([
      db.collection('users').find({ discordId: { $in: ids } }).project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 }).toArray(),
      db.collection('discord_users').find({ _id: { $in: ids } as any }).project({ _id: 1, username: 1, avatar: 1, globalName: 1 }).toArray(),
    ]);

    const userMap = new Map<string, { discordId: string; username: string; avatar: string | null }>();

    // Bot cache first (lower priority)
    for (const u of discordUsers) {
      const id = String(u._id);
      userMap.set(id, {
        discordId: id,
        username: u.globalName ?? u.username ?? '',
        avatar: u.avatar ?? null,
      });
    }

    // Website users override (higher quality)
    for (const u of webUsers) {
      userMap.set(u.discordId, {
        discordId: u.discordId,
        username: u.globalName ?? u.name ?? u.username ?? '',
        avatar: u.image ?? userMap.get(u.discordId)?.avatar ?? null,
      });
    }

    return NextResponse.json({ users: Array.from(userMap.values()) });
  } catch (error) {
    console.error('Batch users fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
