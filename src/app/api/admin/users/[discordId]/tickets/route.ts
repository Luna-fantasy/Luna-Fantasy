import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { getUserTickets, addTickets } from '@/lib/bazaar/ticket-ops';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  let body: { amount: number; reason: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { amount, reason } = body;
  if (typeof amount !== 'number' || amount === 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Amount must be a non-zero integer' }, { status: 400 });
  }
  if (Math.abs(amount) > 10_000) {
    return NextResponse.json({ error: 'Amount cannot exceed 10,000 tickets at once' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) {
    return NextResponse.json({ error: 'Reason required (3-500 characters)' }, { status: 400 });
  }

  try {
    const ticketsBefore = await getUserTickets(discordId);

    if (ticketsBefore + amount < 0) {
      return NextResponse.json({
        error: `Cannot reduce below 0. Current tickets: ${ticketsBefore}`,
        tickets: ticketsBefore,
      }, { status: 400 });
    }

    const ticketsAfter = await addTickets(discordId, amount);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Unknown',
      action: 'tickets_modify',
      targetDiscordId: discordId,
      before: { tickets: ticketsBefore },
      after: { tickets: ticketsAfter },
      metadata: { amount, reason: reason.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, ticketsBefore, ticketsAfter });
  } catch (error) {
    console.error('Tickets modify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
