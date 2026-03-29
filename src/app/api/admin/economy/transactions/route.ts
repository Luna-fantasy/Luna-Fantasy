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
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const userId = searchParams.get('userId') ?? undefined;
  const type = searchParams.get('type') ?? undefined;
  const source = searchParams.get('source') ?? undefined;
  const minAmount = searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined;
  const maxAmount = searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('lunari_transactions');

    const filter: Record<string, any> = {};
    if (userId) filter.discordId = userId;
    if (type) filter.type = type;
    if (source) filter.source = source;
    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.amount = {};
      if (minAmount !== undefined) filter.amount.$gte = minAmount;
      if (maxAmount !== undefined) filter.amount.$lte = maxAmount;
    }

    const [transactions, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        _id: t._id.toString(),
        discordId: t.discordId,
        type: t.type,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description ?? t.reason,
        metadata: t.metadata,
        timestamp: t.createdAt ?? t.timestamp,
        status: t.status,
        source: t.source ?? 'web',
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
