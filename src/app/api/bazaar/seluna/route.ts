import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import clientPromise from '@/lib/mongodb';
import {
  deductLunari,
  creditLunari,
  addToBankReserve,
  checkDebt,
  logTransaction,
  getBalance,
} from '@/lib/bazaar/lunari-ops';
import { getPassportDiscount } from '@/lib/bazaar/passport-discount';
import { userOwnsCard, addCardToUser } from '@/lib/bazaar/card-ops';
import { userOwnsStone, addStoneToUser } from '@/lib/bazaar/stone-ops';
import { addTickets } from '@/lib/bazaar/ticket-ops';
import { getUserGuildRoles } from '@/lib/bank/discord-roles';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { SELUNA_FULL_MOON_ROLE_ID, GUILD_ID } from '@/lib/bank/bank-config';

// Stone image URLs (from stone-config.ts)
const STONE_IMAGES: Record<string, string> = {
  'Luna Moon Stone': 'https://assets.lunarian.app/stones/luna_moon_stone.png',
  'Moonbound Emerald': 'https://assets.lunarian.app/stones/moonbound_emerald.png',
};

// In-memory purchase lock to prevent double purchases
const activePurchases = new Set<string>();

/**
 * GET — Return Seluna shop state, items with stock, and user ownership info.
 */
export async function GET() {
  const session = await auth();
  const discordId = session?.user?.discordId;

  const client = await clientPromise;
  const db = client.db('Database');

  // Read shop state from seluna_vendor collection (new schema: { id, value })
  const shopDoc = await db
    .collection('seluna_vendor')
    .findOne({ id: 'active_shops' });

  // active_shops.value is keyed by channel ID — find any active (non-dev) shop
  const shopsMap = shopDoc?.value ?? {};
  let startTime = 0;
  let endTime = 0;
  let nextAppearTime = 0;
  for (const [key, channelData] of Object.entries(shopsMap) as [string, any][]) {
    // Skip dev shops (isDev flag or dev_ key prefix)
    if (channelData?.isDev || key.startsWith('dev_')) continue;
    if (channelData?.startTime) {
      const st = typeof channelData.startTime === 'number' ? channelData.startTime : new Date(channelData.startTime).getTime();
      const et = typeof channelData.endTime === 'number' ? channelData.endTime : new Date(channelData.endTime).getTime();
      if (st > startTime) {
        startTime = st;
        endTime = et;
        nextAppearTime = typeof channelData.nextAppearTime === 'number' ? channelData.nextAppearTime : new Date(channelData.nextAppearTime).getTime();
      }
    }
  }

  const now = Date.now();
  const active = startTime > 0 && now >= startTime && now < endTime;

  // Read inventory items from DB (managed by bot via /seluna add/remove)
  const itemsDoc = await db
    .collection('seluna_vendor')
    .findOne({ id: 'inventory_items' });
  const dbItems: any[] = Array.isArray(itemsDoc?.value) ? itemsDoc.value : [];

  // Read stock from seluna_vendor shop_stocks (per-channel, pick matching channel)
  const stocksDoc = await db
    .collection('seluna_vendor')
    .findOne({ id: 'shop_stocks' });
  const allStocks = stocksDoc?.value ?? {};
  // Find stock data for the active channel (same channel as active shop)
  let stockData: Record<string, number> = {};
  for (const [chId, chData] of Object.entries(allStocks) as [string, any][]) {
    // Use the channel that matches the active shop's most recent entry
    if (chData && typeof chData === 'object') {
      stockData = chData;
    }
  }
  // If we found the specific active channel, prefer that (skip dev shops)
  for (const [chId, chData] of Object.entries(shopsMap) as [string, any][]) {
    if (chData?.isDev || chId.startsWith('dev_')) continue;
    if (chData?.startTime) {
      const st = typeof chData.startTime === 'number' ? chData.startTime : new Date(chData.startTime).getTime();
      if (st === startTime && allStocks[chId]) {
        stockData = allStocks[chId];
        break;
      }
    }
  }

  // Look up card images from cards_config for any card items
  const cardImageMap: Record<string, string> = {};
  const cardItems = dbItems.filter((i: any) => (i.type || '').toLowerCase() === 'card');
  if (cardItems.length > 0) {
    // Collect unique rarities needed
    const rarities = Array.from(new Set(cardItems.map((i: any) => (i.rarity || 'SECRET').toUpperCase())));
    try {
      for (const rarity of rarities) {
        const rarityDoc = await db
          .collection('cards_config')
          .findOne({ _id: rarity as any });
        if (rarityDoc?.items) {
          const cards = Array.isArray(rarityDoc.items) ? rarityDoc.items : [];
          for (const ci of cardItems) {
            if ((ci.rarity || 'SECRET').toUpperCase() !== rarity) continue;
            const found = cards.find(
              (c: any) => c.name?.toLowerCase() === ci.name?.toLowerCase()
            );
            if (found?.imageUrl) {
              cardImageMap[ci.name] = found.imageUrl;
            }
          }
        }
      }
    } catch {
      // Non-critical — cards will render without images
    }
  }

  // Build items with remaining stock and user ownership
  const items = await Promise.all(
    dbItems.map(async (item: any) => {
      const itemType = (item.type || '').toLowerCase();

      // Remaining stock: -1 = unlimited, otherwise check shop_stocks
      let remaining: number;
      if (item.stock === -1) {
        remaining = -1; // unlimited
      } else {
        remaining =
          typeof stockData[item.id] === 'number'
            ? stockData[item.id]
            : item.stock;
      }

      // Image URL
      let imageUrl = '';
      if (itemType === 'card') {
        imageUrl = cardImageMap[item.name] ?? '';
      } else if (itemType === 'stone') {
        imageUrl = STONE_IMAGES[item.name] ?? '';
      }

      // Ownership check (only if logged in)
      let owned = false;
      if (discordId) {
        if (itemType === 'card') {
          owned = await userOwnsCard(discordId, item.name);
        } else if (itemType === 'stone') {
          owned = await userOwnsStone(discordId, item.name);
        } else if (itemType === 'role') {
          const roles = await getUserGuildRoles(discordId);
          owned = roles.includes(item.roleId || SELUNA_FULL_MOON_ROLE_ID);
        }
      }

      return {
        id: item.id,
        type: itemType,
        name: item.name,
        price: item.price,
        stock: item.stock,
        remaining,
        imageUrl,
        owned,
        description: item.description || '',
        ...(itemType === 'card'
          ? { rarity: item.rarity, attack: item.attack }
          : {}),
        ...(itemType === 'tickets'
          ? { ticketCount: item.amount }
          : {}),
        ...(itemType === 'role'
          ? { roleId: item.roleId }
          : {}),
      };
    })
  );

  // User balance
  let balance = 0;
  let hasDebt = false;
  if (discordId) {
    balance = await getBalance(discordId);
    hasDebt = await checkDebt(discordId);
  }

  return NextResponse.json({
    active,
    endsAt: active ? endTime : null,
    nextOpenAt: !active && nextAppearTime > now ? nextAppearTime : null,
    items,
    user: discordId
      ? { balance, hasDebt }
      : null,
  });
}

