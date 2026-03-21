import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ discordId: string }> }
) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });

  const { discordId } = await params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Query the level_rewards collection for this user's granted rewards
    const escaped = discordId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rewards = await db.collection('level_rewards')
      .find({ id: { $regex: `^${escaped}_` } })
      .toArray();

    // Parse and format results
    const formatted = rewards.map((doc: any) => {
      const val = doc.value ?? doc.data ?? {};
      return {
        id: doc.id,
        level: val.level ?? null,
        lunariReward: val.lunariReward ?? 0,
        ticketsReward: val.ticketsReward ?? 0,
        roleId: val.roleId ?? null,
        grantedAt: val.grantedAt ?? val.timestamp ?? null,
      };
    }).sort((a: any, b: any) => (a.level ?? 0) - (b.level ?? 0));

    return NextResponse.json({ rewards: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err.message) }, { status: 500 });
  }
}
