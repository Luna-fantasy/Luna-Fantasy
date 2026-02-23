import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOutgoingSwaps } from '@/lib/bazaar/swap-ops';

/**
 * GET /api/swaps/outgoing
 * Get user's outgoing swap offers.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const swaps = await getOutgoingSwaps(session.user.discordId);
  return NextResponse.json({ swaps });
}
