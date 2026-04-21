import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
const DB = 'Database';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('analytics_collections', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const cardsCol = db.collection('cards');
    const stonesCol = db.collection('stones');

    const [cardsByRarity, rarest, mostCommon, cardHolders, stonesByName, stoneHolders] = await Promise.all([
      cardsCol.aggregate([
        { $unwind: '$cards' },
        { $group: { _id: '$cards.rarity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),

      cardsCol.aggregate([
        { $unwind: '$cards' },
        { $group: { _id: '$cards.name', count: { $sum: 1 }, rarity: { $first: '$cards.rarity' }, imageUrl: { $first: '$cards.imageUrl' }, attack: { $first: '$cards.attack' } } },
        { $sort: { count: 1 } },
        { $limit: 10 },
      ]).toArray(),

      cardsCol.aggregate([
        { $unwind: '$cards' },
        { $group: { _id: '$cards.name', count: { $sum: 1 }, rarity: { $first: '$cards.rarity' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray(),

      cardsCol.countDocuments({ cards: { $exists: true, $not: { $size: 0 } } }),

      stonesCol.aggregate([
        { $unwind: '$stones' },
        { $group: { _id: '$stones.name', count: { $sum: 1 }, imageUrl: { $first: '$stones.imageUrl' } } },
        { $sort: { count: -1 } },
      ]).toArray(),

      stonesCol.countDocuments({ stones: { $exists: true, $not: { $size: 0 } } }),
    ]);

    const totalCards = cardsByRarity.reduce((s, r) => s + r.count, 0);
    const totalStones = stonesByName.reduce((s, r) => s + r.count, 0);

    return NextResponse.json({
      cards: { totalOwned: totalCards, totalHolders: cardHolders, byRarity: cardsByRarity, rarest, mostCommon },
      stones: { totalOwned: totalStones, totalHolders: stoneHolders, byName: stonesByName },
    });
  } catch (err: any) {
    console.error('[analytics/collections] Error:', err);
    return NextResponse.json({ error: 'Failed to load collection analytics' }, { status: 500 });
  }
}
