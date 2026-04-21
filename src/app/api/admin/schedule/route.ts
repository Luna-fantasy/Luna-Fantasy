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
  const { allowed, retryAfterMs } = checkRateLimit('schedule_read', adminId, 15, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86_400_000);

    const [scheduledChallenges, activeChallenges, selunaSched, chatEvents] = await Promise.all([
      db.collection('challenges').find({
        status: 'scheduled',
        scheduledAt: { $lte: thirtyDaysFromNow },
      }).sort({ scheduledAt: 1 }).limit(100).toArray(),

      db.collection('challenges').find({
        status: 'active',
        closesAt: { $exists: true },
      }).sort({ closesAt: 1 }).limit(50).toArray(),

      db.collection('bot_config').findOne({ _id: 'jester_seluna_schedule' as any }),

      db.collection('chat_events').find({
        $or: [
          { status: 'scheduled' },
          { status: 'active' },
          { startsAt: { $gte: now } },
        ],
      }).sort({ startsAt: 1 }).limit(50).toArray(),
    ]);

    const events: Array<{
      id: string;
      type: 'challenge_scheduled' | 'challenge_closing' | 'seluna_rotation' | 'chat_event';
      title: string;
      subtitle?: string;
      at: string;
      status: string;
      color: string;
    }> = [];

    for (const c of scheduledChallenges) {
      if (!c.scheduledAt) continue;
      events.push({
        id: `chs_${c._id}`,
        type: 'challenge_scheduled',
        title: String(c.name ?? c.title ?? 'Challenge'),
        subtitle: 'Challenge starts',
        at: new Date(c.scheduledAt).toISOString(),
        status: 'scheduled',
        color: '#FFD54F',
      });
    }

    for (const c of activeChallenges) {
      if (!c.closesAt) continue;
      events.push({
        id: `chc_${c._id}`,
        type: 'challenge_closing',
        title: String(c.name ?? c.title ?? 'Challenge'),
        subtitle: 'Challenge closes',
        at: new Date(c.closesAt).toISOString(),
        status: 'active',
        color: '#48D8FF',
      });
    }

    const selunaData = selunaSched?.data ?? {};
    if (selunaData.next_rotation || selunaData.nextRotation) {
      const at = new Date(selunaData.next_rotation ?? selunaData.nextRotation);
      if (!Number.isNaN(at.getTime()) && at <= thirtyDaysFromNow) {
        events.push({
          id: 'seluna_rotation',
          type: 'seluna_rotation',
          title: 'Seluna stock rotation',
          subtitle: 'Limited shop refreshes',
          at: at.toISOString(),
          status: 'scheduled',
          color: '#B066FF',
        });
      }
    }

    for (const e of chatEvents) {
      const at = e.startsAt ?? e.createdAt;
      if (!at) continue;
      events.push({
        id: `ce_${e._id}`,
        type: 'chat_event',
        title: String(e.name ?? 'Chat event'),
        subtitle: e.channelId ? `in <#${e.channelId}>` : undefined,
        at: new Date(at).toISOString(),
        status: String(e.status ?? 'scheduled'),
        color: '#00FF99',
      });
    }

    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return NextResponse.json({ events, generatedAt: now.toISOString() });
  } catch (err: any) {
    console.error('[schedule GET]', err);
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 });
  }
}
