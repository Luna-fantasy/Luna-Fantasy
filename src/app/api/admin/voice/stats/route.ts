import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const [activeRooms, hallAura, hallVisitors, topUsers, totalStats] = await Promise.all([
      // Active rooms
      db.collection('vc_rooms').find({}).project({
        _id: 1, name: 1, ownerId: 1, type: 1, 'aura.tier': 1, 'aura.score': 1,
        memberCount: 1, isLocked: 1, isHidden: 1, createdAt: 1,
      }).toArray(),

      // Hall of Records — top 10 by peak aura
      db.collection('vc_stats').find({})
        .sort({ peakAuraScore: -1 }).limit(10)
        .project({ name: 1, ownerId: 1, peakAuraScore: 1, peakAuraTier: 1, totalVisitors: 1 })
        .toArray(),

      // Hall of Records — top 10 by visitors
      db.collection('vc_stats').find({})
        .sort({ totalVisitors: -1 }).limit(10)
        .project({ name: 1, ownerId: 1, peakAuraScore: 1, totalVisitors: 1 })
        .toArray(),

      // Top users
      db.collection('vc_user_stats').find({})
        .sort({ totalRoomsCreated: -1 }).limit(20)
        .project({
          _id: 1, totalRoomsCreated: 1, totalVoiceMinutes: 1,
          challengesWon: 1,
        })
        .toArray(),

      // Aggregate totals
      db.collection('vc_user_stats').aggregate([
        {
          $group: {
            _id: null,
            totalRooms: { $sum: '$totalRoomsCreated' },
            totalMinutes: { $sum: '$totalVoiceMinutes' },
          },
        },
      ]).toArray(),
    ]);

    const totals = totalStats[0] || { totalRooms: 0, totalMinutes: 0 };

    return NextResponse.json({
      activeRooms,
      hallOfRecords: { byAura: hallAura, byVisitors: hallVisitors },
      topUsers,
      totals: {
        totalRoomsCreated: totals.totalRooms,
        totalVoiceHours: Math.round((totals.totalMinutes || 0) / 60),
        activeRoomsCount: activeRooms.length,
      },
    });
  } catch (err: any) {
    console.error('[admin/voice/stats GET] Error:', err);
    return NextResponse.json({ error: 'Failed to load voice stats' }, { status: 500 });
  }
}
