import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
import { payDebt } from '@/lib/bank/bank-ops';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const rl = checkRateLimit('bank_loan', discordId, RATE_LIMITS.bank_loan.maxRequests, RATE_LIMITS.bank_loan.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const { amount } = await request.json();

    const balanceBefore = await getBalance(discordId);
    const result = await payDebt(discordId, amount ?? undefined);

    await logTransaction({
      discordId,
      type: 'bank_debt_paid',
      amount: -result.amountPaid,
      balanceBefore,
      balanceAfter: result.balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: result.remainingDebt === 0 ? 'debt_full_payment' : 'debt_partial_payment',
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      amountPaid: result.amountPaid,
      remainingDebt: result.remainingDebt,
      newBalance: result.balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/debt POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
