import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireMastermindApi } from '@/lib/admin/auth';
import { setCsrfCookie } from '@/lib/bazaar/csrf';

const CSRF_COOKIE_NAME = 'bazaar_csrf';

// Ensures an admin has a valid CSRF cookie. If one already exists, returns it.
// If missing, sets a fresh token on the response.
// Called by admin pages on mount before making mutation requests.
export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  // If a valid-looking token already exists, don't rotate it — rotation
  // mid-flow causes race conditions when multiple requests use the old
  // header value against the new cookie.
  if (existing && existing.length === 64) {
    return NextResponse.json({ token: existing });
  }

  const response = NextResponse.json({ token: '' });
  const token = await setCsrfCookie(response);
  return NextResponse.json({ token }, { headers: response.headers });
}
