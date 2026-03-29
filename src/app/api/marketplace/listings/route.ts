import { NextResponse } from 'next/server';
import { getActiveListings } from '@/lib/bazaar/marketplace-ops';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import type { ListingFilters } from '@/types/marketplace';

/**
 * GET /api/marketplace/listings
 * Browse active marketplace listings. No auth required.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit('marketplace_browse', ip, RATE_LIMITS.marketplace_browse.maxRequests, RATE_LIMITS.marketplace_browse.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const url = new URL(request.url);
    const VALID_TYPES = ['fixed_price', 'auction'] as const;
    const VALID_SORTS = ['price_asc', 'price_desc', 'newest', 'oldest', 'ending_soon', 'most_bids'] as const;
    const rawType = url.searchParams.get('type');
    const rawSort = url.searchParams.get('sort');
    const filters: ListingFilters = {
      rarity: url.searchParams.get('rarity') || undefined,
      game: url.searchParams.get('game') || undefined,
      search: url.searchParams.get('search') || undefined,
      type: rawType && (VALID_TYPES as readonly string[]).includes(rawType) ? rawType as ListingFilters['type'] : undefined,
      sort: rawSort && (VALID_SORTS as readonly string[]).includes(rawSort) ? rawSort as ListingFilters['sort'] : 'newest',
      page: Math.max(1, parseInt(url.searchParams.get('page') || '1', 10)),
      limit: Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10))),
    };

    const result = await getActiveListings(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[marketplace/listings] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
