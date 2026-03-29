import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserListings } from '@/lib/bazaar/marketplace-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';

/**
 * GET /api/marketplace/my-listings
 * Get current user's listings (all statuses). Auth required.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = checkRateLimit('marketplace_my', session.user.discordId, RATE_LIMITS.marketplace_my.maxRequests, RATE_LIMITS.marketplace_my.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const listings = await getUserListings(session.user.discordId);
    return NextResponse.json({ listings });
  } catch (error) {
    console.error('[marketplace/my-listings] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
