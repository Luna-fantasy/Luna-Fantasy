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
  const { allowed, retryAfterMs } = checkRateLimit('analytics_games', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);

    const [totalsByGame, topPlayers, revenueByType, nemesisDocs, userLookup] = await Promise.all([
      db.collection('game_wins').aggregate([
        { $group: {
          _id: null,
          luna_fantasy: { $sum: { $ifNull: ['$luna_fantasy', 0] } },
          grand_fantasy: { $sum: { $ifNull: ['$grand_fantasy', 0] } },
          faction_war: { $sum: { $ifNull: ['$faction_war', 0] } },
          totalPlayers: { $sum: 1 },
        }},
      ]).toArray(),

      db.collection('game_wins').aggregate([
        { $addFields: { totalWins: { $add: [
          { $ifNull: ['$luna_fantasy', 0] },
          { $ifNull: ['$grand_fantasy', 0] },
          { $ifNull: ['$faction_war', 0] },
        ]}}},
        { $match: { totalWins: { $gt: 0 } } },
        { $sort: { totalWins: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'discord_users', let: { uid: { $ifNull: ['$id', { $toString: '$_id' }] } }, pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$uid'] } } }], as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { userId: { $ifNull: ['$id', '$_id'] }, username: '$user.username', avatar: '$user.avatar', luna_fantasy: 1, grand_fantasy: 1, faction_war: 1, totalWins: 1 } },
      ]).toArray(),

      db.collection('lunari_transactions').aggregate([
        { $match: { type: { $regex: /^(roulette_|fantasy_|gf_|fw_|mafia_|rps_|mines_|bomb_|coinflip_|luna21_|connect4_|xo_|steal_|trivia_|game_|duel_)/ } } },
        { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
        { $sort: { count: -1 } },
      ]).toArray(),

      db.collection('nemesis').find({}).limit(200).toArray(),
      db.collection('discord_users').find({}).project({ username: 1, avatar: 1 }).toArray(),
    ]);

    const userMap = new Map<string, { username?: string; avatar?: string }>();
    for (const u of userLookup) userMap.set(String(u._id), { username: u.username, avatar: u.avatar });

    const nemesisRankings = nemesisDocs
      .map((doc: any) => {
        const id = String(doc._id);
        const parts = id.split('_');
        if (parts.length !== 2) return null;
        const [u1, u2] = parts;
        const w1 = typeof doc[u1] === 'number' ? doc[u1] : 0;
        const w2 = typeof doc[u2] === 'number' ? doc[u2] : 0;
        return {
          user1: { id: u1, wins: w1, ...userMap.get(u1) },
          user2: { id: u2, wins: w2, ...userMap.get(u2) },
          totalGames: w1 + w2,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.totalGames - a.totalGames)
      .slice(0, 10);

    return NextResponse.json({
      totalsByGame: totalsByGame[0] ?? { luna_fantasy: 0, grand_fantasy: 0, faction_war: 0, totalPlayers: 0 },
      topPlayers,
      revenueByType,
      nemesisRankings,
    });
  } catch (err: any) {
    console.error('[analytics/games] Error:', err);
    return NextResponse.json({ error: 'Failed to load game analytics' }, { status: 500 });
  }
}
