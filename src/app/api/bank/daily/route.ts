import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { creditLunari, getBalance, checkDebt, logTransaction } from '@/lib/bazaar/lunari-ops';
import { checkCooldown, setCooldown, getInvestment } from '@/lib/bank/bank-ops';
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

  const rl = checkRateLimit('bank_daily', discordId, RATE_LIMITS.bank_daily.maxRequests, RATE_LIMITS.bank_daily.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const config = await getLiveBankConfig();

    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json({ error: 'You have outstanding debt. Pay your debts first.' }, { status: 403 });
    }

    const cooldown = await checkCooldown('daily', discordId, config.dailyCooldownMs);
    if (cooldown.onCooldown) {
      return NextResponse.json(
        { error: 'Daily salary already claimed', nextClaimAt: (cooldown.lastUsed ?? 0) + config.dailyCooldownMs },
        { status: 429 }
      );
    }

    // VIP check — user has active investment with >= 20K
    const investment = await getInvestment(discordId);
    const isVip = !!investment && investment.amount >= config.investmentMinAmount;

    const baseAmount = config.dailyBase;
    const vipBonus = isVip ? config.dailyVipBonus : 0;
    const totalAmount = baseAmount + vipBonus;

    const balanceBefore = await getBalance(discordId);
    const { balanceAfter } = await creditLunari(discordId, totalAmount);

    await setCooldown('daily', discordId);

    await logTransaction({
      discordId,
      type: 'bank_daily',
      amount: totalAmount,
      balanceBefore,
      balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: isVip ? 'daily_vip' : 'daily',
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      amount: baseAmount,
      vipBonus,
      newBalance: balanceAfter,
      nextClaimAt: Date.now() + config.dailyCooldownMs,
    });
    return refreshCsrf(res);
  } catch (err) {
    console.error('[bank/daily] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
