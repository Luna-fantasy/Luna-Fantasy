import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt, getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
import { depositInvestment, withdrawInvestment } from '@/lib/bank/bank-ops';
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

  const rl = checkRateLimit('bank_investment', discordId, RATE_LIMITS.bank_investment.maxRequests, RATE_LIMITS.bank_investment.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json({ error: 'You have outstanding debt' }, { status: 403 });
    }

    const config = await getLiveBankConfig();
    const { amount } = await request.json();
    if (typeof amount !== 'number' || amount < config.investmentMinAmount) {
      return NextResponse.json(
        { error: `Minimum deposit is ${config.investmentMinAmount.toLocaleString()} Lunari` },
        { status: 400 }
      );
    }

    const balanceBefore = await getBalance(discordId);
    const { investment, balanceAfter } = await depositInvestment(discordId, amount);

    await logTransaction({
      discordId,
      type: 'bank_investment_deposit',
      amount: -amount,
      balanceBefore,
      balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: `investment_deposit_${amount}`,
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      investment,
      newBalance: balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/investment POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const rl = checkRateLimit('bank_investment', discordId, RATE_LIMITS.bank_investment.maxRequests, RATE_LIMITS.bank_investment.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const balanceBefore = await getBalance(discordId);
    const { payout, profit, early, balanceAfter } = await withdrawInvestment(discordId);

    await logTransaction({
      discordId,
      type: 'bank_investment_withdraw',
      amount: payout,
      balanceBefore,
      balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: early ? 'investment_early_withdraw' : 'investment_mature_withdraw',
        refundAmount: profit,
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      payout,
      profit,
      early,
      newBalance: balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/investment DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
