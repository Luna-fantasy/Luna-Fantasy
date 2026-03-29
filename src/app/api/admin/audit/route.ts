import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getAuditLog } from '@/lib/admin/audit';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const { session } = authResult;
  const discordId = session.user?.discordId ?? '';

  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limited', retryAfterMs },
      { status: 429 }
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const action = searchParams.get('action') ?? undefined;
  const adminDiscordId = searchParams.get('adminDiscordId') ?? undefined;
  const targetDiscordId = searchParams.get('targetDiscordId') ?? undefined;

  try {
    const result = await getAuditLog({ page, limit, action, adminDiscordId, targetDiscordId });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin audit log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
