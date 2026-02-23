import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt } from '@/lib/bazaar/lunari-ops';
import { getUserCards, removeCardFromUser, addCardToUser } from '@/lib/bazaar/card-ops';
import { counterSwap, getSwapById, createSwap, generateSwapId, getSwapExpiryDate } from '@/lib/bazaar/swap-ops';
import { createNotification, generateNotificationId } from '@/lib/bazaar/marketplace-ops';

/**
 * POST /api/swaps/counter
 * Counter-offer: decline original swap (return requester's card), create reverse swap.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;
  const userName = session.user.globalName || session.user.name || 'Unknown';

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const rl = checkRateLimit('swap_propose', discordId, RATE_LIMITS.swap_propose.maxRequests, RATE_LIMITS.swap_propose.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const hasDebt = await checkDebt(discordId);
  if (hasDebt) {
    return NextResponse.json({ error: 'Pay your debts first' }, { status: 403 });
  }

  let body: { swapId: string; myCardId: string; theirCardId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { swapId, myCardId, theirCardId } = body;
  if (!swapId || !myCardId || !theirCardId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify original swap
  const originalSwap = await getSwapById(swapId);
  if (!originalSwap || originalSwap.status !== 'pending') {
    return NextResponse.json({ error: 'Swap not found or not pending' }, { status: 404 });
  }
  if (originalSwap.targetId !== discordId) {
    return NextResponse.json({ error: 'Not your swap to counter' }, { status: 403 });
  }

  // Verify my card
  const myCards = await getUserCards(discordId);
  const myCard = myCards.find((c) => c.id === myCardId);
  if (!myCard) {
    return NextResponse.json({ error: 'Your card not found' }, { status: 400 });
  }

  // Verify their card
  const theirCards = await getUserCards(originalSwap.requesterId);
  const theirCard = theirCards.find((c) => c.id === theirCardId);
  if (!theirCard) {
    return NextResponse.json({ error: 'Their card not found' }, { status: 400 });
  }

  // Escrow my card
  const removed = await removeCardFromUser(discordId, myCardId);
  if (!removed) {
    return NextResponse.json({ error: 'Failed to escrow card' }, { status: 500 });
  }

  // Create counter swap
  const counterSwapId = generateSwapId(discordId);

  try {
    // Mark original as countered and return requester's card
    const countered = await counterSwap(swapId, discordId, counterSwapId);
    if (!countered) {
      // Restore my card
      await addCardToUser(discordId, {
        name: removed.name, rarity: removed.rarity,
        attack: removed.attack, imageUrl: removed.imageUrl, weight: removed.weight,
      }, removed.source);
      return NextResponse.json({ error: 'Original swap already resolved' }, { status: 409 });
    }

    // Return original requester's card
    await addCardToUser(countered.requesterId, {
      name: countered.requesterCard.name, rarity: countered.requesterCard.rarity,
      attack: countered.requesterCard.attack, imageUrl: countered.requesterCard.imageUrl,
      weight: countered.requesterCard.weight,
    }, countered.requesterCard.source || 'Swap Countered');

    // Create the new counter-swap
    const newSwap = await createSwap({
      swapId: counterSwapId,
      requesterId: discordId,
      requesterName: userName,
      targetId: originalSwap.requesterId,
      targetName: originalSwap.requesterName,
      requesterCard: {
        id: removed.id, name: removed.name, rarity: removed.rarity,
        attack: removed.attack, weight: removed.weight,
        imageUrl: removed.imageUrl, source: removed.source,
      },
      targetCard: {
        id: theirCard.id, name: theirCard.name, rarity: theirCard.rarity,
        attack: theirCard.attack, weight: theirCard.weight,
        imageUrl: theirCard.imageUrl, source: theirCard.source || 'Unknown',
      },
      status: 'pending',
      counterSwapId: swapId,
      createdAt: new Date(),
      expiresAt: getSwapExpiryDate(),
      source: 'web',
    });

    // Notify original requester
    await createNotification({
      notificationId: generateNotificationId(originalSwap.requesterId),
      userId: originalSwap.requesterId,
      type: 'swap_received',
      data: {
        listingId: newSwap.swapId,
        cardName: removed.name,
        actorName: userName,
      },
      read: false,
      createdAt: new Date(),
    });

    const res = NextResponse.json({ swap: newSwap });
    return refreshCsrf(res);
  } catch (error) {
    // Restore card
    try {
      await addCardToUser(discordId, {
        name: removed.name, rarity: removed.rarity,
        attack: removed.attack, imageUrl: removed.imageUrl, weight: removed.weight,
      }, removed.source);
    } catch {}
    console.error('[swaps/counter] Error:', error);
    return NextResponse.json({ error: 'Failed to create counter-offer' }, { status: 500 });
  }
}
