import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { updateListingPrice } from '@/lib/bazaar/marketplace-ops';

const MIN_PRICE = 50;
const MAX_PRICE = 500_000;

/**
 * PUT /api/marketplace/edit-price
 * Update the price of an active listing.
 */
export async function PUT(request: Request) {
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

  // 3. Input validation
  let body: { listingId: string; price: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { listingId, price } = body;
  if (!listingId || typeof listingId !== 'string') {
    return NextResponse.json({ error: 'Listing ID is required' }, { status: 400 });
  }
  if (!price || typeof price !== 'number' || !Number.isInteger(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return NextResponse.json(
      { error: `Price must be a whole number between ${MIN_PRICE} and ${MAX_PRICE}` },
      { status: 400 }
    );
  }

  // 4. Update price
  const updated = await updateListingPrice(listingId, discordId, price);
  if (!updated) {
    return NextResponse.json({ error: 'Listing not found or not active' }, { status: 404 });
  }

  const res = NextResponse.json({ listing: updated });
  return refreshCsrf(res);
}
