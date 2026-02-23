import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt } from '@/lib/bazaar/lunari-ops';
import { getUserCards, removeCardFromUser } from '@/lib/bazaar/card-ops';
import {
  createListing,
  generateListingId,
  getExpiryDate,
} from '@/lib/bazaar/marketplace-ops';

const MIN_PRICE = 50;
const MAX_PRICE = 500_000;

/**
 * POST /api/marketplace/list
 * Create a new marketplace listing. Escrows the card (removes from seller's collection).
 */
export async function POST(request: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;
  const sellerName = session.user.globalName || session.user.name || 'Unknown';

  // 2. CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // 3. Rate limit
  const rl = checkRateLimit(
    'marketplace_list',
    discordId,
    RATE_LIMITS.marketplace_list.maxRequests,
    RATE_LIMITS.marketplace_list.windowMs
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
  let body: { cardId: string; price: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { cardId, price } = body;
  if (!cardId || typeof cardId !== 'string') {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }
  if (!price || typeof price !== 'number' || !Number.isInteger(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return NextResponse.json(
      { error: `Price must be a whole number between ${MIN_PRICE} and ${MAX_PRICE}` },
      { status: 400 }
    );
  }

  // 6. Verify card exists in user's collection
  const userCards = await getUserCards(discordId);
  const cardToList = userCards.find((c) => c.id === cardId);
  if (!cardToList) {
    return NextResponse.json({ error: 'Card not found in your collection' }, { status: 400 });
  }

  // 7. Escrow: remove card from user's collection
  const removed = await removeCardFromUser(discordId, cardId);
  if (!removed) {
    return NextResponse.json({ error: 'Failed to escrow card. Try again.' }, { status: 500 });
  }

  // 8. Create listing
  try {
    const now = new Date();
    const listing = await createListing({
      listingId: generateListingId(discordId),
      type: 'fixed_price',
      sellerId: discordId,
      sellerName,
      card: {
        id: removed.id,
        name: removed.name,
        rarity: removed.rarity,
        attack: removed.attack,
        weight: removed.weight,
        imageUrl: removed.imageUrl,
        source: removed.source,
      },
      price,
      status: 'active',
      createdAt: now,
      expiresAt: getExpiryDate(),
      updatedAt: now,
      cardReturned: false,
      source: 'web',
    });

    const res = NextResponse.json({ listing });
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
      console.error('[marketplace/list] Failed to restore card after listing error:', restoreErr);
    }
    console.error('[marketplace/list] Error creating listing:', error);
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }
}
