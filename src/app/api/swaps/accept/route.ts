import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { addCardToUser, removeCardFromUser } from '@/lib/bazaar/card-ops';
import { acceptSwap, getSwapById } from '@/lib/bazaar/swap-ops';

/**
 * POST /api/swaps/accept
 * Accept a swap. Exchanges cards between requester and target.
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

  // Verify swap exists and is for this user
  const swap = await getSwapById(swapId);
  if (!swap || swap.status !== 'pending') {
    return NextResponse.json({ error: 'Swap not found or not pending' }, { status: 404 });
  }
  if (swap.targetId !== discordId) {
    return NextResponse.json({ error: 'Not your swap to accept' }, { status: 403 });
  }

  // Check expiry
  if (new Date() > new Date(swap.expiresAt)) {
    return NextResponse.json({ error: 'Swap has expired' }, { status: 400 });
  }

  // Remove target's card (escrow for exchange)
  const removedTargetCard = await removeCardFromUser(discordId, swap.targetCard.id);
  if (!removedTargetCard) {
    return NextResponse.json({ error: 'Target card no longer in your collection' }, { status: 400 });
  }

  // Accept the swap atomically
  const accepted = await acceptSwap(swapId, discordId);
  if (!accepted) {
    // Restore target's card
    await addCardToUser(discordId, {
      name: removedTargetCard.name,
      rarity: removedTargetCard.rarity,
      attack: removedTargetCard.attack,
      imageUrl: removedTargetCard.imageUrl,
      weight: removedTargetCard.weight,
    }, removedTargetCard.source);
    return NextResponse.json({ error: 'Swap already resolved' }, { status: 409 });
  }

  // Exchange cards
  try {
    // Give requester's card to target
    await addCardToUser(discordId, {
      name: swap.requesterCard.name,
      rarity: swap.requesterCard.rarity,
      attack: swap.requesterCard.attack,
      imageUrl: swap.requesterCard.imageUrl,
      weight: swap.requesterCard.weight,
    }, 'Swap');

    // Give target's card to requester
    await addCardToUser(swap.requesterId, {
      name: removedTargetCard.name,
      rarity: removedTargetCard.rarity,
      attack: removedTargetCard.attack,
      imageUrl: removedTargetCard.imageUrl,
      weight: removedTargetCard.weight,
    }, 'Swap');

    const res = NextResponse.json({ success: true });
    return refreshCsrf(res);
  } catch (error) {
    console.error('[swaps/accept] Error exchanging cards:', error);
    // Best-effort restoration — complex failure state
    return NextResponse.json({ error: 'Card exchange failed. Please contact support.' }, { status: 500 });
  }
}
