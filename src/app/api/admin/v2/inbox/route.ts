import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';
import { getInbox, type InboxFilters, type InboxKind, type InboxStatus } from '@/lib/admin/inbox';

export const dynamic = 'force-dynamic';

function parseKind(v: string | null): InboxFilters['kind'] {
  return v === 'ticket' || v === 'application' ? v : 'all';
}

function parseStatus(v: string | null): InboxFilters['status'] {
  const allowed: InboxStatus[] = ['open', 'closed', 'pending', 'accepted', 'rejected'];
  return v && (allowed as string[]).includes(v) ? (v as InboxStatus) : 'all';
}

function parseInt(v: string | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const sp = req.nextUrl.searchParams;
  const filters: InboxFilters = {
    q: (sp.get('q') ?? '').slice(0, 200),
    kind: parseKind(sp.get('kind')),
    status: parseStatus(sp.get('status')),
    categoryId: (sp.get('categoryId') ?? '').slice(0, 80).replace(/[^a-zA-Z0-9_-]/g, ''),
    userId: (sp.get('userId') ?? '').replace(/[^\d]/g, '').slice(0, 20),
    dateFrom: sp.get('dateFrom') ?? '',
    dateTo: sp.get('dateTo') ?? '',
    limit: Math.min(200, parseInt(sp.get('limit'), 50)),
    offset: parseInt(sp.get('offset'), 0),
  };

  try {
    const result = await getInbox(filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/v2/inbox] GET error:', err);
    return NextResponse.json({ error: 'Internal error', detail: sanitizeErrorMessage((err as Error).message) }, { status: 500 });
  }
}
