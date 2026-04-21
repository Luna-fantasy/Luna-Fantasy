import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { getVaelcroftStats } from '@/lib/admin/vaelcroft';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const stats = await getVaelcroftStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('Vaelcroft stats error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
