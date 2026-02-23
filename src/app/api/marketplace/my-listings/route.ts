import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserListings } from '@/lib/bazaar/marketplace-ops';

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

    const listings = await getUserListings(session.user.discordId);
    return NextResponse.json({ listings });
  } catch (error) {
    console.error('[marketplace/my-listings] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
