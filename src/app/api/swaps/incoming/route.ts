import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getIncomingSwaps } from '@/lib/bazaar/swap-ops';

/**
 * GET /api/swaps/incoming
 * Get pending swap offers targeting the current user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const swaps = await getIncomingSwaps(session.user.discordId);
  return NextResponse.json({ swaps });
}
