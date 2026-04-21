import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const status = searchParams.get('status'); // 'open', 'closed', or null for all

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('tickets_support');

    const filter: any = { _id: { $regex: /^ticket_(?!counter)/ } };
    if (status === 'open' || status === 'closed') {
      filter.status = status;
    }

    const tickets = await col.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Resolve usernames
    const uniqueIds = Array.from(new Set(
      tickets.flatMap(t => [t.userId, t.closedBy]).filter(Boolean)
    ));

    const discordUsers = uniqueIds.length > 0
      ? await db.collection('discord_users').find({ _id: { $in: uniqueIds } as any }).project({ _id: 1, username: 1, avatar: 1 }).toArray()
      : [];

    const userMap = new Map<string, string>();
    for (const u of discordUsers) {
      userMap.set(String(u._id), u.username || 'Unknown');
    }

    const result = tickets.map(t => ({
      ticketNumber: t.ticketNumber,
      threadId: t.threadId,
      userId: t.userId,
      username: userMap.get(t.userId) || t.userId,
      categoryId: t.categoryId,
      status: t.status,
      createdAt: t.createdAt,
      closedAt: t.closedAt,
      closedBy: t.closedBy,
      closedByName: t.closedBy ? (userMap.get(t.closedBy) || t.closedBy) : null,
    }));

    // Get counter
    const counter = await col.findOne({ _id: 'ticket_counter' as any });

    return NextResponse.json({
      tickets: result,
      total: result.length,
      counter: counter?.value ?? 0,
    });
  } catch (error) {
    console.error('[admin/tickets GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
