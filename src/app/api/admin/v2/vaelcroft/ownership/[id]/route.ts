import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { adminForceForeclose } from '@/lib/admin/vaelcroft';

export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

// DELETE /ownership/:discordId — admin force-foreclose
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 15, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const discordId = (ctx.params.id ?? '').replace(/[^0-9]/g, '').slice(0, 20);
  if (!discordId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const result = await adminForceForeclose(discordId, adminId);
    if (!result.forecloseddKey) {
      return NextResponse.json({ error: 'User does not own a property' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Vaelcroft force-foreclose error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
