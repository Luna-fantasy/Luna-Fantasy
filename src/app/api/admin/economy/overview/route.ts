import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getEconomyOverview } from '@/lib/admin/db';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  try {
    const overview = await getEconomyOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Economy overview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
