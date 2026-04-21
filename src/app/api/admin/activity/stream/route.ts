import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface PulseEvent {
  id: string;
  kind: 'audit' | 'lunari' | 'card' | 'stone';
  action: string;
  actor?: string;
  target?: string;
  targetName?: string;
  targetAvatar?: string | null;
  amount?: number;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const { session } = authResult;
  const discordId = session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 120, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { searchParams } = request.nextUrl;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10)));

  const client = await clientPromise;
  const db = client.db('Database');

  // Just take the most recent N per source — don't filter by time.
  // The dashboard's "live" label is about freshness of the *fetch*, not that
  // events must be from the last 30 min (which can mean "empty feed at 4am").
  const [audit, lunari, cards, stones] = await Promise.all([
    db.collection('admin_audit_log').find({})
      .project({ action: 1, adminUsername: 1, targetDiscordId: 1, 'metadata.amount': 1, timestamp: 1 })
      .sort({ timestamp: -1 }).limit(limit).toArray(),
    db.collection('lunari_transactions').find({})
      .project({ type: 1, discordId: 1, amount: 1, createdAt: 1 })
      .sort({ createdAt: -1 }).limit(limit).toArray(),
    db.collection('cards_transactions').find({})
      .project({ type: 1, discordId: 1, amount: 1, createdAt: 1 })
      .sort({ createdAt: -1 }).limit(Math.min(limit, 30)).toArray(),
    db.collection('stones_transactions').find({})
      .project({ type: 1, discordId: 1, amount: 1, createdAt: 1 })
      .sort({ createdAt: -1 }).limit(Math.min(limit, 30)).toArray(),
  ]);

  const events: PulseEvent[] = [
    ...audit.map((e: any) => ({
      id: `a:${String(e._id)}`,
      kind: 'audit' as const,
      action: e.action,
      actor: e.adminUsername,
      target: e.targetDiscordId,
      amount: e.metadata?.amount,
      timestamp: new Date(e.timestamp).toISOString(),
    })),
    ...lunari.map((e: any) => ({
      id: `l:${String(e._id)}`,
      kind: 'lunari' as const,
      action: e.type,
      target: e.discordId,
      amount: e.amount,
      timestamp: new Date(e.createdAt ?? e.timestamp ?? 0).toISOString(),
    })),
    ...cards.map((e: any) => ({
      id: `c:${String(e._id)}`,
      kind: 'card' as const,
      action: e.type,
      target: e.discordId,
      amount: e.amount,
      timestamp: new Date(e.createdAt ?? e.timestamp ?? 0).toISOString(),
    })),
    ...stones.map((e: any) => ({
      id: `s:${String(e._id)}`,
      kind: 'stone' as const,
      action: e.type,
      target: e.discordId,
      amount: e.amount,
      timestamp: new Date(e.createdAt ?? e.timestamp ?? 0).toISOString(),
    })),
  ];

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const sliced = events.slice(0, limit);

  // Enrich with user names + avatars in one batch
  const ids = Array.from(new Set(sliced.map((e) => e.target).filter(Boolean))) as string[];
  if (ids.length > 0) {
    const [webUsers, discordUsers] = await Promise.all([
      db.collection('users').find({ discordId: { $in: ids } }).project({ discordId: 1, username: 1, globalName: 1, name: 1, image: 1 }).toArray(),
      db.collection('discord_users').find({ _id: { $in: ids as any } }).project({ _id: 1, username: 1, globalName: 1, avatar: 1 }).toArray(),
    ]);
    const userMap = new Map<string, { name: string; avatar: string | null }>();
    for (const u of discordUsers as any[]) {
      const id = String(u._id);
      const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=64` : null;
      userMap.set(id, { name: u.globalName ?? u.username ?? '', avatar });
    }
    for (const u of webUsers as any[]) {
      userMap.set(u.discordId, { name: u.globalName ?? u.name ?? u.username ?? '', avatar: u.image ?? null });
    }
    for (const e of sliced) {
      if (!e.target) continue;
      const info = userMap.get(e.target);
      if (info) {
        e.targetName = info.name || undefined;
        e.targetAvatar = info.avatar;
      }
    }
  }

  return NextResponse.json({ events: sliced, latest: sliced[0]?.timestamp ?? null });
}
