import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Get 20 most recently active unique users from lunari_transactions
    const pipeline = [
      { $sort: { createdAt: -1 as const } },
      { $group: { _id: '$discordId', lastActive: { $first: '$createdAt' } } },
      { $sort: { lastActive: -1 as const } },
      { $limit: 20 },
    ];

    const recentIds = await db.collection('lunari_transactions').aggregate(pipeline).toArray();
    const ids = recentIds.map((r) => r._id).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Resolve usernames and avatars from both collections
    const [webUsers, discordUsers] = await Promise.all([
      db.collection('users').find({ discordId: { $in: ids } }).project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 }).toArray(),
      db.collection('discord_users').find({ _id: { $in: ids } as any }).project({ _id: 1, username: 1, avatar: 1 }).toArray(),
    ]);

    const userMap = new Map<string, { username: string; globalName: string; image: string | null }>();

    // Bot cache first (lower priority)
    for (const u of discordUsers) {
      userMap.set(String(u._id), {
        username: u.username ?? '',
        globalName: u.username ?? '',
        image: u.avatar ?? null,
      });
    }

    // Website users override (higher quality)
    for (const u of webUsers) {
      userMap.set(u.discordId, {
        username: u.username ?? '',
        globalName: u.globalName ?? u.name ?? u.username ?? '',
        image: u.image ?? null,
      });
    }

    const users = recentIds.map((r) => {
      const id = r._id;
      const info = userMap.get(id);
      return {
        discordId: id,
        username: info?.username ?? '',
        globalName: info?.globalName ?? '',
        image: info?.image ?? null,
        lastActive: r.lastActive,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Recent users fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
