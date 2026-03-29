import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSwapHistory } from '@/lib/bazaar/swap-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';

/**
 * GET /api/swaps/history
 * Get resolved swaps involving the current user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit('swaps_history', session.user.discordId, RATE_LIMITS.swaps_history.maxRequests, RATE_LIMITS.swaps_history.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const swaps = await getSwapHistory(session.user.discordId);
  return NextResponse.json({ swaps });
}
