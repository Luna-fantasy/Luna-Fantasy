import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStoneSellPrice } from '@/lib/bazaar/stone-config';
import { creditLunari, logTransaction, getBalance } from '@/lib/bazaar/lunari-ops';
import { countUserStone, removeDuplicateStones } from '@/lib/bazaar/stone-ops';
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

  // Rate limit (reuse stonebox limits)
  const rl = checkRateLimit('stonebox', discordId, RATE_LIMITS.stonebox.maxRequests, RATE_LIMITS.stonebox.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const stoneName = body.stoneName;
    const quantity = typeof body.quantity === 'number' && body.quantity >= 1
      ? Math.floor(body.quantity)
      : 1;

    if (!stoneName || typeof stoneName !== 'string') {
      return NextResponse.json({ error: 'Invalid stone name' }, { status: 400 });
    }

    // Check sell price exists
    const sellPrice = getStoneSellPrice(stoneName);
    if (sellPrice <= 0) {
      return NextResponse.json({ error: 'This stone cannot be sold' }, { status: 400 });
    }

    // Check user has enough duplicates
    const count = await countUserStone(discordId, stoneName);
    const maxSellable = count - 1; // keep at least 1
    if (maxSellable < 1) {
      return NextResponse.json({ error: 'You need at least 2 copies to sell a duplicate' }, { status: 400 });
    }

    const toSell = Math.min(quantity, maxSellable);
    const totalEarnings = toSell * sellPrice;

    // Remove duplicates
    const removed = await removeDuplicateStones(discordId, stoneName, toSell);
    if (removed === 0) {
      return NextResponse.json({ error: 'Failed to remove stones' }, { status: 500 });
    }

    // Credit sell price
    const balanceBefore = await getBalance(discordId);
    await creditLunari(discordId, removed * sellPrice);
    const newBalance = balanceBefore + removed * sellPrice;

    await logTransaction({
      discordId,
      type: 'stonebox_spend',
      amount: removed * sellPrice,
      balanceBefore,
      balanceAfter: newBalance,
      metadata: {
        vendorId: 'meluna',
        itemSold: stoneName,
        sellPrice,
        quantitySold: removed,
        totalEarnings: removed * sellPrice,
      },
      createdAt: new Date(),
      source: 'web',
    });

    const res = NextResponse.json({ newBalance, sellPrice, sold: removed });
    return refreshCsrf(res);
  } catch (err) {
    console.error('Sell stone API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
