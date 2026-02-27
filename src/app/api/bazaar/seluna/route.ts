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
import { userOwnsCard, addCardToUser } from '@/lib/bazaar/card-ops';
import { userOwnsStone, addStoneToUser } from '@/lib/bazaar/stone-ops';
import { addTickets } from '@/lib/bazaar/ticket-ops';
import { getUserGuildRoles } from '@/lib/bank/discord-roles';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { SELUNA_ITEMS, SELUNA_FULL_MOON_ROLE_ID, GUILD_ID } from '@/lib/bank/bank-config';

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

  // Read shop state from seluna_vendor collection
  const shopDoc = await db
    .collection('seluna_vendor')
    .findOne({ _id: 'active_shops' as any });

  const shopData = shopDoc?.data ?? shopDoc ?? {};
  const startTime = shopData.startTime
    ? new Date(shopData.startTime).getTime()
    : 0;
  const endTime = shopData.endTime
    ? new Date(shopData.endTime).getTime()
    : 0;
  const nextAppearTime = shopData.nextAppearTime
    ? new Date(shopData.nextAppearTime).getTime()
    : 0;

  const now = Date.now();
  const active = startTime > 0 && now >= startTime && now < endTime;

  // Read stock from seluna_vendor.shop_stocks
  const stockDoc = await db
    .collection('seluna_vendor')
    .findOne({ _id: 'shop_stocks' as any });
  const stockData = stockDoc?.data ?? stockDoc ?? {};

  // Look up Luna Cerberus card image from cards_config SECRET
  let cerberusImageUrl = '';
  try {
    const secretDoc = await db
      .collection('cards_config')
      .findOne({ _id: 'SECRET' as any });
    if (secretDoc?.data) {
      const cards =
        typeof secretDoc.data === 'string'
          ? JSON.parse(secretDoc.data)
          : secretDoc.data;
      const cerberus = Array.isArray(cards)
        ? cards.find(
            (c: any) =>
              c.name === 'Luna Cerberus' || c.name === 'luna_cerberus'
          )
        : null;
      if (cerberus?.imageUrl) {
        cerberusImageUrl = cerberus.imageUrl;
      }
    }
  } catch {
    // Non-critical — card will render without image
  }

  // Build items with remaining stock and user ownership
  const items = await Promise.all(
    SELUNA_ITEMS.map(async (item) => {
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
      if (item.type === 'card') {
        imageUrl = cerberusImageUrl;
      } else if (item.type === 'stone') {
        imageUrl = STONE_IMAGES[item.name] ?? '';
      }

      // Ownership check (only if logged in)
      let owned = false;
      if (discordId) {
        if (item.type === 'card') {
          owned = await userOwnsCard(discordId, item.name);
        } else if (item.type === 'stone') {
          owned = await userOwnsStone(discordId, item.name);
        } else if (item.type === 'role') {
          const roles = await getUserGuildRoles(discordId);
          owned = roles.includes(SELUNA_FULL_MOON_ROLE_ID);
        }
      }

      return {
        id: item.id,
        type: item.type,
        name: item.name,
        price: item.price,
        stock: item.stock,
        remaining,
        imageUrl,
        owned,
        ...(item.type === 'card'
          ? { rarity: (item as any).rarity, attack: (item as any).attack }
          : {}),
        ...(item.type === 'tickets'
          ? { ticketCount: (item as any).ticketCount }
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
      .findOne({ _id: 'active_shops' as any });
    const shopData = shopDoc?.data ?? shopDoc ?? {};
    const startTime = shopData.startTime
      ? new Date(shopData.startTime).getTime()
      : 0;
    const endTime = shopData.endTime
      ? new Date(shopData.endTime).getTime()
      : 0;
    const now = Date.now();

    if (!startTime || now < startTime || now >= endTime) {
      return NextResponse.json(
        { error: 'Seluna\'s shop is currently closed' },
        { status: 403 }
      );
    }

    // 2. Parse & validate item
    const { itemId } = await request.json();
    const itemConfig = SELUNA_ITEMS.find((i) => i.id === itemId);
    if (!itemConfig) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
    }

    // 3. Check stock (for limited items)
    if (itemConfig.stock > 0) {
      const stockDoc = await db
        .collection('seluna_vendor')
        .findOne({ _id: 'shop_stocks' as any });
      const stockData = stockDoc?.data ?? {};
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

    // 5. Balance check
    const balance = await getBalance(discordId);
    if (balance < itemConfig.price) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    // 6. Deduct Lunari
    const deduction = await deductLunari(discordId, itemConfig.price);
    if (!deduction.success) {
      return NextResponse.json(
        { error: 'Failed to deduct Lunari' },
        { status: 500 }
      );
    }

    // 7. Add to bank reserve
    void addToBankReserve(itemConfig.price);

    // 8. Decrement stock (for limited items)
    if (itemConfig.stock > 0) {
      await db.collection('seluna_vendor').updateOne(
        { _id: 'shop_stocks' as any },
        { $inc: { [`data.${itemConfig.id}`]: -1 } },
        { upsert: true }
      );
    }

    // 9. Grant item by type
    let isDuplicate = false;
    let refunded = false;
    let grantError: string | null = null;

    switch (itemConfig.type) {
      case 'card': {
        isDuplicate = await userOwnsCard(discordId, itemConfig.name);
        if (!isDuplicate) {
          // Look up card image from cards_config
          let imageUrl = '';
          try {
            const secretDoc = await db
              .collection('cards_config')
              .findOne({ _id: 'SECRET' as any });
            if (secretDoc?.data) {
              const cards =
                typeof secretDoc.data === 'string'
                  ? JSON.parse(secretDoc.data)
                  : secretDoc.data;
              const cerberus = Array.isArray(cards)
                ? cards.find(
                    (c: any) =>
                      c.name === 'Luna Cerberus' ||
                      c.name === 'luna_cerberus'
                  )
                : null;
              if (cerberus?.imageUrl) imageUrl = cerberus.imageUrl;
            }
          } catch {}

          await addCardToUser(
            discordId,
            {
              name: itemConfig.name,
              rarity: 'SECRET',
              attack: (itemConfig as any).attack ?? 500,
              imageUrl,
              weight: (itemConfig as any).weight ?? 0.3,
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
          // Auto-refund full price for duplicate stones
          await creditLunari(discordId, itemConfig.price);
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
        try {
          const res = await fetch(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${SELUNA_FULL_MOON_ROLE_ID}`,
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
        await addTickets(discordId, (itemConfig as any).ticketCount ?? 10);
        break;
      }
    }

    // 10. Log transaction
    const newBalance = refunded
      ? deduction.balanceAfter + itemConfig.price
      : deduction.balanceAfter;

    void logTransaction({
      discordId,
      type: 'seluna_purchase',
      amount: refunded ? 0 : -itemConfig.price,
      balanceBefore: deduction.balanceBefore,
      balanceAfter: newBalance,
      metadata: {
        vendorId: 'seluna',
        itemReceived: itemConfig.name,
        itemId: itemConfig.id,
        itemType: itemConfig.type,
        isDuplicate,
        refundAmount: refunded ? itemConfig.price : 0,
      },
      createdAt: new Date(),
      source: 'web',
    });

    const response = NextResponse.json({
      success: true,
      item: itemConfig.name,
      itemType: itemConfig.type,
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
