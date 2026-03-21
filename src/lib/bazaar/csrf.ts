import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'bazaar_csrf';

/**
 * Generate a new CSRF token and set it as a cookie.
 * Uses double-submit pattern: cookie is NOT httpOnly so the client
 * can read it and send it back as a header. The server validates
 * that the header matches the cookie.
 * sameSite: 'strict' prevents the cookie from being sent on cross-origin requests.
 */
export async function setCsrfCookie(response: NextResponse): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Client must read this to send as header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 86400, // 24 hours
  });
  return token;
}

/**
 * Refresh CSRF token on a response — call after successful purchases
 * so long-lived bazaar pages don't hit token expiry.
 */
export async function refreshCsrf(response: NextResponse): Promise<NextResponse> {
  await setCsrfCookie(response);
  return response;
}

/**
 * Validate CSRF token from request header against cookie.
 * Returns true if valid.
 */
export async function validateCsrf(request: Request): Promise<boolean> {
  const headerToken = request.headers.get('x-csrf-token');
  if (!headerToken) return false;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken) return false;

  // Constant-time comparison — pad to fixed length to avoid leaking token length
  const a = Buffer.from(headerToken.padEnd(64, '\0'));
  const b = Buffer.from(cookieToken.padEnd(64, '\0'));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
