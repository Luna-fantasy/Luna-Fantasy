import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const status = searchParams.get('status'); // 'pending', 'accepted', 'rejected', or null

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('applications');

    const filter: any = { _id: { $regex: /^app_/ } };
    if (status) filter.status = status;

    const apps = await col.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Resolve usernames
    const uniqueIds = Array.from(new Set(
      apps.flatMap(a => [a.userId, a.acceptedBy, a.rejectedBy]).filter(Boolean)
    ));

    const discordUsers = uniqueIds.length > 0
      ? await db.collection('discord_users').find({ _id: { $in: uniqueIds } as any }).project({ _id: 1, username: 1 }).toArray()
      : [];

    const userMap = new Map<string, string>();
    for (const u of discordUsers) userMap.set(String(u._id), u.username || 'Unknown');

    const result = apps.map(a => ({
      id: String(a._id),
      userId: a.userId,
      username: userMap.get(a.userId) || a.userId,
      categoryId: a.categoryId,
      status: a.status,
      answers: a.answers || {},
      votes: { likes: a.votes?.likes?.length || 0, dislikes: a.votes?.dislikes?.length || 0 },
      createdAt: a.createdAt,
      acceptedBy: a.acceptedBy ? (userMap.get(a.acceptedBy) || a.acceptedBy) : null,
      acceptedAt: a.acceptedAt,
      rejectedBy: a.rejectedBy ? (userMap.get(a.rejectedBy) || a.rejectedBy) : null,
      rejectedAt: a.rejectedAt,
      rejectionReason: a.rejectionReason,
    }));

    const counts = {
      pending: apps.filter(a => a.status === 'pending').length,
      accepted: apps.filter(a => a.status === 'accepted').length,
      rejected: apps.filter(a => a.status === 'rejected').length,
    };

    return NextResponse.json({ applications: result, total: result.length, counts });
  } catch (error) {
    console.error('[admin/applications GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