/**
 * POST — Purchase a Seluna item.
 */
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
  const rl = checkRateLimit(
    'seluna_purchase',
    discordId,
    RATE_LIMITS.seluna_purchase.maxRequests,
    RATE_LIMITS.seluna_purchase.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      }
    );
  }

  // Anti-duplicate purchase lock
  const lockKey = `${discordId}:seluna`;
  if (activePurchases.has(lockKey)) {
    return NextResponse.json(
      { error: 'Purchase already in progress' },
      { status: 409 }
    );
  }
  activePurchases.add(lockKey);

  try {
    const client = await clientPromise;
    const db = client.db('Database');

    // 1. Verify shop is active
    const shopDoc = await db
      .collection('seluna_vendor')
      .findOne({ id: 'active_shops' });
    const shopsMap = shopDoc?.value ?? {};
    let startTime = 0;
    let endTime = 0;
    for (const [key, channelData] of Object.entries(shopsMap) as [string, any][]) {
      // Skip dev shops (isDev flag or dev_ key prefix)
      if (channelData?.isDev || key.startsWith('dev_')) continue;
      if (channelData?.startTime) {
        const st = typeof channelData.startTime === 'number' ? channelData.startTime : new Date(channelData.startTime).getTime();
        const et = typeof channelData.endTime === 'number' ? channelData.endTime : new Date(channelData.endTime).getTime();
        if (st > startTime) { startTime = st; endTime = et; }
      }
    }
    const now = Date.now();

    if (!startTime || now < startTime || now >= endTime) {
      return NextResponse.json(
        { error: 'Seluna\'s shop is currently closed' },
        { status: 403 }
      );
    }

    // 2. Parse & validate item (read from DB inventory)
    const { itemId } = await request.json();
    const itemsDoc = await db
      .collection('seluna_vendor')
      .findOne({ id: 'inventory_items' });
    const dbItems: any[] = Array.isArray(itemsDoc?.value) ? itemsDoc.value : [];
    const itemConfig = dbItems.find((i: any) => i.id === itemId);
    if (!itemConfig) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
    }
    const itemType = (itemConfig.type || '').toLowerCase();

    // 3. Check stock (for limited items) — per-channel from shop_stocks
    // Find the active channel's stock
    const stocksDoc = await db
      .collection('seluna_vendor')
      .findOne({ id: 'shop_stocks' });
    const allStocks = stocksDoc?.value ?? {};
    let activeChannelId: string | null = null;
    for (const [chId, chData] of Object.entries(shopsMap) as [string, any][]) {
      if (chData?.isDev || chId.startsWith('dev_')) continue;
      if (chData?.startTime) {
        const st = typeof chData.startTime === 'number' ? chData.startTime : new Date(chData.startTime).getTime();
        if (st === startTime) { activeChannelId = chId; break; }
      }
    }
    const stockData: Record<string, number> = activeChannelId ? (allStocks[activeChannelId] ?? {}) : {};

    if (itemConfig.stock !== -1 && itemConfig.stock > 0) {
      const remaining =
        typeof stockData[itemConfig.id] === 'number'
          ? stockData[itemConfig.id]
          : itemConfig.stock;

      if (remaining <= 0) {
        return NextResponse.json({ error: 'Sold out' }, { status: 400 });
      }
    }

    // 4. Debt check
    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json(
        { error: 'You have outstanding debt. Pay your debts first.' },
        { status: 403 }
      );
    }

    // 5. Passport discount
    const discount = await getPassportDiscount(discordId);
    const finalPrice = discount.apply(itemConfig.price);

    // 6. Balance check
    const balance = await getBalance(discordId);
    if (balance < finalPrice) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // 7. Deduct Lunari
    const deduction = await deductLunari(discordId, finalPrice);
    if (!deduction.success) {
      return NextResponse.json(
        { error: 'Failed to deduct Lunari' },
        { status: 500 }
      );
    }

    // 8. Add to bank reserve
    void addToBankReserve(finalPrice);

    // 8. Decrement stock (for limited items) — per-channel in shop_stocks
    if (itemConfig.stock !== -1 && itemConfig.stock > 0 && activeChannelId) {
      await db.collection('seluna_vendor').updateOne(
        { id: 'shop_stocks' },
        { $inc: { [`value.${activeChannelId}.${itemConfig.id}`]: -1 } }
      );
    }

    // 9. Grant item by type
    let isDuplicate = false;
    let refunded = false;
    let grantError: string | null = null;

    switch (itemType) {
      case 'card': {
        isDuplicate = await userOwnsCard(discordId, itemConfig.name);
        if (!isDuplicate) {
          // Look up card image and stats from cards_config using the item's rarity
          const cardRarity = (itemConfig.rarity || 'SECRET').toUpperCase();
          let imageUrl = '';
          let attack = 0;
          let weight = 0;
          try {
            const rarityDoc = await db
              .collection('cards_config')
              .findOne({ _id: cardRarity as any });
            if (rarityDoc?.items) {
              const cards = Array.isArray(rarityDoc.items) ? rarityDoc.items : [];
              const found = cards.find(
                (c: any) => c.name?.toLowerCase() === itemConfig.name?.toLowerCase()
              );
              if (found) {
                imageUrl = found.imageUrl || '';
                attack = found.attack ?? 0;
                weight = found.weight ?? 0;
              }
            }
          } catch {}

          await addCardToUser(
            discordId,
            {
              name: itemConfig.name,
              rarity: cardRarity,
              attack,
              imageUrl,
              weight,
            },
            'Seluna'
          );
        }
        // If duplicate: Lunari deducted, card NOT added (matches bot)
        break;
      }

      case 'stone': {
        isDuplicate = await userOwnsStone(discordId, itemConfig.name);
        if (isDuplicate) {
          // Auto-refund discounted price for duplicate stones
          await creditLunari(discordId, finalPrice);
          refunded = true;
        } else {
          const imageUrl = STONE_IMAGES[itemConfig.name] ?? '';
          await addStoneToUser(discordId, {
            name: itemConfig.name,
            imageUrl,
          });
        }
        break;
      }

      case 'role': {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
          grantError = 'Bot token not configured';
          break;
        }
        const roleId = itemConfig.roleId || SELUNA_FULL_MOON_ROLE_ID;
        try {
          const res = await fetch(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bot ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (!res.ok) {
            const errText = await res.text();
            console.error(
              `[seluna] Failed to grant role to ${discordId}: ${res.status} ${errText}`
            );
            grantError = 'Failed to grant role';
          }
        } catch (err) {
          console.error('[seluna] Discord API error:', err);
          grantError = 'Failed to grant role';
        }
        break;
      }

      case 'tickets': {
        await addTickets(discordId, itemConfig.amount ?? 10);
        break;
      }
    }

    // 10. Log transaction
    const newBalance = refunded
      ? deduction.balanceAfter + finalPrice
      : deduction.balanceAfter;

    void logTransaction({
      discordId,
      type: 'seluna_purchase',
      amount: refunded ? 0 : -finalPrice,
      balanceBefore: deduction.balanceBefore,
      balanceAfter: newBalance,
      metadata: {
        vendorId: 'seluna',
        itemReceived: itemConfig.name,
        itemId: itemConfig.id,
        itemType,
        isDuplicate,
        refundAmount: refunded ? finalPrice : 0,
        ...(discount.eligible ? { passportDiscount: true, originalPrice: itemConfig.price } : {}),
      },
      createdAt: new Date(),
      source: 'web',
    });

    const response = NextResponse.json({
      success: true,
      item: itemConfig.name,
      itemType,
      newBalance,
      isDuplicate,
      refunded,
      grantError,
    });

    return refreshCsrf(response);
  } catch (err) {
    console.error('[seluna] Purchase error:', err);
    return NextResponse.json(
      { error: 'Purchase failed. Please try again.' },
      { status: 500 }
    );
  } finally {
    activePurchases.delete(lockKey);
  }
}
