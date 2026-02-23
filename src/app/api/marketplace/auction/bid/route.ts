import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt, getBalance } from '@/lib/bazaar/lunari-ops';
import {
  getListingById,
  placeBid,
  getMinBidIncrement,
  createNotification,
  generateNotificationId,
} from '@/lib/bazaar/marketplace-ops';

/**
 * POST /api/marketplace/auction/bid
 * Place a bid on an auction. No Lunari hold at bid time — balance verified but only deducted on resolution.
 */
export async function POST(request: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;
  const bidderName = session.user.globalName || session.user.name || 'Unknown';

  // 2. CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // 3. Rate limit
  const rl = checkRateLimit(
    'auction_bid',
    discordId,
    RATE_LIMITS.auction_bid.maxRequests,
    RATE_LIMITS.auction_bid.windowMs
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
  let body: { listingId: string; bidAmount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { listingId, bidAmount } = body;
  if (!listingId || typeof listingId !== 'string') {
    return NextResponse.json({ error: 'Listing ID is required' }, { status: 400 });
  }
  if (!bidAmount || typeof bidAmount !== 'number' || !Number.isInteger(bidAmount) || bidAmount < 50) {
    return NextResponse.json({ error: 'Invalid bid amount' }, { status: 400 });
  }

  // 6. Get auction details
  const listing = await getListingById(listingId);
  if (!listing || listing.status !== 'active' || listing.type !== 'auction') {
    return NextResponse.json({ error: 'Auction not available' }, { status: 404 });
  }

  // Cannot bid on own auction
  if (listing.sellerId === discordId) {
    return NextResponse.json({ error: 'Cannot bid on your own auction' }, { status: 400 });
  }

  // Check auction hasn't expired
  if (new Date() > new Date(listing.expiresAt)) {
    return NextResponse.json({ error: 'Auction has ended' }, { status: 400 });
  }

  // 7. Validate bid amount
  const currentBid = listing.currentBid || 0;
  const startingPrice = listing.auctionConfig?.startingPrice || 0;

  if (currentBid === 0) {
    // First bid must be at least the starting price
    if (bidAmount < startingPrice) {
      return NextResponse.json(
        { error: `Bid must be at least ${startingPrice} Lunari` },
        { status: 400 }
      );
    }
  } else {
    // Subsequent bids must exceed current bid + increment
    const minIncrement = getMinBidIncrement(currentBid);
    const minBid = currentBid + minIncrement;
    if (bidAmount < minBid) {
      return NextResponse.json(
        { error: `Bid must be at least ${minBid} Lunari (current: ${currentBid} + ${minIncrement} increment)` },
        { status: 400 }
      );
    }
  }

  // 8. Balance check (verified but not deducted)
  const balance = await getBalance(discordId);
  if (balance < bidAmount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  // 9. Place bid atomically
  const previousListing = await placeBid(listingId, discordId, bidderName, bidAmount, currentBid);
  if (!previousListing) {
    return NextResponse.json(
      { error: 'Someone placed a higher bid. Refresh and try again.' },
      { status: 409 }
    );
  }

  // 10. Notify the previous bidder they were outbid
  if (previousListing.currentBidderId && previousListing.currentBidderId !== discordId) {
    try {
      await createNotification({
        notificationId: generateNotificationId(previousListing.currentBidderId),
        userId: previousListing.currentBidderId,
        type: 'outbid',
        data: {
          listingId,
          cardName: listing.card.name,
          amount: bidAmount,
          actorName: bidderName,
        },
        read: false,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error('[auction/bid] Failed to create outbid notification:', err);
    }
  }

  const res = NextResponse.json({
    success: true,
    currentBid: bidAmount,
    bidCount: (previousListing.bidCount || 0) + 1,
  });
  return refreshCsrf(res);
}
