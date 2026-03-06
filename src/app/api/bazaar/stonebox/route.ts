import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { STONES, STONE_BOX_PRICE, STONE_REFUND_AMOUNT } from '@/lib/bazaar/stone-config';
import { deductLunari, creditLunari, addToBankReserve, checkDebt, logTransaction, getBalance } from '@/lib/bazaar/lunari-ops';
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

    // 3. Atomic deduct Lunari (full price)
    const deductResult = await deductLunari(discordId, STONE_BOX_PRICE);
    if (!deductResult.success) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    try {
      // 4. 50% chance: get a stone or get refunded
      const roll = Math.random();

      if (roll < 0.5) {
        // NO STONE — refund half the cost
        await creditLunari(discordId, STONE_REFUND_AMOUNT);

        // Net loss goes to bank reserve
        const netLoss = STONE_BOX_PRICE - STONE_REFUND_AMOUNT;
        if (netLoss > 0) {
          await addToBankReserve(netLoss);
        }

        const newBalance = deductResult.balanceAfter + STONE_REFUND_AMOUNT;

        await logTransaction({
          discordId,
          type: 'stonebox_spend',
          amount: -(STONE_BOX_PRICE - STONE_REFUND_AMOUNT),
          balanceBefore: deductResult.balanceBefore,
          balanceAfter: newBalance,
          metadata: {
            vendorId: 'meluna',
            gotStone: false,
            refundAmount: STONE_REFUND_AMOUNT,
          },
          createdAt: new Date(),
          source: 'web',
        });

        const res = NextResponse.json({
          gotStone: false,
          refundAmount: STONE_REFUND_AMOUNT,
          newBalance,
        });
        return refreshCsrf(res);
      }

      // GOT A STONE — draw random stone
      const drawnStone = weightedRandomDraw(STONES);
      const isDuplicate = await userOwnsStone(discordId, drawnStone.name);

      // Full price goes to bank reserve
      await addToBankReserve(STONE_BOX_PRICE);

      // Stone is always added (even if duplicate)
      await addStoneToUser(discordId, drawnStone);

      const newBalance = deductResult.balanceAfter;

      await logTransaction({
        discordId,
        type: 'stonebox_spend',
        amount: -STONE_BOX_PRICE,
        balanceBefore: deductResult.balanceBefore,
        balanceAfter: newBalance,
        metadata: {
          vendorId: 'meluna',
          gotStone: true,
          itemReceived: drawnStone.name,
          isDuplicate,
        },
        createdAt: new Date(),
        source: 'web',
      });

      const res = NextResponse.json({
        gotStone: true,
        stone: {
          name: drawnStone.name,
          imageUrl: drawnStone.imageUrl,
        },
        isDuplicate,
        sellPrice: isDuplicate ? drawnStone.sell_price : undefined,
        refundAmount: 0,
        newBalance,
      });
      return refreshCsrf(res);
    } catch (error) {
      // REFUND on failure — full price back
      await creditLunari(discordId, STONE_BOX_PRICE).catch(() => {});
      console.error('Stonebox grant error:', error);
      return NextResponse.json({ error: 'Purchase failed. Lunari refunded.' }, { status: 500 });
    }
  } catch (err) {
    console.error('Stonebox API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
