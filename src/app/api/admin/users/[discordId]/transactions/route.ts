import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const TX_COLLECTION_MAP: Record<string, string> = {
  lunari: 'lunari_transactions',
  cards: 'cards_transactions',
  stones: 'stones_transactions',
};

/**
 * Paginated user transactions endpoint.
 * GET /api/admin/users/{discordId}/transactions?page=1&limit=50&type=lunari|cards|stones
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));
  const type = url.searchParams.get('type') ?? 'lunari';
  const collectionName = TX_COLLECTION_MAP[type];

  if (!collectionName) {
    return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(collectionName);

    const [transactions, total] = await Promise.all([
      collection
        .find({ discordId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments({ discordId }),
    ]);

    const mapped = transactions.map((t) => ({
      _id: t._id.toString(),
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      timestamp: t.createdAt ?? t.timestamp,
      metadata: t.metadata,
    }));

    return NextResponse.json({
      transactions: mapped,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('User transactions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
