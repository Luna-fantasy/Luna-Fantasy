import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import { listPassports } from '@/lib/admin/passports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') ?? '').trim().slice(0, 80);
  const faction = (sp.get('faction') ?? '').trim().toLowerCase();
  const staffOnly = sp.get('staffOnly') === '1';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(72, Math.max(12, parseInt(sp.get('limit') ?? '36', 10)));

  try {
    const { rows, total } = await listPassports({
      q: q || undefined,
      faction: faction || undefined,
      staffOnly,
      limit,
      skip: (page - 1) * limit,
    });
    return NextResponse.json({ rows, total, page, limit });
  } catch (err) {
    console.error('Passports v2 list error:', err);
    return NextResponse.json({ error: 'Internal error', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
