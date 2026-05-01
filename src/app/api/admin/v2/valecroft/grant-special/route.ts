import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { grantSpecialProperty, listProperties } from '@/lib/admin/valecroft';

export const dynamic = 'force-dynamic';

const GUILD_ID = process.env.NEXT_PUBLIC_GUILD_ID || '1243327880478462032';
const DISCORD_API = 'https://discord.com/api/v10';

// GET — return the list of `special`-tier properties available to grant.
// Used by the dashboard to populate the property dropdown.
export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const all = await listProperties({ activeOnly: false, includeSpecial: true });
    const specials = all
      .filter(p => p.tier === 'special')
      .map(p => ({
        key: p.key,
        name: p.name,
        image_url: p.image_url,
        active: p.active,
      }));
    return NextResponse.json({ rows: specials });
  } catch (err) {
    console.error('[grant-special GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST — grant a special property to a Discord user. Verifies the user is
// a member of the guild before writing. Mastermind-only + CSRF + rate-limit.
export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const adminName = auth.session.user?.globalName ?? 'Mastermind';
  const { allowed, retryAfterMs } = checkRateLimit('admin_grant', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const discordId = String(body.discordId ?? '').trim();
  const key = String(body.key ?? '').trim();
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'discordId must be a Discord snowflake (17-20 digits)' }, { status: 400 });
  if (!key) return NextResponse.json({ error: 'property key is required' }, { status: 400 });

  // Verify the user is in the guild before granting. Avoids granting to
  // strangers who aren't actually in the server.
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'DISCORD_BOT_TOKEN not configured' }, { status: 500 });
  }

  let memberName = '';
  try {
    const res = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${discordId}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
    if (res.status === 404) {
      return NextResponse.json({ error: 'User is not a member of the Luna server.' }, { status: 404 });
    }
    if (!res.ok) {
      console.error('[grant-special] Discord API check failed', res.status, await res.text().catch(() => ''));
      return NextResponse.json({ error: `Discord API error (${res.status})` }, { status: 502 });
    }
    const m = await res.json();
    memberName = m?.nick || m?.user?.global_name || m?.user?.username || '';
  } catch (err: any) {
    console.error('[grant-special] guild lookup failed', err);
    return NextResponse.json({ error: 'Failed to verify guild membership' }, { status: 502 });
  }

  const result = await grantSpecialProperty(discordId, key);
  if (!result.ok) {
    const reason = result.reason ?? 'unknown';
    const messages: Record<string, string> = {
      already_owns: 'User already owns this special property.',
      not_in_guild: 'User is not in the guild.',
      unknown_property: 'No property with that key.',
      not_special_tier: 'Only `special`-tier properties can be granted this way.',
      inactive: 'Property is inactive — toggle it active before granting.',
    };
    return NextResponse.json({ error: messages[reason] ?? 'Grant failed', reason }, { status: 400 });
  }

  await logAdminAction({
    adminDiscordId: adminId,
    adminUsername: adminName,
    action: 'valecroft_grant_special',
    before: null,
    after: { discordId, propertyKey: key, memberName },
    metadata: { discordId, propertyKey: key },
    ip: getClientIp(req),
  });

  return NextResponse.json({ ok: true, memberName });
}
