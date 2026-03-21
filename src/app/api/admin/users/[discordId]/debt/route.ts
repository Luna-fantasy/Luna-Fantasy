import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let reason = 'Admin cleared debt';
  try {
    const body = await request.json();
    if (body.reason && typeof body.reason === 'string') {
      reason = body.reason.slice(0, 500);
    }
  } catch {}

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const doc = await db.collection('debt').findOne({ _id: discordId as any });
    const debtBefore = doc?.amount ?? 0;

    await db.collection('debt').deleteOne({ _id: discordId as any });

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'debt_clear',
      targetDiscordId: discordId,
      before: { debt: debtBefore },
      after: { debt: 0 },
      metadata: { reason },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, debtCleared: debtBefore });
  } catch (error) {
    console.error('Debt clear error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
