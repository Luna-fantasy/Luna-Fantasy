import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import {
    getSiteTabs,
    setTabState,
    TAB_KEYS,
    TAB_PATHS,
    type TabKey,
} from '@/lib/admin/site-tabs';

export async function GET() {
    const authResult = await requireMastermindApi();
    if (!authResult.authorized) return authResult.response;
    const tabs = await getSiteTabs();
    return NextResponse.json({ tabs });
}

export async function PATCH(request: NextRequest) {
    const authResult = await requireMastermindApi();
    if (!authResult.authorized) return authResult.response;

    const csrfValid = await validateCsrf(request);
    if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

    const adminId = authResult.session.user?.discordId ?? '';
    const adminName = authResult.session.user?.globalName ?? authResult.session.user?.name ?? 'Mastermind';
    const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 30, 60_000);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    let body: { key?: string; closed?: boolean; reason?: string };
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { key, closed, reason } = body;
    if (typeof key !== 'string' || !TAB_KEYS.includes(key as TabKey)) {
        return NextResponse.json({ error: 'Invalid tab key' }, { status: 400 });
    }
    if (typeof closed !== 'boolean') {
        return NextResponse.json({ error: '`closed` must be boolean' }, { status: 400 });
    }
    const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null;

    let newState;
    try {
        newState = await setTabState(key as TabKey, closed, adminId, adminName, cleanReason);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'Update failed' }, { status: 500 });
    }

    await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: closed ? 'site_tab_close' : 'site_tab_open',
        before: null,
        after: { key, closed, reason: cleanReason },
        metadata: {},
        ip: getClientIp(request),
    });

    const path = TAB_PATHS[key as TabKey];
    if (path) {
        try {
            revalidatePath(path, 'page');
            revalidatePath(path, 'layout');
        } catch {}
    }
    try {
        revalidatePath('/');
        revalidatePath('/', 'layout');
    } catch {}

    return NextResponse.json({ key, state: newState });
}
