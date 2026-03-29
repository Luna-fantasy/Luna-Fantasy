import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOutgoingSwaps } from '@/lib/bazaar/swap-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';

/**
 * GET /api/swaps/outgoing
 * Get user's outgoing swap offers.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit('swaps_list', session.user.discordId, RATE_LIMITS.swaps_list.maxRequests, RATE_LIMITS.swaps_list.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const swaps = await getOutgoingSwaps(session.user.discordId);
  return NextResponse.json({ swaps });
}
