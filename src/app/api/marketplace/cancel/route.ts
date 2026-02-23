import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { cancelListing } from '@/lib/bazaar/marketplace-ops';
import { addCardToUser } from '@/lib/bazaar/card-ops';

/**
 * POST /api/marketplace/cancel
 * Cancel own listing and return card to seller.
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
    'marketplace_cancel',
    discordId,
    RATE_LIMITS.marketplace_cancel.maxRequests,
    RATE_LIMITS.marketplace_cancel.windowMs
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

  // 5. Cancel listing (only if owned by user and active)
  const cancelled = await cancelListing(listingId, discordId);
  if (!cancelled) {
    return NextResponse.json({ error: 'Listing not found or already cancelled' }, { status: 404 });
  }

  // 6. Return card to seller
  try {
    await addCardToUser(
      discordId,
      {
        name: cancelled.card.name,
        rarity: cancelled.card.rarity,
        attack: cancelled.card.attack,
        imageUrl: cancelled.card.imageUrl,
        weight: cancelled.card.weight,
      },
      cancelled.card.source || 'Marketplace Return'
    );

    // Mark card as returned
    const { default: clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    const db = client.db('Database');
    await db.collection('card_marketplace').updateOne(
      { listingId },
      { $set: { cardReturned: true } }
    );

    const res = NextResponse.json({ success: true });
    return refreshCsrf(res);
  } catch (error) {
    console.error('[marketplace/cancel] Error returning card:', error);
    return NextResponse.json({ error: 'Listing cancelled but failed to return card. Contact support.' }, { status: 500 });
  }
}
