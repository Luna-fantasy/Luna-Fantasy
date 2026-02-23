import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt } from '@/lib/bazaar/lunari-ops';
import { getUserCards, removeCardFromUser } from '@/lib/bazaar/card-ops';
import {
  createListing,
  generateAuctionId,
  getAuctionExpiryDate,
  getMinBidIncrement,
} from '@/lib/bazaar/marketplace-ops';

const MIN_STARTING_PRICE = 50;
const MAX_STARTING_PRICE = 500_000;
const VALID_DURATIONS = [24, 48, 72] as const;

/**
 * POST /api/marketplace/auction/create
 * Create an auction listing. Escrows the card.
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
    'auction_create',
    discordId,
    RATE_LIMITS.auction_create.maxRequests,
    RATE_LIMITS.auction_create.windowMs
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
  let body: { cardId: string; startingPrice: number; duration: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { cardId, startingPrice, duration } = body;
  if (!cardId || typeof cardId !== 'string') {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }
  if (
    !startingPrice ||
    typeof startingPrice !== 'number' ||
    !Number.isInteger(startingPrice) ||
    startingPrice < MIN_STARTING_PRICE ||
    startingPrice > MAX_STARTING_PRICE
  ) {
    return NextResponse.json(
      { error: `Starting price must be between ${MIN_STARTING_PRICE} and ${MAX_STARTING_PRICE}` },
      { status: 400 }
    );
  }
  if (!VALID_DURATIONS.includes(duration as any)) {
    return NextResponse.json({ error: 'Duration must be 24, 48, or 72 hours' }, { status: 400 });
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

  // 8. Create auction listing
  try {
    const now = new Date();
    const validDuration = duration as 24 | 48 | 72;
    const listing = await createListing({
      listingId: generateAuctionId(discordId),
      type: 'auction',
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
      price: startingPrice,
      status: 'active',
      createdAt: now,
      expiresAt: getAuctionExpiryDate(validDuration),
      updatedAt: now,
      cardReturned: false,
      source: 'web',
      auctionConfig: {
        startingPrice,
        minBidIncrement: getMinBidIncrement(startingPrice),
        duration: validDuration,
      },
      currentBid: 0,
      currentBidderId: undefined,
      currentBidderName: undefined,
      bidCount: 0,
      bids: [],
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
      console.error('[auction/create] Failed to restore card after error:', restoreErr);
    }
    console.error('[auction/create] Error creating auction:', error);
    return NextResponse.json({ error: 'Failed to create auction' }, { status: 500 });
  }
}
