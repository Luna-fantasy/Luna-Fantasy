import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { getAuditLog } from '@/lib/admin/audit';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const { session } = authResult;
  const discordId = session.user?.discordId ?? '';

  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs);
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const action = searchParams.get('action') ?? undefined;
  const actionsRaw = searchParams.get('actions');
  const actions = actionsRaw ? actionsRaw.split(',').filter(Boolean).slice(0, 64) : undefined;
  const adminDiscordId = searchParams.get('adminDiscordId') ?? undefined;
  const targetDiscordId = searchParams.get('targetDiscordId') ?? undefined;
  const q = searchParams.get('q') ?? undefined;

  const parseDate = (v: string | null): Date | undefined => {
    if (!v) return undefined;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const parseNum = (v: string | null): number | undefined => {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const dateFrom = parseDate(searchParams.get('dateFrom'));
  const dateTo = parseDate(searchParams.get('dateTo'));
  const amountMin = parseNum(searchParams.get('amountMin'));
  const amountMax = parseNum(searchParams.get('amountMax'));

  try {
    const result = await getAuditLog({
      page, limit, action, actions, adminDiscordId, targetDiscordId,
      q, dateFrom, dateTo, amountMin, amountMax,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin audit log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
