import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { agentFetch } from '@/lib/admin/vps-agent';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 5, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { name } = await req.json();
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Process name required' }, { status: 400 });
  }

  const res = await agentFetch(`/pm2/restart/${encodeURIComponent(name)}`, { method: 'POST' });

  await logAdminAction({
    adminDiscordId: auth.session.user.discordId!,
    adminUsername: auth.session.user.username ?? 'unknown',
    action: 'pm2_restart',
    metadata: { processName: name, success: res.ok },
    before: null,
    after: null,
    ip: getClientIp(req),
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.data?.error || 'Restart failed' }, { status: 502 });
  }
  return NextResponse.json(res.data);
}
