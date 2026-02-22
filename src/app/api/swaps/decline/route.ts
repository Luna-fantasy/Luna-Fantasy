import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { addCardToUser } from '@/lib/bazaar/card-ops';
import { declineSwap, getSwapById } from '@/lib/bazaar/swap-ops';

/**
 * POST /api/swaps/decline
 * Decline a swap. Returns requester's card.
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

  const declined = await declineSwap(swapId, discordId);
  if (!declined) {
    return NextResponse.json({ error: 'Swap not found or already resolved' }, { status: 404 });
  }

  // Return requester's card
  try {
    await addCardToUser(
      declined.requesterId,
      {
        name: declined.requesterCard.name,
        rarity: declined.requesterCard.rarity,
        attack: declined.requesterCard.attack,
        imageUrl: declined.requesterCard.imageUrl,
        weight: declined.requesterCard.weight,
      },
      declined.requesterCard.source || 'Swap Declined'
    );
  } catch (err) {
    console.error('[swaps/decline] Failed to return card:', err);
  }

  const res = NextResponse.json({ success: true });
  return refreshCsrf(res);
}
