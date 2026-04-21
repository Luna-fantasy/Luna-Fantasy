import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { searchUsers } from '@/lib/admin/db';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  // Dedicated bucket — user search is an expensive regex scan across two
  // collections, so it gets a tighter budget (10/min) than other admin reads
  // which share the generic `admin_read` key at 30/min.
  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_user_search', discordId, 10, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const results = await searchUsers(q);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
