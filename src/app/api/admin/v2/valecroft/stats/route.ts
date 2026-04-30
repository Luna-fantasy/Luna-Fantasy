import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { getValecroftStats } from '@/lib/admin/valecroft';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const stats = await getValecroftStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('Valecroft stats error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
