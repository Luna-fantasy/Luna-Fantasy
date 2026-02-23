import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt } from '@/lib/bazaar/lunari-ops';
import { getUserCards, removeCardFromUser, userOwnsCard } from '@/lib/bazaar/card-ops';
import { createSwap, generateSwapId, getSwapExpiryDate } from '@/lib/bazaar/swap-ops';
import { createNotification, generateNotificationId } from '@/lib/bazaar/marketplace-ops';
import clientPromise from '@/lib/mongodb';

/**
 * POST /api/swaps/propose
 * Create a swap offer. Escrows requester's card.
 */
export async function POST(request: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;
  const requesterName = session.user.globalName || session.user.name || 'Unknown';

  // 2. CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // 3. Rate limit
  const rl = checkRateLimit(
    'swap_propose',
    discordId,
    RATE_LIMITS.swap_propose.maxRequests,
    RATE_LIMITS.swap_propose.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // 4. Debt check
  const hasDebt = await checkDebt(discordId);
  if (hasDebt) {
    return NextResponse.json({ error: 'Pay your debts first' }, { status: 403 });
  }

  // 5. Input validation
  let body: { targetId: string; requesterCardId: string; targetCardId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { targetId, requesterCardId, targetCardId } = body;
  if (!targetId || typeof targetId !== 'string') {
    return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
  }
  if (!requesterCardId || typeof requesterCardId !== 'string') {
    return NextResponse.json({ error: 'Your card ID is required' }, { status: 400 });
  }
  if (!targetCardId || typeof targetCardId !== 'string') {
    return NextResponse.json({ error: 'Target card ID is required' }, { status: 400 });
  }
  if (targetId === discordId) {
    return NextResponse.json({ error: 'Cannot swap with yourself' }, { status: 400 });
  }

  // 6. Verify requester's card exists
  const myCards = await getUserCards(discordId);
  const myCard = myCards.find((c) => c.id === requesterCardId);
  if (!myCard) {
    return NextResponse.json({ error: 'Card not found in your collection' }, { status: 400 });
  }

  // 7. Verify target's card exists
  const targetCards = await getUserCards(targetId);
  const targetCard = targetCards.find((c) => c.id === targetCardId);
  if (!targetCard) {
    return NextResponse.json({ error: 'Target card not found' }, { status: 400 });
  }

  // 8. Get target user name
  const client = await clientPromise;
  const db = client.db('Database');
  const targetUser = await db.collection('users').findOne({ discordId: targetId });
  const targetName = targetUser?.globalName || targetUser?.username || 'Unknown';

  // 9. Escrow: remove requester's card
  const removed = await removeCardFromUser(discordId, requesterCardId);
  if (!removed) {
    return NextResponse.json({ error: 'Failed to escrow card. Try again.' }, { status: 500 });
  }

  // 10. Create swap
  try {
    const swap = await createSwap({
      swapId: generateSwapId(discordId),
      requesterId: discordId,
      requesterName,
      targetId,
      targetName: targetName as string,
      requesterCard: {
        id: removed.id,
        name: removed.name,
        rarity: removed.rarity,
        attack: removed.attack,
        weight: removed.weight,
        imageUrl: removed.imageUrl,
        source: removed.source,
      },
      targetCard: {
        id: targetCard.id,
        name: targetCard.name,
        rarity: targetCard.rarity,
        attack: targetCard.attack,
        weight: targetCard.weight,
        imageUrl: targetCard.imageUrl,
        source: targetCard.source || 'Unknown',
      },
      status: 'pending',
      createdAt: new Date(),
      expiresAt: getSwapExpiryDate(),
      source: 'web',
    });

    // Notify target
    await createNotification({
      notificationId: generateNotificationId(targetId),
      userId: targetId,
      type: 'swap_received',
      data: {
        listingId: swap.swapId,
        cardName: removed.name,
        actorName: requesterName,
      },
      read: false,
      createdAt: new Date(),
    });

    const res = NextResponse.json({ swap });
    return refreshCsrf(res);
  } catch (error) {
    // Restore card on failure
    const { addCardToUser } = await import('@/lib/bazaar/card-ops');
    try {
      await addCardToUser(
        discordId,
        {
          name: removed.name,
          rarity: removed.rarity,
          attack: removed.attack,
          imageUrl: removed.imageUrl,
          weight: removed.weight,
        },
        removed.source
      );
    } catch (restoreErr) {
      console.error('[swaps/propose] Failed to restore card:', restoreErr);
    }
    console.error('[swaps/propose] Error creating swap:', error);
    return NextResponse.json({ error: 'Failed to create swap' }, { status: 500 });
  }
}
