import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { STONES, STONE_BOX_PRICE } from '@/lib/bazaar/stone-config';
import { deductLunari, creditLunari, addToBankReserve, checkDebt, logTransaction, getBalance, getDailySpending, DAILY_SPEND_LIMIT } from '@/lib/bazaar/lunari-ops';
import { weightedRandomDraw } from '@/lib/bazaar/weighted-random';
import { userOwnsStone, addStoneToUser } from '@/lib/bazaar/stone-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  // CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // Rate limit
  const rl = checkRateLimit('stonebox', discordId, RATE_LIMITS.stonebox.maxRequests, RATE_LIMITS.stonebox.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    // 1. Debt check
    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json({ error: 'You have outstanding debt. Pay your debts first.' }, { status: 403 });
    }

    // 2. Balance check
    const balance = await getBalance(discordId);
    if (balance < STONE_BOX_PRICE) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 2b. Daily spending limit
    const dailySpent = await getDailySpending(discordId);
    if (dailySpent + STONE_BOX_PRICE > DAILY_SPEND_LIMIT) {
      return NextResponse.json(
        { error: `Daily spending limit reached (${DAILY_SPEND_LIMIT.toLocaleString()}L/day). Try again tomorrow.` },
        { status: 429 }
      );
    }

    // 3. Draw random stone
    const drawnStone = weightedRandomDraw(STONES);

    // 4. Check duplicate
    const isDuplicate = await userOwnsStone(discordId, drawnStone.name);

    // 5. Atomic deduct Lunari
    const deductResult = await deductLunari(discordId, STONE_BOX_PRICE);
    if (!deductResult.success) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    try {
      // 6. Duplicate refund: 50% chance of 1,000L refund
      let refundAmount = 0;
      if (isDuplicate && Math.random() < 0.5) {
        refundAmount = 1_000;
        await creditLunari(discordId, refundAmount);
      }

      // 7. Add to bank reserve (full price minus any refund)
      await addToBankReserve(STONE_BOX_PRICE - refundAmount);

      // 8. Stone is ALWAYS added (even if duplicate)
      await addStoneToUser(discordId, drawnStone);

      // 9. Get updated balance
      const newBalance = deductResult.balanceAfter + refundAmount;

      // 10. Log transaction
      await logTransaction({
        discordId,
        type: 'stonebox_spend',
        amount: -(STONE_BOX_PRICE - refundAmount),
        balanceBefore: deductResult.balanceBefore,
        balanceAfter: newBalance,
        metadata: {
          vendorId: 'meluna',
          itemReceived: drawnStone.name,
          isDuplicate,
          refundAmount,
        },
        createdAt: new Date(),
        source: 'web',
      });

      const res = NextResponse.json({
        stone: {
          name: drawnStone.name,
          imageUrl: drawnStone.imageUrl,
        },
        isDuplicate,
        refundAmount,
        newBalance,
      });
      return refreshCsrf(res);
    } catch (error) {
      // REFUND on failure — only refund what HASN'T been refunded yet
      const remainingRefund = STONE_BOX_PRICE - refundAmount;
      if (remainingRefund > 0) {
        await creditLunari(discordId, remainingRefund).catch(() => {});
      }
      console.error('Stonebox grant error:', error);
      return NextResponse.json({ error: 'Purchase failed. Lunari refunded.' }, { status: 500 });
    }
  } catch (err) {
    console.error('Stonebox API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
