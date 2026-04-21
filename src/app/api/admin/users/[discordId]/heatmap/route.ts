import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: { discordId: string } }
) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const discordId = String(context.params.discordId).replace(/[^0-9]/g, '').slice(0, 32);
  if (!discordId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const { session } = auth;
  const adminId = session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const client = await clientPromise;
  const db = client.db('Database');

  const days = 365;
  const from = new Date(Date.now() - days * 86400 * 1000);
  from.setHours(0, 0, 0, 0);
  const dayKey = (d: Date) => {
    const dayIndex = Math.floor((d.getTime() - from.getTime()) / 86400 / 1000);
    return dayIndex;
  };

  try {
    const [lunari, cards, stones, audit] = await Promise.all([
      db.collection('lunari_transactions').find({ discordId, createdAt: { $gte: from } })
        .project({ createdAt: 1 }).toArray(),
      db.collection('cards_transactions').find({ discordId, createdAt: { $gte: from } })
        .project({ createdAt: 1 }).toArray(),
      db.collection('stones_transactions').find({ discordId, createdAt: { $gte: from } })
        .project({ createdAt: 1 }).toArray(),
      db.collection('admin_audit_log').find({ targetDiscordId: discordId, timestamp: { $gte: from } })
        .project({ timestamp: 1 }).toArray(),
    ]);

    const buckets = new Array(days).fill(0);
    const bump = (iso: Date | null | undefined) => {
      if (!iso) return;
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return;
      const k = dayKey(d);
      if (k >= 0 && k < days) buckets[k]++;
    };
    for (const t of lunari) bump((t as any).createdAt);
    for (const t of cards) bump((t as any).createdAt);
    for (const t of stones) bump((t as any).createdAt);
    for (const t of audit) bump((t as any).timestamp);

    const max = Math.max(1, ...buckets);

    return NextResponse.json({
      days,
      from: from.toISOString(),
      buckets,
      max,
      total: buckets.reduce((a, b) => a + b, 0),
    });
  } catch (err) {
    console.error('Heatmap error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
