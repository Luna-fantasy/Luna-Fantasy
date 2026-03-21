import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateCardStats } from '@/lib/bazaar/luckbox-config';
import { getLuckboxShopConfig } from '@/lib/bazaar/shop-config';
import { deductLunari, creditLunari, addToBankReserve, checkDebt, logTransaction, getBalance } from '@/lib/bazaar/lunari-ops';
import { weightedRandomDraw } from '@/lib/bazaar/weighted-random';
import { userOwnsCard, addCardToUser } from '@/lib/bazaar/card-ops';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import clientPromise from '@/lib/mongodb';

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

    // 2. Input validation — look up tier from DB-backed config
    const { tier } = await request.json();
    const allBoxes = await getLuckboxShopConfig();
    const boxConfig = allBoxes.find((b) => b.id === tier);
    if (!boxConfig) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // 3. Balance check
    const balance = await getBalance(discordId);
    console.log(`[luckbox] ${discordId} balance=${balance}, tier=${tier}, price=${boxConfig.price}`);
    if (balance < boxConfig.price) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 4. Select rarity based on box percentages (multi-rarity support)
    let selectedRarity: string;
    if (boxConfig.rarities.length === 1) {
      selectedRarity = boxConfig.rarities[0].rarity;
    } else {
      // Weighted random by percentage
      const roll = Math.random() * 100;
      let cumulative = 0;
      selectedRarity = boxConfig.rarities[0].rarity; // fallback
      for (const slot of boxConfig.rarities) {
        cumulative += slot.percentage;
        if (roll < cumulative) {
          selectedRarity = slot.rarity;
          break;
        }
      }
    }

    // 5. Draw random card from catalog for the selected rarity
    const client = await clientPromise;
    const db = client.db('Database');
    const configDoc = await db
      .collection('cards_config')
      .findOne({ _id: selectedRarity.toUpperCase() as any });

    if (!configDoc?.items) {
      return NextResponse.json({ error: 'No cards available for this tier' }, { status: 400 });
    }

    const parsedCards = Array.isArray(configDoc.items) ? configDoc.items : [];
    if (!Array.isArray(parsedCards) || parsedCards.length === 0) {
      return NextResponse.json({ error: 'No cards available for this tier' }, { status: 400 });
    }

    const cardsWithWeight = parsedCards.map((c: any) => ({
      name: String(c.name ?? ''),
      rarity: c.rarity,
      imageUrl: c.imageUrl ?? '',
      drawWeight: c.weight ?? 1,
    }));

    // Use drawWeight for the random selection pool
    const drawPool = cardsWithWeight.map((c) => ({ ...c, weight: c.drawWeight }));
    const picked = weightedRandomDraw(drawPool);

    // Generate random attack and weight stats based on rarity (matches bot behavior)
    const stats = generateCardStats(selectedRarity);

    const drawnCard = {
      name: picked.name,
      rarity: selectedRarity.toUpperCase(),
      attack: stats.attack,
      imageUrl: picked.imageUrl,
      weight: stats.weight,
    };

    // 5. Check duplicate
    const isDuplicate = await userOwnsCard(discordId, drawnCard.name);

    // 6. Atomic deduct Lunari
    const deductResult = await deductLunari(discordId, boxConfig.price);
    if (!deductResult.success) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    try {
      // 7. Add to bank reserve
      await addToBankReserve(boxConfig.price);

      // 8. Grant card (only if NOT duplicate)
      if (!isDuplicate) {
        await addCardToUser(discordId, drawnCard, boxConfig.label);
      }

      // 9. Log transaction
      await logTransaction({
        discordId,
        type: 'luckbox_spend',
        amount: -boxConfig.price,
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
      await creditLunari(discordId, boxConfig.price).catch(() => {});
      console.error('Luckbox grant error:', error);
      return NextResponse.json({ error: 'Purchase failed. Lunari refunded.' }, { status: 500 });
    }
  } catch (err) {
    console.error('Luckbox API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
