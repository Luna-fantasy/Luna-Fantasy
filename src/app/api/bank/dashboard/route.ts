import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBankDashboardData } from '@/lib/bank/bank-ops';
import { getLiveBankConfig } from '@/lib/bank/live-bank-config';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { setCsrfCookie } from '@/lib/bazaar/csrf';

export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  const rl = checkRateLimit('bank_dashboard', discordId, RATE_LIMITS.bank_dashboard.maxRequests, RATE_LIMITS.bank_dashboard.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const data = await getBankDashboardData(discordId);
    const bankConfig = await getLiveBankConfig();
    const response = NextResponse.json({
      ...data,
      config: {
        loanTiers: bankConfig.loanTiers,
        loanTiersFull: bankConfig.loanTiersFull,
        loanInterestRate: bankConfig.loanInterestRate,
        loanVipInterestRate: bankConfig.loanVipInterestRate,
        loanDurationMs: bankConfig.loanDurationMs,
        dailyBase: bankConfig.dailyBase,
        dailyVipBonus: bankConfig.dailyVipBonus,
        dailyCooldownMs: bankConfig.dailyCooldownMs,
        monthlyAmount: bankConfig.monthlyAmount,
        monthlyCooldownMs: bankConfig.monthlyCooldownMs,
        investmentMinAmount: bankConfig.investmentMinAmount,
        investmentProfitRate: bankConfig.investmentProfitRate,
        investmentMaturityMs: bankConfig.investmentMaturityMs,
        investmentEarlyFee: bankConfig.investmentEarlyFee,
        investmentDepositLockMs: bankConfig.investmentDepositLockMs,
        insuranceCost: bankConfig.insuranceCost,
      },
    });
    await setCsrfCookie(response);
    return response;
  } catch (err) {
    console.error('[bank/dashboard] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
