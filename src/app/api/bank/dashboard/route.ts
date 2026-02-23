import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBankDashboardData } from '@/lib/bank/bank-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { setCsrfCookie } from '@/lib/bazaar/csrf';

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  const rl = checkRateLimit('bank_dashboard', discordId, RATE_LIMITS.bank_dashboard.maxRequests, RATE_LIMITS.bank_dashboard.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const data = await getBankDashboardData(discordId);
    const response = NextResponse.json(data);
    await setCsrfCookie(response);
    return response;
  } catch (err) {
    console.error('[bank/dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
