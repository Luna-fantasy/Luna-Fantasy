import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';
import { getUserRank } from '@/lib/admin/ranks';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = String(context.params.discordId).replace(/[^0-9]/g, '').slice(0, 32);
  if (!discordId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const { session } = authResult;
  const adminId = session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
  const client = await clientPromise;
  const db = client.db('Database');

  const parseAmount = (v: unknown): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    return 0;
  };

  const safeIso = (v: unknown): string => {
    if (!v) return new Date(0).toISOString();
    const d = v instanceof Date ? v : new Date(v as any);
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
  };

  const [discordUser, websiteUser, points, levels, profile, tickets, cards, stones, recentAudit, recentLunari, rank] = await Promise.all([
    db.collection('discord_users').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('users').findOne({ discordId }).catch(() => null),
    db.collection('points').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('levels').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('profiles').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('tickets').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('cards').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('stones').findOne({ _id: discordId as any }).catch(() => null),
    db.collection('admin_audit_log')
      .find({ targetDiscordId: discordId })
      .project({ action: 1, adminUsername: 1, 'metadata.amount': 1, 'metadata.reason': 1, timestamp: 1 })
      .sort({ timestamp: -1 }).limit(5).toArray(),
    db.collection('lunari_transactions')
      .find({ discordId })
      .project({ type: 1, amount: 1, balanceBefore: 1, balanceAfter: 1, createdAt: 1, timestamp: 1 })
      .sort({ createdAt: -1 }).limit(5).toArray(),
    getUserRank(discordId),
  ]);

  if (!discordUser && !websiteUser && !points && !levels && !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const username = websiteUser?.username ?? (discordUser as any)?.username ?? null;
  const globalName = websiteUser?.globalName ?? (discordUser as any)?.globalName ?? null;
  const avatarHash = (discordUser as any)?.avatar ?? null;
  const image = websiteUser?.image
    ?? (avatarHash ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=128` : null);

  const profileData = (profile as any)?.data ?? profile ?? {};
  const passport = profileData.passport ?? null;

  const levelsData = (levels as any)?.data ?? levels ?? {};
  const level = Number(levelsData.level ?? 0);
  const xp = Number(levelsData.xp ?? 0);

  const cardCount = Array.isArray((cards as any)?.cards) ? (cards as any).cards.length : 0;
  const stoneCount = Array.isArray((stones as any)?.stones) ? (stones as any).stones.length : 0;
  const ticketBalance = parseAmount((tickets as any)?.balance);

  return NextResponse.json({
    discordId,
    username,
    globalName,
    image,
    balance: parseAmount((points as any)?.balance),
    level,
    xp,
    passport,
    rank,
    counts: {
      cards: cardCount,
      stones: stoneCount,
      tickets: ticketBalance,
    },
    recentAudit: recentAudit.map((a: any) => ({
      id: String(a._id),
      action: a.action,
      admin: a.adminUsername,
      amount: a.metadata?.amount,
      reason: a.metadata?.reason,
      timestamp: safeIso(a.timestamp),
    })),
    recentLunari: recentLunari.map((t: any) => ({
      id: String(t._id),
      type: t.type,
      amount: parseAmount(t.amount),
      after: parseAmount(t.balanceAfter),
      timestamp: safeIso(t.createdAt ?? t.timestamp),
    })),
  });
  } catch (err) {
    console.error('Peek API error:', err);
    return NextResponse.json({ error: 'Internal error', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
