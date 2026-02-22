import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { addCardToUser } from '@/lib/bazaar/card-ops';
import { cancelSwap } from '@/lib/bazaar/swap-ops';

/**
 * POST /api/swaps/cancel
 * Cancel own swap. Returns requester's card.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const rl = checkRateLimit('swap_respond', discordId, RATE_LIMITS.swap_respond.maxRequests, RATE_LIMITS.swap_respond.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: { swapId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { swapId } = body;
  if (!swapId || typeof swapId !== 'string') {
    return NextResponse.json({ error: 'Swap ID is required' }, { status: 400 });
  }

  const cancelled = await cancelSwap(swapId, discordId);
  if (!cancelled) {
    return NextResponse.json({ error: 'Swap not found or already resolved' }, { status: 404 });
  }

  // Return card
  try {
    await addCardToUser(
      discordId,
      {
        name: cancelled.requesterCard.name,
        rarity: cancelled.requesterCard.rarity,
        attack: cancelled.requesterCard.attack,
        imageUrl: cancelled.requesterCard.imageUrl,
        weight: cancelled.requesterCard.weight,
      },
      cancelled.requesterCard.source || 'Swap Cancelled'
    );
  } catch (err) {
    console.error('[swaps/cancel] Failed to return card:', err);
  }

  const res = NextResponse.json({ success: true });
  return refreshCsrf(res);
}
