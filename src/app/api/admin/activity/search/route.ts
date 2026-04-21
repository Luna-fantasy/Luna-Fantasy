import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

interface ActivityEvent {
  id: string;
  kind: 'audit' | 'lunari' | 'card' | 'stone';
  action: string;
  actor?: string;
  target?: string;
  targetName?: string;
  targetAvatar?: string | null;
  amount?: number;
  timestamp: string;
  description?: string;
}

const VALID_KINDS = ['audit', 'lunari', 'card', 'stone'] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 120, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { searchParams } = request.nextUrl;
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
  const kind = searchParams.get('kind'); // 'audit' | 'lunari' | 'card' | 'stone' | 'all' | null
  const action = searchParams.get('action')?.trim() || null;
  const userId = searchParams.get('userId')?.trim() || null;
  const userQuery = searchParams.get('userQuery')?.trim() || null;
  const before = searchParams.get('before'); // ISO timestamp
  const after = searchParams.get('after');   // ISO timestamp

  const client = await clientPromise;
  const db = client.db('Database');

  // Resolve userQuery (username substring) → list of matching discord IDs
  let userIdList: string[] | null = null;
  if (userQuery && !userId) {
    const safe = escapeRegex(userQuery).slice(0, 80);
    const regex = new RegExp(safe, 'i');
    const [webHits, discordHits] = await Promise.all([
      db.collection('users')
        .find({ $or: [{ username: regex }, { globalName: regex }, { name: regex }] })
        .project({ discordId: 1 }).limit(40).toArray(),
      db.collection('discord_users')
        .find({ $or: [{ username: regex }, { globalName: regex }] })
        .project({ _id: 1 }).limit(40).toArray(),
    ]);
    const ids = new Set<string>();
    for (const u of webHits as any[]) if (u.discordId) ids.add(u.discordId);
    for (const u of discordHits as any[]) if (u._id) ids.add(String(u._id));
    userIdList = Array.from(ids);
    if (userIdList.length === 0) {
      return NextResponse.json({ events: [], total: 0, hasMore: false });
    }
  }

  // Build filter shapes per collection
  const targetMatch = userId
    ? { $eq: userId }
    : userIdList
      ? { $in: userIdList }
      : null;

  const tsMatch: any = {};
  if (before) tsMatch.$lt = new Date(before);
  if (after) tsMatch.$gt = new Date(after);
  const hasTs = Object.keys(tsMatch).length > 0;

  const wantKind = (k: typeof VALID_KINDS[number]) => !kind || kind === 'all' || kind === k;

  const collLimit = limit + offset;

  const queries: Array<Promise<any[]>> = [];

  if (wantKind('audit')) {
    const auditFilter: any = {};
    if (targetMatch) auditFilter.targetDiscordId = targetMatch;
    if (action) auditFilter.action = action;
    if (hasTs) auditFilter.timestamp = tsMatch;
    queries.push(
      db.collection('admin_audit_log').find(auditFilter)
        .project({ action: 1, adminUsername: 1, targetDiscordId: 1, 'metadata.amount': 1, timestamp: 1 })
        .sort({ timestamp: -1 }).limit(collLimit).toArray()
    );
  } else queries.push(Promise.resolve([]));

  if (wantKind('lunari')) {
    const f: any = {};
    if (targetMatch) f.discordId = targetMatch;
    if (action) f.type = action;
    if (hasTs) f.createdAt = tsMatch;
    queries.push(
      db.collection('lunari_transactions').find(f)
        .project({ type: 1, discordId: 1, amount: 1, createdAt: 1, description: 1 })
        .sort({ createdAt: -1 }).limit(collLimit).toArray()
    );
  } else queries.push(Promise.resolve([]));

  if (wantKind('card')) {
    const f: any = {};
    if (targetMatch) f.discordId = targetMatch;
    if (action) f.type = action;
    if (hasTs) f.createdAt = tsMatch;
    queries.push(
      db.collection('cards_transactions').find(f)
        .project({ type: 1, discordId: 1, amount: 1, createdAt: 1, description: 1, 'metadata.cardName': 1, 'metadata.rarity': 1 })
        .sort({ createdAt: -1 }).limit(collLimit).toArray()
    );
  } else queries.push(Promise.resolve([]));

  if (wantKind('stone')) {
    const f: any = {};
    if (targetMatch) f.discordId = targetMatch;
    if (action) f.type = action;
    if (hasTs) f.createdAt = tsMatch;
    queries.push(
      db.collection('stones_transactions').find(f)
        .project({ type: 1, discordId: 1, amount: 1, createdAt: 1, description: 1, 'metadata.stoneName': 1, 'metadata.tier': 1 })
        .sort({ createdAt: -1 }).limit(collLimit).toArray()
    );
  } else queries.push(Promise.resolve([]));

  const [audit, lunari, cards, stones] = await Promise.all(queries);

  const events: ActivityEvent[] = [
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
      description: e.description,
      timestamp: new Date(e.createdAt ?? e.timestamp ?? 0).toISOString(),
    })),
    ...cards.map((e: any) => ({
      id: `c:${String(e._id)}`,
      kind: 'card' as const,
      action: e.type,
      target: e.discordId,
      amount: e.amount,
      description: e.metadata?.cardName
        ? `${e.metadata.cardName}${e.metadata.rarity ? ' · ' + e.metadata.rarity : ''}`
        : e.description,
      timestamp: new Date(e.createdAt ?? e.timestamp ?? 0).toISOString(),
    })),
    ...stones.map((e: any) => ({
      id: `s:${String(e._id)}`,
      kind: 'stone' as const,
      action: e.type,
      target: e.discordId,
      amount: e.amount,
      description: e.metadata?.stoneName
        ? `${e.metadata.stoneName}${e.metadata.tier ? ' · ' + e.metadata.tier : ''}`
        : e.description,
      timestamp: new Date(e.createdAt ?? e.timestamp ?? 0).toISOString(),
    })),
  ];

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const windowed = events.slice(offset, offset + limit);

  // Enrich with usernames + avatars in one batch
  const ids = Array.from(new Set(windowed.map((e) => e.target).filter(Boolean))) as string[];
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
    for (const e of windowed) {
      if (!e.target) continue;
      const info = userMap.get(e.target);
      if (info) {
        e.targetName = info.name || undefined;
        e.targetAvatar = info.avatar;
      }
    }
  }

  return NextResponse.json({
    events: windowed,
    total: events.length,
    hasMore: events.length > offset + limit,
  });
}
