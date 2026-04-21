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
  const { allowed, retryAfterMs } = checkRateLimit('analytics_chat', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);

    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(`universal_chat_${d.toISOString().slice(0, 10)}`);
    }

    const [chatDocs, topChatters, voiceLeaders] = await Promise.all([
      db.collection('chat_stats').find({ _id: { $in: days as any[] } }).toArray(),

      db.collection('levels').aggregate([
        { $match: { messages: { $gt: 0 } } },
        { $sort: { messages: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { userId: '$_id', username: '$user.username', avatar: '$user.avatar', messages: 1, level: 1 } },
      ]).toArray(),

      db.collection('levels').aggregate([
        { $match: { voiceTime: { $gt: 0 } } },
        { $sort: { voiceTime: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'discord_users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { userId: '$_id', username: '$user.username', avatar: '$user.avatar', voiceTime: 1, level: 1 } },
      ]).toArray(),
    ]);

    const dailyMessages = days.map((dayId) => {
      const doc = chatDocs.find((d: any) => String(d._id) === dayId);
      const date = dayId.replace('universal_chat_', '');
      if (!doc?.counts) return { date, count: 0 };
      const count = Object.values(doc.counts as Record<string, number>).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      return { date, count };
    });

    const totalMessages30d = dailyMessages.reduce((s, d) => s + d.count, 0);

    return NextResponse.json({ dailyMessages, totalMessages30d, topChatters, voiceLeaders });
  } catch (err: any) {
    console.error('[analytics/chat] Error:', err);
    return NextResponse.json({ error: 'Failed to load chat analytics' }, { status: 500 });
  }
}
