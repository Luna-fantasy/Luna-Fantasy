import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { deductLunari, creditLunari, getBalance, addToBankReserve, logTransaction } from '@/lib/bazaar/lunari-ops';
import { checkCooldown, setCooldown } from '@/lib/bank/bank-ops';
import {
  TRADE_MAX_AMOUNT,
  TRADE_WIN_RATE,
  TRADE_LOSS_RATE,
  TRADE_WIN_CHANCE,
  TRADE_COOLDOWN_MS,
} from '@/lib/bank/bank-config';

/**
 * POST /api/bank/trade
 * Execute a Lunari trade (gamble). Matches LunaButler /banker trade logic:
 * - 50% chance to win +20% of amount
 * - 50% chance to lose -30% of amount
 * - 4h cooldown between trades
 * - Max 50,000 per trade
 * - Loss goes to bank reserve
 */
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

  const rl = checkRateLimit('bank_trade', discordId, RATE_LIMITS.bank_trade.maxRequests, RATE_LIMITS.bank_trade.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body: { amount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const amount = body.amount;
  if (!amount || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid trade amount' }, { status: 400 });
  }

  if (amount > TRADE_MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Maximum trade amount is ${TRADE_MAX_AMOUNT.toLocaleString()} Lunari` },
      { status: 400 }
    );
  }

  try {
    // Check cooldown
    const cooldown = await checkCooldown('trade', discordId, TRADE_COOLDOWN_MS);
    if (cooldown.onCooldown) {
      const nextTradeAt = (cooldown.lastUsed ?? 0) + TRADE_COOLDOWN_MS;
      return NextResponse.json(
        { error: 'Trade is on cooldown', nextTradeAt, remainingMs: cooldown.remainingMs },
        { status: 429 }
      );
    }

    // Check balance
    const balance = await getBalance(discordId);
    if (balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Set cooldown BEFORE executing (matches bot — prevents double-trade)
    await setCooldown('trade', discordId);

    // Determine outcome
    const won = Math.random() < TRADE_WIN_CHANCE;

    let newBalance: number;
    let delta: number;

    if (won) {
      // Win: +20% of wagered amount
      const winAmount = Math.floor(amount * TRADE_WIN_RATE);
      const { balanceAfter } = await creditLunari(discordId, winAmount);
      newBalance = balanceAfter;
      delta = winAmount;

      await logTransaction({
        discordId,
        type: 'trade_win',
        amount: winAmount,
        balanceBefore: balance,
        balanceAfter: newBalance,
        metadata: { vendorId: 'bank', itemReceived: 'trade_win', tradeAmount: amount },
        createdAt: new Date(),
        source: 'web',
      });
    } else {
      // Loss: -30% of wagered amount
      const lossAmount = Math.floor(amount * TRADE_LOSS_RATE);
      const result = await deductLunari(discordId, lossAmount);

      if (!result.success) {
        // Edge case: balance changed between check and deduction
        return NextResponse.json({ error: 'Insufficient balance for trade loss' }, { status: 400 });
      }

      newBalance = result.balanceAfter;
      delta = -lossAmount;

      // Loss goes to bank reserve (matches bot)
      void addToBankReserve(lossAmount);

      await logTransaction({
        discordId,
        type: 'trade_loss',
        amount: -lossAmount,
        balanceBefore: balance,
        balanceAfter: newBalance,
        metadata: { vendorId: 'bank', itemReceived: 'trade_loss', tradeAmount: amount },
        createdAt: new Date(),
        source: 'web',
      });
    }

    const res = NextResponse.json({
      success: true,
      won,
      amount,
      delta,
      newBalance,
      nextTradeAt: Date.now() + TRADE_COOLDOWN_MS,
    });
    return refreshCsrf(res);
  } catch (err) {
    console.error('[bank/trade] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/bank/trade
 * Get trade status (balance, cooldown) for the trading page.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  try {
    const [balance, cooldown] = await Promise.all([
      getBalance(discordId),
      checkCooldown('trade', discordId, TRADE_COOLDOWN_MS),
    ]);

    return NextResponse.json({
      balance,
      onCooldown: cooldown.onCooldown,
      remainingMs: cooldown.remainingMs,
      nextTradeAt: cooldown.lastUsed ? cooldown.lastUsed + TRADE_COOLDOWN_MS : null,
    });
  } catch (err) {
    console.error('[bank/trade GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
