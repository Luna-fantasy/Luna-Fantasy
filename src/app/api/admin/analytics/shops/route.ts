import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const DB = 'Database';

const SHOP_TYPES = [
  'mells_purchase', 'brimor_purchase', 'shop_purchase', 'seluna_purchase',
  'meluna_purchase', 'card_purchase', 'ticket_purchase',
  'luckbox_spend', 'stonebox_spend', 'ticket_spend',
];

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('analytics_shops', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const txCol = db.collection('lunari_transactions');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [revenueByType, topSpenders, dailyRevenue] = await Promise.all([
      txCol.aggregate([
        { $match: { type: { $in: SHOP_TYPES } } },
        { $group: { _id: '$type', count: { $sum: 1 }, totalSpent: { $sum: '$amount' } } },
        { $sort: { totalSpent: -1 } },
      ]).toArray(),

      txCol.aggregate([
        { $match: { type: { $in: SHOP_TYPES } } },
        { $group: { _id: '$discordId', totalSpent: { $sum: '$amount' }, purchases: { $sum: 1 } } },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { userId: '$_id', username: '$user.username', avatar: '$user.avatar', totalSpent: 1, purchases: 1 } },
      ]).toArray(),

      txCol.aggregate([
        { $match: { type: { $in: SHOP_TYPES }, createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),
    ]);

    const totalRevenue = revenueByType.reduce((s, r) => s + r.totalSpent, 0);
    const totalPurchases = revenueByType.reduce((s, r) => s + r.count, 0);

    return NextResponse.json({ revenueByType, topSpenders, dailyRevenue, totalRevenue, totalPurchases });
  } catch (err: any) {
    console.error('[analytics/shops] Error:', err);
    return NextResponse.json({ error: 'Failed to load shop analytics' }, { status: 500 });
  }
}
