import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
import { createLoan, repayLoan } from '@/lib/bank/bank-ops';
import { LOAN_TIERS } from '@/lib/bank/bank-config';

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
    const { tier, isVip } = await request.json();

    if (!LOAN_TIERS.includes(tier)) {
      return NextResponse.json({ error: 'Invalid loan tier' }, { status: 400 });
    }

    const balanceBefore = await getBalance(discordId);
    const { loan, balanceAfter } = await createLoan(discordId, tier, !!isVip);

    await logTransaction({
      discordId,
      type: 'bank_loan_taken',
      amount: tier,
      balanceBefore,
      balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: `loan_${tier}`,
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      loan,
      newBalance: balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/loan POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const balanceBefore = await getBalance(discordId);
    const { repaymentAmount, balanceAfter } = await repayLoan(discordId);

    await logTransaction({
      discordId,
      type: 'bank_loan_repaid',
      amount: -repaymentAmount,
      balanceBefore,
      balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: 'loan_repayment',
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      repaymentAmount,
      newBalance: balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/loan PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
