import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('stones_transactions');

    const transactions = await col.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Resolve usernames for all transaction users
    const uniqueIds = Array.from(new Set(transactions.map((t) => t.discordId).filter(Boolean)));
    const [webUsers, discordUsers] = uniqueIds.length > 0
      ? await Promise.all([
          db.collection('users').find({ discordId: { $in: uniqueIds } }).project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 }).toArray(),
          db.collection('discord_users').find({ _id: { $in: uniqueIds } as any }).project({ _id: 1, username: 1, avatar: 1 }).toArray(),
        ])
      : [[], []];

    const userMap = new Map<string, { username: string; avatar: string | null }>();
    for (const u of discordUsers) {
      userMap.set(String(u._id), { username: u.username ?? '', avatar: u.avatar ?? null });
    }
    for (const u of webUsers) {
      userMap.set(u.discordId, { username: u.globalName ?? u.name ?? u.username ?? '', avatar: u.image ?? null });
    }

    return NextResponse.json({
      transactions: transactions.map((t) => {
        const user = userMap.get(t.discordId);
        return {
          _id: t._id.toString(),
          discordId: t.discordId,
          username: user?.username ?? '',
          avatar: user?.avatar ?? null,
          type: t.type,
          amount: t.amount ?? 0,
          metadata: t.metadata,
          timestamp: t.createdAt ?? t.timestamp,
          source: t.source ?? 'discord',
          stoneName: t.metadata?.stoneName ?? t.metadata?.itemReceived ?? '',
        };
      }),
    });
  } catch (error) {
    console.error('Stones transactions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
