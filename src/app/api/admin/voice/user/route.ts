import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('voice_user', adminId, 15, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  const userId = request.nextUrl.searchParams.get('id');
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
  }

  // Basic Discord snowflake validation — must be numeric, 17-20 digits
  if (!/^\d{17,20}$/.test(userId)) {
    return NextResponse.json({ error: 'Invalid Discord user ID format' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const [userStats, roomHistory, currentRoom] = await Promise.all([
      db.collection('vc_user_stats').findOne({ _id: userId as any }),
      db.collection('vc_stats').find({ ownerId: userId }).sort({ deletedAt: -1 }).limit(10)
        .project({ name: 1, peakAuraScore: 1, totalVisitors: 1, deletedAt: 1 })
        .toArray(),
      db.collection('vc_rooms').findOne(
        { ownerId: userId, deletedAt: { $exists: false } },
        { projection: { _id: 1, name: 1, 'aura.tier': 1, 'aura.score': 1, memberCount: 1 } },
      ),
    ]);

    return NextResponse.json({
      stats: {
        totalRoomsCreated: userStats?.totalRoomsCreated ?? 0,
        totalVoiceMinutes: userStats?.totalVoiceMinutes ?? 0,
        challengesWon: userStats?.challengesWon ?? 0,
        totalLunariSpent: userStats?.totalLunariSpent ?? 0,
        vipPurchases: userStats?.vipPurchases ?? 0,
      },
      roomHistory: roomHistory.map((r) => ({
        name: r.name,
        peakAuraScore: r.peakAuraScore ?? 0,
        totalVisitors: r.totalVisitors ?? 0,
        deletedAt: r.deletedAt ?? null,
      })),
      currentRoom: currentRoom
        ? {
            _id: currentRoom._id,
            name: currentRoom.name,
            aura: currentRoom.aura,
            memberCount: currentRoom.memberCount ?? 0,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[admin/voice/user GET] Error:', err);
    return NextResponse.json({ error: 'Failed to load user voice data' }, { status: 500 });
  }
}
