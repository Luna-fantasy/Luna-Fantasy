import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Aggregate card counts per rarity, handling both `cards` array and legacy `data` field.
    // We use a two-pass approach: first project a normalized cards array, then unwind and group.
    const pipeline = [
      {
        $project: {
          cardArr: {
            $cond: {
              if: { $isArray: '$cards' },
              then: '$cards',
              else: {
                $cond: {
                  if: { $and: [{ $ne: ['$data', null] }, { $isArray: '$data' }] },
                  then: '$data',
                  else: [],
                },
              },
            },
          },
        },
      },
      { $unwind: '$cardArr' },
      {
        $group: {
          _id: '$cardArr.rarity',
          count: { $sum: 1 },
          uniqueCards: { $addToSet: '$cardArr.name' },
        },
      },
      {
        $project: {
          rarity: '$_id',
          count: 1,
          uniqueCount: { $size: '$uniqueCards' },
        },
      },
      { $sort: { count: -1 as const } },
    ];

    const distribution = await db.collection('cards').aggregate(pipeline).toArray();
    const totalOwners = await db.collection('cards').countDocuments();

    return NextResponse.json({ distribution, totalOwners });
  } catch (error) {
    console.error('Card distribution error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
