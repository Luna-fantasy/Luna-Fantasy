import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { checkDebt, getBalance, logTransaction } from '@/lib/bazaar/lunari-ops';
import { purchaseInsurance } from '@/lib/bank/bank-ops';
import { INSURANCE_COST } from '@/lib/bank/bank-config';

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

  const rl = checkRateLimit('bank_insurance', discordId, RATE_LIMITS.bank_insurance.maxRequests, RATE_LIMITS.bank_insurance.windowMs);
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

    const balanceBefore = await getBalance(discordId);
    const { balanceAfter } = await purchaseInsurance(discordId);

    await logTransaction({
      discordId,
      type: 'bank_insurance',
      amount: -INSURANCE_COST,
      balanceBefore,
      balanceAfter,
      metadata: {
        vendorId: 'bank',
        itemReceived: 'steal_protection',
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({
      success: true,
      newBalance: balanceAfter,
    });
    return refreshCsrf(res);
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[bank/insurance] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
