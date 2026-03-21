import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { creditLunari, deductLunari, getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
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
  const MAX_MODIFY_AMOUNT = 10_000_000;
  if (typeof amount !== 'number' || amount === 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'Amount must be a non-zero finite number' }, { status: 400 });
  }
  if (Math.abs(amount) > MAX_MODIFY_AMOUNT) {
    return NextResponse.json({ error: `Amount cannot exceed ${MAX_MODIFY_AMOUNT.toLocaleString()} Lunari` }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) {
    return NextResponse.json({ error: 'Reason required (3-500 characters)' }, { status: 400 });
  }

  try {
    const balanceBefore = await getBalance(discordId);
    let balanceAfter: number;

    if (amount > 0) {
      const result = await creditLunari(discordId, amount);
      balanceAfter = result.balanceAfter;
    } else {
      const result = await deductLunari(discordId, Math.abs(amount));
      if (!result.success) {
        return NextResponse.json({
          error: 'Insufficient balance',
          balance: result.balanceBefore,
        }, { status: 400 });
      }
      balanceAfter = result.balanceAfter;
    }

    await logTransaction({
      discordId,
      type: amount > 0 ? 'admin_credit' : 'admin_debit',
      amount: Math.abs(amount),
      balanceBefore,
      balanceAfter,
      metadata: {
        reason: reason.trim(),
        adminId,
        adminName: authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Admin',
      },
      source: 'web',
      createdAt: new Date(),
    });

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Unknown',
      action: 'balance_modify',
      targetDiscordId: discordId,
      before: { balance: balanceBefore },
      after: { balance: balanceAfter },
      metadata: { amount, reason: reason.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, balanceBefore, balanceAfter });
  } catch (error) {
    console.error('Balance modify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
