import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

/**
 * Lightweight endpoint that returns the 100 most recent transactions
 * with resolved usernames. Used by the dashboard for live polling.
 */
export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  // Higher rate limit since this is polled every 10s (max ~6/min)
  const { allowed, retryAfterMs } = checkRateLimit('admin_recent_tx', discordId, 12, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const rawTransactions = await db
      .collection('lunari_transactions')
      .find()
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    // Resolve usernames — same logic as getEconomyOverview
    const idsNeedingLookup = Array.from(
      new Set(
        rawTransactions
          .filter((t) => !t.username)
          .map((t) => t.discordId ?? t.userId)
          .filter(Boolean),
      ),
    );

    const [webUserDocs, discordUserDocs] =
      idsNeedingLookup.length > 0
        ? await Promise.all([
            db
              .collection('users')
              .find({ discordId: { $in: idsNeedingLookup } })
              .project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 })
              .toArray(),
            db
              .collection('discord_users')
              .find({ _id: { $in: idsNeedingLookup } })
              .project({ _id: 1, username: 1, avatar: 1 })
              .toArray(),
          ])
        : [[], []];

    const userMap = new Map<string, { name: string; avatar: string | null }>();
    for (const u of discordUserDocs) {
      userMap.set(String(u._id), { name: u.username ?? '', avatar: u.avatar ?? null });
    }
    for (const u of webUserDocs) {
      userMap.set(u.discordId, {
        name: u.globalName ?? u.name ?? u.username ?? '',
        avatar: u.image ?? null,
      });
    }

    const transactions = rawTransactions.map((t) => {
      const id = t.discordId ?? t.userId ?? '';
      const fallback = userMap.get(id);
      return {
        _id: t._id.toString(),
        discordId: id,
        username: t.username ?? fallback?.name ?? '',
        avatar: t.avatar ?? fallback?.avatar ?? undefined,
        type: t.type ?? 'unknown',
        amount: typeof t.amount === 'string' ? parseFloat(t.amount) || 0 : t.amount ?? 0,
        description: t.description ?? t.reason ?? t.metadata?.itemReceived ?? '',
        timestamp: t.createdAt ?? t.timestamp ?? new Date(),
      };
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Recent transactions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
