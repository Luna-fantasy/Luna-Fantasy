import { NextResponse } from 'next/server';
import { getActiveListings } from '@/lib/bazaar/marketplace-ops';
import type { ListingFilters } from '@/types/marketplace';

/**
 * GET /api/marketplace/listings
 * Browse active marketplace listings. No auth required.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters: ListingFilters = {
      rarity: url.searchParams.get('rarity') || undefined,
      game: url.searchParams.get('game') || undefined,
      search: url.searchParams.get('search') || undefined,
      type: (url.searchParams.get('type') as ListingFilters['type']) || undefined,
      sort: (url.searchParams.get('sort') as ListingFilters['sort']) || 'newest',
      page: parseInt(url.searchParams.get('page') || '1', 10),
      limit: parseInt(url.searchParams.get('limit') || '20', 10),
    };

    const result = await getActiveListings(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[marketplace/listings] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
