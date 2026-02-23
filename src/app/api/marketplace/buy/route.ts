import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt, deductLunari, creditLunari, getBalance, logTransaction, getDailySpending, DAILY_SPEND_LIMIT } from '@/lib/bazaar/lunari-ops';
import { addCardToUser, userOwnsCard } from '@/lib/bazaar/card-ops';
import { claimListing, revertClaim, getListingById } from '@/lib/bazaar/marketplace-ops';

/**
 * POST /api/marketplace/buy
 * Buy a marketplace listing. Atomic claim via findOneAndUpdate.
 */
export async function POST(request: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const discordId = session.user.discordId;
  const buyerName = session.user.globalName || session.user.name || 'Unknown';

  // 2. CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // 3. Rate limit
  const rl = checkRateLimit(
    'marketplace_buy',
    discordId,
    RATE_LIMITS.marketplace_buy.maxRequests,
    RATE_LIMITS.marketplace_buy.windowMs
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

  // 6. Get listing details
  const listing = await getListingById(listingId);
  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: 'Listing not available' }, { status: 404 });
  }

  // Cannot buy own listing
  if (listing.sellerId === discordId) {
    return NextResponse.json({ error: 'Cannot buy your own listing' }, { status: 400 });
  }

  // 7. Duplicate check — block if buyer already owns this card name
  const alreadyOwns = await userOwnsCard(discordId, listing.card.name);
  if (alreadyOwns) {
    return NextResponse.json({ error: 'You already own this card' }, { status: 400 });
  }

  // 8. Balance check
  const balance = await getBalance(discordId);
  if (balance < listing.price) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  // 9. Daily spending check
  const dailySpent = await getDailySpending(discordId);
  if (dailySpent + listing.price > DAILY_SPEND_LIMIT) {
    return NextResponse.json({ error: 'Daily spending limit reached' }, { status: 429 });
  }

  // 10. Atomic claim — only one buyer succeeds
  const claimed = await claimListing(listingId, discordId, buyerName);
  if (!claimed) {
    return NextResponse.json({ error: 'Listing already sold' }, { status: 409 });
  }

  // 11. Deduct buyer Lunari
  const deduction = await deductLunari(discordId, listing.price);
  if (!deduction.success) {
    // Revert claim
    await revertClaim(listingId);
    return NextResponse.json({ error: 'Failed to deduct Lunari' }, { status: 400 });
  }

  // 12. Credit seller + Add card to buyer + Log transactions
  try {
    await creditLunari(listing.sellerId, listing.price);

    await addCardToUser(
      discordId,
      {
        name: listing.card.name,
        rarity: listing.card.rarity,
        attack: listing.card.attack,
        imageUrl: listing.card.imageUrl,
        weight: listing.card.weight,
      },
      'Marketplace Purchase'
    );

    // Log buyer transaction
    await logTransaction({
      discordId,
      type: 'marketplace_buy',
      amount: -listing.price,
      balanceBefore: deduction.balanceBefore,
      balanceAfter: deduction.balanceAfter,
      source: 'web',
      metadata: {
        listingId,
        cardName: listing.card.name,
        cardRarity: listing.card.rarity,
        sellerId: listing.sellerId,
      },
      createdAt: new Date(),
    });

    // Log seller transaction
    await logTransaction({
      discordId: listing.sellerId,
      type: 'marketplace_sell',
      amount: listing.price,
      balanceBefore: 0,
      balanceAfter: 0, // Unknown from here
      source: 'web',
      metadata: {
        listingId,
        cardName: listing.card.name,
        cardRarity: listing.card.rarity,
        buyerId: discordId,
      },
      createdAt: new Date(),
    });

    const res = NextResponse.json({
      success: true,
      card: listing.card,
      newBalance: deduction.balanceAfter,
    });
    return refreshCsrf(res);
  } catch (error) {
    // Revert: refund buyer, revert listing
    console.error('[marketplace/buy] Error after claim:', error);
    try {
      await creditLunari(discordId, listing.price);
      await revertClaim(listingId);
    } catch (revertErr) {
      console.error('[marketplace/buy] Revert failed:', revertErr);
    }
    return NextResponse.json({ error: 'Purchase failed. Your Lunari has been refunded.' }, { status: 500 });
  }
}
