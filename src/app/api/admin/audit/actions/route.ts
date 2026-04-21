import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getDistinctAuditActions } from '@/lib/admin/audit';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const { session } = authResult;
  const discordId = session.user?.discordId ?? '';

  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  try {
    const actions = await getDistinctAuditActions();
    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Audit actions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
