import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { revokeOneItemFromUser } from '@/lib/admin/valecroft';

export const dynamic = 'force-dynamic';

interface Ctx { params: { key: string; discordId: string } }

// Removes ONE copy of this item from the user. Multiple copies are allowed
// per user, so this endpoint deliberately doesn't drain the whole stack —
// call it N times to remove N copies, or use a separate bulk endpoint.
export async function DELETE(req: NextRequest, ctx: Ctx) {
    const auth = await requireMastermindApi();
    if (!auth.authorized) return auth.response;
    if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

    const adminId = auth.session.user?.discordId ?? '';
    const adminName = auth.session.user?.globalName ?? 'Mastermind';
    const { allowed, retryAfterMs } = checkRateLimit('admin_grant', adminId, 30, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    if (!/^\d{17,20}$/.test(ctx.params.discordId)) {
        return NextResponse.json({ error: 'discordId must be a Discord snowflake' }, { status: 400 });
    }

    const result = await revokeOneItemFromUser(ctx.params.discordId, ctx.params.key);
    if (!result.ok) return NextResponse.json({ error: 'User does not own this item.' }, { status: 404 });

    await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: 'valecroft_revoke_item',
        before: null,
        after: { discordId: ctx.params.discordId, itemKey: ctx.params.key },
        metadata: { discordId: ctx.params.discordId, itemKey: ctx.params.key },
        ip: getClientIp(req),
    });
    return NextResponse.json({ ok: true });
}
