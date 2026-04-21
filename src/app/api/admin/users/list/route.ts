import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';
import { getUserRanksBulk, type Rank } from '@/lib/admin/ranks';

export const dynamic = 'force-dynamic';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface UserListRow {
  discordId: string;
  username: string | null;
  globalName: string | null;
  image: string | null;
  balance: number;
  level: number;
  passport: {
    number?: string;
    faction?: string;
    staffRole?: string;
  } | null;
  cardCount: number;
  stoneCount: number;
  sparkline: number[]; // last 14 days balance trajectory
  anomalies: string[];
  lastActive: string | null;
  rank: Rank;
}

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const { session } = auth;
  const adminId = session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get('q') ?? '').trim().slice(0, 80);
  const faction = (searchParams.get('faction') ?? '').trim().toLowerCase();
  const staffOnly = searchParams.get('staffOnly') === '1';
  const passportOnly = searchParams.get('passportOnly') === '1';
  const sort = (searchParams.get('sort') ?? 'balance').toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(60, Math.max(12, parseInt(searchParams.get('limit') ?? '24', 10)));
  const skip = (page - 1) * limit;

  const client = await clientPromise;
  const db = client.db('Database');

  try {
    // Build base sort on `points.balance` or `levels.level`
    const sortSpec: Record<string, 1 | -1> =
      sort === 'level' ? { 'levels.level': -1, 'points.balance': -1 }
      : sort === 'name' ? { 'discord.username': 1 }
      : sort === 'recent' ? { 'points.balance': -1 } // handled post-hoc; need lastActive
      : { 'points.balance': -1 };

    // Match stage: build filter expression
    const matchStage: Record<string, unknown> = {};
    if (q) {
      const numeric = /^[0-9]{5,}$/.test(q);
      if (numeric) {
        matchStage._id = q;
      } else {
        const rx = new RegExp(escapeRegex(q), 'i');
        matchStage.$or = [
          { 'discord.username': rx },
          { 'discord.globalName': rx },
        ];
      }
    }
    if (faction) {
      matchStage.$or = [
        ...(Array.isArray(matchStage.$or) ? (matchStage.$or as any[]) : []),
        { 'profile.data.passport.faction': new RegExp(escapeRegex(faction), 'i') },
        { 'profile.passport.faction': new RegExp(escapeRegex(faction), 'i') },
      ];
    }
    if (staffOnly) {
      matchStage.$and = [
        ...(Array.isArray(matchStage.$and) ? (matchStage.$and as any[]) : []),
        { $or: [
          { 'profile.data.passport.staffRole': { $exists: true, $nin: [null, ''] } },
          { 'profile.passport.staffRole': { $exists: true, $nin: [null, ''] } },
        ] },
      ];
    }
    if (passportOnly) {
      matchStage.$and = [
        ...(Array.isArray(matchStage.$and) ? (matchStage.$and as any[]) : []),
        { $or: [
          { 'profile.data.passport.number': { $exists: true, $nin: [null, ''] } },
          { 'profile.passport.number': { $exists: true, $nin: [null, ''] } },
        ] },
      ];
    }

    // Start from `points` (most complete user set), lookup the rest
    const pipeline: any[] = [
      { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'discord' } },
      { $unwind: { path: '$discord', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'levels', localField: '_id', foreignField: '_id', as: 'levels' } },
      { $unwind: { path: '$levels', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'profiles', localField: '_id', foreignField: '_id', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'cards', localField: '_id', foreignField: '_id', as: 'cards' } },
      { $unwind: { path: '$cards', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'stones', localField: '_id', foreignField: '_id', as: 'stones' } },
      { $unwind: { path: '$stones', preserveNullAndEmptyArrays: true } },
    ];
    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });
    pipeline.push(
      { $sort: sortSpec },
      { $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          { $project: {
            _id: 1,
            balance: '$balance',
            'discord.username': 1,
            'discord.globalName': 1,
            'discord.avatar': 1,
            'levels.level': 1,
            'levels.data': 1,
            'profile.data.passport': 1,
            'profile.passport': 1,
            'cards.cards': 1,
            'stones.stones': 1,
          } },
        ],
        total: [{ $count: 'n' }],
      } },
    );

    const agg = await db.collection('points').aggregate(pipeline).toArray();
    const { rows = [], total = [] } = agg[0] ?? { rows: [], total: [] };
    const totalCount = total[0]?.n ?? 0;

    // Pull recent Lunari txns for all ids in ONE query, then bucket by user
    const ids = rows.map((r: any) => String(r._id));
    const sinceDate = new Date(Date.now() - 14 * 86400 * 1000);
    const recentTx = ids.length === 0 ? [] : await db.collection('lunari_transactions')
      .find({ discordId: { $in: ids }, createdAt: { $gte: sinceDate } })
      .project({ discordId: 1, amount: 1, createdAt: 1, balanceAfter: 1 })
      .sort({ createdAt: 1 })
      .toArray();

    const txByUser = new Map<string, any[]>();
    for (const t of recentTx) {
      const k = String((t as any).discordId);
      const arr = txByUser.get(k) ?? [];
      arr.push(t);
      txByUser.set(k, arr);
    }

    // Last-active: most recent createdAt per user
    const lastByUser = new Map<string, string>();
    for (const [uid, txs] of Array.from(txByUser)) {
      const last = txs[txs.length - 1];
      lastByUser.set(uid, new Date(last.createdAt).toISOString());
    }

    // Balance percentile baseline for anomaly "top holder"
    const sortedBalances = rows.map((r: any) => Number(r.balance ?? 0)).sort((a: number, b: number) => a - b);
    const p90 = sortedBalances[Math.floor(sortedBalances.length * 0.9)] ?? Infinity;

    // Bulk-resolve ranks (hits Discord API once per uncached user; cached 5min)
    const ranksById = await getUserRanksBulk(ids);

    const out: UserListRow[] = rows.map((r: any) => {
      const discordId = String(r._id);
      const balance = Number(r.balance ?? 0);
      const txs = txByUser.get(discordId) ?? [];

      // 14-point sparkline of end-of-day balance
      const sparkline: number[] = [];
      if (txs.length > 0) {
        const cutoff = Date.now() - 14 * 86400 * 1000;
        const days: number[] = new Array(14).fill(null as any);
        // Forward-fill: last known balance per day
        let lastVal = Number(txs[0].balanceAfter ?? balance);
        for (const t of txs) {
          const day = Math.floor((new Date(t.createdAt).getTime() - cutoff) / 86400 / 1000);
          if (day < 0 || day > 13) continue;
          lastVal = Number(t.balanceAfter ?? lastVal);
          days[day] = lastVal;
        }
        // Forward-fill holes
        let carry = days.find((v) => v != null) ?? balance;
        for (let i = 0; i < 14; i++) {
          if (days[i] == null) days[i] = carry; else carry = days[i];
        }
        sparkline.push(...days);
      } else {
        for (let i = 0; i < 14; i++) sparkline.push(balance);
      }

      // Anomaly flags
      const anomalies: string[] = [];
      if (balance >= p90 && balance > 100_000) anomalies.push('top-holder');
      if (sparkline.length === 14) {
        const delta = sparkline[13] - sparkline[0];
        if (Math.abs(delta) > 1_000_000) anomalies.push(delta > 0 ? 'big-gain' : 'big-loss');
      }
      if (txs.length === 0 && balance > 500_000) anomalies.push('ghost');

      const passportRaw = r.profile?.data?.passport ?? r.profile?.passport ?? null;
      const passport = passportRaw ? {
        number: passportRaw.number,
        faction: passportRaw.faction,
        staffRole: passportRaw.staffRole,
      } : null;

      const discord = r.discord ?? {};
      const image = discord.avatar
        ? `https://cdn.discordapp.com/avatars/${discordId}/${discord.avatar}.png?size=128`
        : null;

      const levelsData = r.levels?.data ?? r.levels ?? {};
      const level = Number(levelsData.level ?? 0);

      return {
        discordId,
        username: discord.username ?? null,
        globalName: discord.globalName ?? null,
        image,
        balance,
        level,
        passport,
        cardCount: Array.isArray(r.cards?.cards) ? r.cards.cards.length : 0,
        stoneCount: Array.isArray(r.stones?.stones) ? r.stones.stones.length : 0,
        sparkline,
        anomalies,
        lastActive: lastByUser.get(discordId) ?? null,
        rank: ranksById.get(discordId)!,
      };
    });

    return NextResponse.json({ rows: out, total: totalCount, page, limit });
  } catch (err) {
    console.error('Users list error:', err);
    return NextResponse.json({ error: 'Internal error', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
