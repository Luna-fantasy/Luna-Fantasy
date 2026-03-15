import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
import { createLoan, repayLoan, partialRepayLoan } from '@/lib/bank/bank-ops';
import { getLiveBankConfig } from '@/lib/bank/live-bank-config';

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
    const config = await getLiveBankConfig();
    const { tier, isVip } = await request.json();

    if (!config.loanTiers.includes(tier)) {
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

export async function PUT(request: Request) {
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

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    const balanceBefore = await getBalance(discordId);
    const result = await partialRepayLoan(discordId, amount);

    await logTransaction({
      discordId,
      type: 'bank_loan_partial_repaid',
      amount: -amount,
      balanceBefore,
      balanceAfter: result.balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: result.fullyPaid ? 'loan_repayment' : 'loan_partial_repayment',
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      amountPaid: amount,
      newRepaymentAmount: result.newRepaymentAmount,
      fullyPaid: result.fullyPaid,
      newBalance: result.balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/loan PUT] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
