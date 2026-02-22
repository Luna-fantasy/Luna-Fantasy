import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLuckboxTier, VALID_TIERS } from '@/lib/bazaar/luckbox-config';
import { deductLunari, creditLunari, addToBankReserve, checkDebt, logTransaction, getBalance, getDailySpending, DAILY_SPEND_LIMIT } from '@/lib/bazaar/lunari-ops';
import { weightedRandomDraw } from '@/lib/bazaar/weighted-random';
import { userOwnsCard, addCardToUser } from '@/lib/bazaar/card-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import clientPromise from '@/lib/mongodb';
import type { LuckboxTier } from '@/types/bazaar';

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
  const rl = checkRateLimit('luckbox', discordId, RATE_LIMITS.luckbox.maxRequests, RATE_LIMITS.luckbox.windowMs);
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

    // 2. Input validation
    const { tier } = await request.json();
    if (!VALID_TIERS.includes(tier as LuckboxTier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const tierConfig = getLuckboxTier(tier);
    if (!tierConfig) {
      return NextResponse.json({ error: 'Invalid tier configuration' }, { status: 400 });
    }

    // 3. Balance check
    const balance = await getBalance(discordId);
    console.log(`[luckbox] ${discordId} balance=${balance}, tier=${tier}, price=${tierConfig.price}`);
    if (balance < tierConfig.price) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 3b. Daily spending limit
    const dailySpent = await getDailySpending(discordId);
    if (dailySpent + tierConfig.price > DAILY_SPEND_LIMIT) {
      return NextResponse.json(
        { error: `Daily spending limit reached (${DAILY_SPEND_LIMIT.toLocaleString()}L/day). Try again tomorrow.` },
        { status: 429 }
      );
    }

    // 4. Draw random card from catalog
    const client = await clientPromise;
    const db = client.db('Database');
    const catalogCards = await db
      .collection('card_catalog')
      .find({ rarity: tierConfig.rarity })
      .toArray();

    if (catalogCards.length === 0) {
      return NextResponse.json({ error: 'No cards available for this tier' }, { status: 400 });
    }

    const cardsWithWeight = catalogCards.map((c) => ({
      name: typeof c.name === 'object' && c.name?.en ? c.name.en : String(c.name ?? ''),
      rarity: c.rarity,
      attack: c.attack ?? 0,
      imageUrl: c.imageUrl ?? '',
      weight: c.weight ?? 1,
    }));

    const drawnCard = weightedRandomDraw(cardsWithWeight);

    // 5. Check duplicate
    const isDuplicate = await userOwnsCard(discordId, drawnCard.name);

    // 6. Atomic deduct Lunari
    const deductResult = await deductLunari(discordId, tierConfig.price);
    if (!deductResult.success) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    try {
      // 7. Add to bank reserve
      await addToBankReserve(tierConfig.price);

      // 8. Grant card (only if NOT duplicate)
      if (!isDuplicate) {
        await addCardToUser(discordId, drawnCard, tierConfig.label);
      }

      // 9. Log transaction
      await logTransaction({
        discordId,
        type: 'luckbox_spend',
        amount: -tierConfig.price,
        balanceBefore: deductResult.balanceBefore,
        balanceAfter: deductResult.balanceAfter,
        metadata: {
          vendorId: 'kael',
          packageId: tier,
          itemReceived: drawnCard.name,
          itemRarity: drawnCard.rarity,
          isDuplicate,
        },
        createdAt: new Date(),
        source: 'web',
      });

      console.log(`[luckbox] ${discordId} purchase complete: before=${deductResult.balanceBefore}, after=${deductResult.balanceAfter}, card=${drawnCard.name}, duplicate=${isDuplicate}`);
      const res = NextResponse.json({
        card: {
          name: drawnCard.name,
          rarity: drawnCard.rarity,
          imageUrl: drawnCard.imageUrl,
          attack: drawnCard.attack,
        },
        isDuplicate,
        newBalance: deductResult.balanceAfter,
      });
      return refreshCsrf(res);
    } catch (error) {
      // REFUND on failure after deduction
      await creditLunari(discordId, tierConfig.price).catch(() => {});
      console.error('Luckbox grant error:', error);
      return NextResponse.json({ error: 'Purchase failed. Lunari refunded.' }, { status: 500 });
    }
  } catch (err) {
    console.error('Luckbox API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
