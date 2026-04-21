import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { listOwnership } from '@/lib/admin/vaelcroft';

export const dynamic = 'force-dynamic';

const VALID_STATES = ['owned', 'damaged', 'foreclosed'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const sp = req.nextUrl.searchParams;
    const stateRaw = sp.get('state');
    const state = VALID_STATES.includes(stateRaw as any) ? (stateRaw as typeof VALID_STATES[number]) : undefined;
    const discordId = (sp.get('discordId') ?? '').trim().replace(/[^0-9]/g, '').slice(0, 20) || undefined;
    const limit = Math.min(200, Math.max(10, parseInt(sp.get('limit') ?? '100', 10)));
    const rows = await listOwnership({ state, discordId, limit });
    return NextResponse.json({ rows, total: rows.length });
  } catch (err) {
    console.error('Vaelcroft ownership list error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
