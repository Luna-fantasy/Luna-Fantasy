import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { listItemOwners, grantItemToUser } from '@/lib/admin/valecroft';
import { getGuildMemberName } from '@/lib/bank/discord-roles';

export const dynamic = 'force-dynamic';

interface Ctx { params: { key: string } }

export async function GET(_req: NextRequest, ctx: Ctx) {
    const auth = await requireMastermindApi();
    if (!auth.authorized) return auth.response;
    const adminId = auth.session.user?.discordId ?? '';
    const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    try {
        const owners = await listItemOwners(ctx.params.key);
        const enriched = await Promise.all(owners.map(async o => {
            const m = await getGuildMemberName(o.discord_id).catch(() => null);
            return { ...o, name: m?.name ?? null, avatar: m?.avatar ?? null };
        }));
        return NextResponse.json({ rows: enriched });
    } catch (err) {
        console.error('[item owners GET]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, ctx: Ctx) {
    const auth = await requireMastermindApi();
    if (!auth.authorized) return auth.response;
    if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

    const adminId = auth.session.user?.discordId ?? '';
    const adminName = auth.session.user?.globalName ?? 'Mastermind';
    const { allowed, retryAfterMs } = checkRateLimit('admin_grant', adminId, 30, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const discordId = String(body.discordId ?? '').trim();
    if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'discordId must be a Discord snowflake' }, { status: 400 });

    const result = await grantItemToUser(discordId, ctx.params.key);
    if (!result.ok) {
        return NextResponse.json({ error: result.reason === 'unknown_item' ? 'No item with that key.' : 'Grant failed' }, { status: 400 });
    }

    await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: 'valecroft_grant_item',
        before: null,
        after: { discordId, itemKey: ctx.params.key },
        metadata: { discordId, itemKey: ctx.params.key },
        ip: getClientIp(req),
    });
    return NextResponse.json({ ok: true });
}
