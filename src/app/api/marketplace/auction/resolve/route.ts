import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import {
  getListingById,
  resolveAuction,
  createNotification,
  generateNotificationId,
} from '@/lib/bazaar/marketplace-ops';
import { deductLunari, creditLunari, getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
import { addCardToUser, userOwnsCard } from '@/lib/bazaar/card-ops';

/**
 * POST /api/marketplace/auction/resolve
 * Seller accepts highest bid early, or resolves an auction manually.
 */
export async function POST(request: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;

  // 2. CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // 3. Rate limit
  const rl = checkRateLimit(
    'auction_resolve',
    discordId,
    RATE_LIMITS.auction_resolve.maxRequests,
    RATE_LIMITS.auction_resolve.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // 4. Input validation
  let body: { listingId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { listingId } = body;
  if (!listingId || typeof listingId !== 'string') {
    return NextResponse.json({ error: 'Listing ID is required' }, { status: 400 });
  }

  // 5. Verify auction exists and belongs to seller
  const listing = await getListingById(listingId);
  if (!listing || listing.type !== 'auction' || listing.status !== 'active') {
    return NextResponse.json({ error: 'Auction not found or not active' }, { status: 404 });
  }
  if (listing.sellerId !== discordId) {
    return NextResponse.json({ error: 'Not your auction' }, { status: 403 });
  }
  if (!listing.currentBidderId || !listing.bidCount || listing.bidCount === 0) {
    return NextResponse.json({ error: 'No bids to accept' }, { status: 400 });
  }

  // 6. Process the resolution
  return processAuctionResolution(listing);
}

/**
 * Shared resolution logic — used by both manual resolve and auto-resolve.
 */
export async function processAuctionResolution(
  listing: NonNullable<Awaited<ReturnType<typeof getListingById>>>
): Promise<NextResponse> {
  const winnerId = listing.currentBidderId!;
  const winnerName = listing.currentBidderName || 'Unknown';
  const winningBid = listing.currentBid || 0;

  // Check if winner can afford the bid
  const winnerBalance = await getBalance(winnerId);
  if (winnerBalance < winningBid) {
    // Winner can't afford — try fallback to next bidder
    return handleFallbackBidder(listing);
  }

  // Check duplicate ownership
  const alreadyOwns = await userOwnsCard(winnerId, listing.card.name);
  if (alreadyOwns) {
    return handleFallbackBidder(listing);
  }

  // Resolve the auction
  const resolved = await resolveAuction(listing.listingId);
  if (!resolved) {
    return NextResponse.json({ error: 'Failed to resolve auction' }, { status: 500 });
  }

  // Deduct winner Lunari
  const deduction = await deductLunari(winnerId, winningBid);
  if (!deduction.success) {
    // Revert auction status — complex, log and manual fix
    console.error(`[auction/resolve] Deduction failed for auction ${listing.listingId}`);
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
  }

  // Credit seller + transfer card + log transactions
  try {
    await creditLunari(listing.sellerId, winningBid);

    await addCardToUser(
      winnerId,
      {
        name: listing.card.name,
        rarity: listing.card.rarity,
        attack: listing.card.attack,
        imageUrl: listing.card.imageUrl,
        weight: listing.card.weight,
      },
      'Auction Win'
    );

    // Log winner transaction
    await logTransaction({
      discordId: winnerId,
      type: 'marketplace_buy',
      amount: -winningBid,
      balanceAfter: deduction.balanceAfter,
      source: 'web',
      metadata: {
        listingId: listing.listingId,
        cardName: listing.card.name,
        cardRarity: listing.card.rarity,
        sellerId: listing.sellerId,
        type: 'auction',
      },
      createdAt: new Date(),
    });

    // Log seller transaction
    await logTransaction({
      discordId: listing.sellerId,
      type: 'marketplace_sell',
      amount: winningBid,
      balanceAfter: 0,
      source: 'web',
      metadata: {
        listingId: listing.listingId,
        cardName: listing.card.name,
        cardRarity: listing.card.rarity,
        buyerId: winnerId,
        type: 'auction',
      },
      createdAt: new Date(),
    });

    // Notify winner
    await createNotification({
      notificationId: generateNotificationId(winnerId),
      userId: winnerId,
      type: 'auction_won',
      data: {
        listingId: listing.listingId,
        cardName: listing.card.name,
        amount: winningBid,
      },
      read: false,
      createdAt: new Date(),
    });

    // Notify seller
    await createNotification({
      notificationId: generateNotificationId(listing.sellerId),
      userId: listing.sellerId,
      type: 'card_sold',
      data: {
        listingId: listing.listingId,
        cardName: listing.card.name,
        amount: winningBid,
        actorName: winnerName,
      },
      read: false,
      createdAt: new Date(),
    });

    const res = NextResponse.json({
      success: true,
      winnerId,
      winnerName,
      winningBid,
    });
    return refreshCsrf(res);
  } catch (error) {
    console.error('[auction/resolve] Error after deduction:', error);
    try {
      await creditLunari(winnerId, winningBid);
    } catch (refundErr) {
      console.error('[auction/resolve] Refund failed:', refundErr);
    }
    return NextResponse.json({ error: 'Resolution failed. Lunari has been refunded.' }, { status: 500 });
  }
}

/**
 * Handle fallback to next eligible bidder when winner can't pay or already owns the card.
 */
async function handleFallbackBidder(
  listing: NonNullable<Awaited<ReturnType<typeof getListingById>>>
): Promise<NextResponse> {
  // Get bids sorted descending by amount, skip the current highest
  const bids = (listing.bids || []).sort((a, b) => b.amount - a.amount);

  for (const bid of bids) {
    if (bid.bidderId === listing.currentBidderId) continue;

    const balance = await getBalance(bid.bidderId);
    if (balance < bid.amount) continue;

    const alreadyOwns = await userOwnsCard(bid.bidderId, listing.card.name);
    if (alreadyOwns) continue;

    // Use this bidder as winner — update listing and re-resolve
    const { default: clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    const db = client.db('Database');
    await db.collection('card_marketplace').updateOne(
      { listingId: listing.listingId, status: 'active' },
      {
        $set: {
          currentBid: bid.amount,
          currentBidderId: bid.bidderId,
          currentBidderName: bid.bidderName,
          updatedAt: new Date(),
        },
      }
    );

    // Re-fetch and resolve with updated bidder
    const { getListingById: refreshListing } = await import('@/lib/bazaar/marketplace-ops');
    const updated = await refreshListing(listing.listingId);
    if (updated && updated.status === 'active') {
      return processAuctionResolution(updated);
    }
  }

  // No eligible bidders — cancel auction and return card
  const { addCardToUser: restoreCard } = await import('@/lib/bazaar/card-ops');
  const { default: cp } = await import('@/lib/mongodb');
  const client2 = await cp;
  const db2 = client2.db('Database');

  await db2.collection('card_marketplace').updateOne(
    { listingId: listing.listingId, status: 'active' },
    {
      $set: {
        status: 'expired',
        updatedAt: new Date(),
      },
    }
  );

  try {
    await restoreCard(
      listing.sellerId,
      {
        name: listing.card.name,
        rarity: listing.card.rarity,
        attack: listing.card.attack,
        imageUrl: listing.card.imageUrl,
        weight: listing.card.weight,
      },
      listing.card.source || 'Auction Expired'
    );

    await db2.collection('card_marketplace').updateOne(
      { listingId: listing.listingId },
      { $set: { cardReturned: true } }
    );
  } catch (err) {
    console.error(`[auction/resolve] Failed to return card for ${listing.listingId}:`, err);
  }

  // Notify seller
  await createNotification({
    notificationId: generateNotificationId(listing.sellerId),
    userId: listing.sellerId,
    type: 'auction_expired',
    data: {
      listingId: listing.listingId,
      cardName: listing.card.name,
    },
    read: false,
    createdAt: new Date(),
  });

  return NextResponse.json({
    success: true,
    resolved: false,
    message: 'No eligible bidders. Card returned to seller.',
  });
}
