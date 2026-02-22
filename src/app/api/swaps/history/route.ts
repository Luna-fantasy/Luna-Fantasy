import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSwapHistory } from '@/lib/bazaar/swap-ops';

/**
 * GET /api/swaps/history
 * Get resolved swaps involving the current user.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const swaps = await getSwapHistory(session.user.discordId);
  return NextResponse.json({ swaps });
}
