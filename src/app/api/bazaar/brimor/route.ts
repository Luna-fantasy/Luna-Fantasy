import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import clientPromise from '@/lib/mongodb';
import {
  deductLunari,
  addToBankReserve,
  checkDebt,
  logTransaction,
  getBalance,
} from '@/lib/bazaar/lunari-ops';
import { getPassportDiscount } from '@/lib/bazaar/passport-discount';
import { getUserGuildRoles } from '@/lib/bank/discord-roles';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { GUILD_ID } from '@/lib/bank/bank-config';
import { getVendorItems, findVendorItem } from '@/lib/bazaar/vendor-config';

// In-memory purchase lock to prevent double purchases
const activePurchases = new Set<string>();

/**
 * GET — Return Brimor shop items, user ownership, and role active status.
 */
export async function GET() {
  const session = await auth();
  const discordId = session?.user?.discordId;

  // Filter out game abilities (roulette powers) — Brimor only sells Discord roles.
  // Abilities share the vendor_config doc but are handled by the bot's game system.
  const allItems = await getVendorItems('brimor');
  const items = allItems.filter((item) => (item as any).type !== 'game_ability');

  if (items.length === 0) {
    return NextResponse.json({ items: [], user: null });
  }

  // Look up user ownership from inventory collection + active roles
  let userRoles: string[] = [];
  let ownedItemIds = new Set<string>();

  if (discordId) {
    const client = await clientPromise;
    const db = client.db('Database');

    // Read inventory for this user
    const inventoryDoc = await db.collection('inventory').findOne({ _id: discordId as any });
    const inventory: any[] = Array.isArray(inventoryDoc?.items) ? inventoryDoc.items : [];

    // Filter to brimor purchases
    for (const record of inventory) {
      if (record.shopId === 'brimor') {
        ownedItemIds.add(record.id);
      }
    }

    // Fetch current guild roles to determine active/inactive
    userRoles = await getUserGuildRoles(discordId);
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    owned: ownedItemIds.has(item.id),
    active: userRoles.includes(item.roleId),
  }));

  let balance = 0;
  let hasDebt = false;
  if (discordId) {
    balance = await getBalance(discordId);
    hasDebt = await checkDebt(discordId);
  }

  return NextResponse.json({
    items: enrichedItems,
    user: discordId ? { balance, hasDebt } : null,
  });
}

/**
 * POST — Buy a role or toggle it on/off.
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

  const body = await request.json();
  const { action, itemId } = body;

  if (action === 'toggle') {
    return handleToggle(discordId, itemId);
  }

  // Default action: buy
  return handleBuy(request, discordId, itemId);
}

async function handleBuy(request: Request, discordId: string, itemId: string) {
  // Rate limit
  const rl = checkRateLimit(
    'brimor_purchase',
    discordId,
    RATE_LIMITS.brimor_purchase.maxRequests,
    RATE_LIMITS.brimor_purchase.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // Anti-duplicate purchase lock
  const lockKey = `${discordId}:brimor:${itemId}`;
  if (activePurchases.has(lockKey)) {
    return NextResponse.json({ error: 'Purchase already in progress' }, { status: 409 });
  }
  activePurchases.add(lockKey);

  try {
    // 1. Find item in DB — reject game abilities (roulette powers, not roles)
    const item = await findVendorItem('brimor', itemId);
    if (!item || (item as any).type === 'game_ability') {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
    }

    // 2. Check not already owned (inventory collection)
    const client = await clientPromise;
    const db = client.db('Database');
    const inventoryDoc = await db.collection('inventory').findOne({ _id: discordId as any });
    const inventory: any[] = Array.isArray(inventoryDoc?.items) ? inventoryDoc.items : [];

    const alreadyOwned = inventory.some((r: any) => r.id === itemId && r.shopId === 'brimor');
    if (alreadyOwned) {
      return NextResponse.json({ error: 'You already own this role' }, { status: 400 });
    }

    // 3. Debt check
    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json(
        { error: 'You have outstanding debt. Pay your debts first.' },
        { status: 403 }
      );
    }

    // 4. Passport discount
    const discount = await getPassportDiscount(discordId);
    const finalPrice = discount.apply(item.price);

    // 5. Balance check
    const balance = await getBalance(discordId);
    if (balance < finalPrice) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 6. Deduct Lunari
    const deduction = await deductLunari(discordId, finalPrice);
    if (!deduction.success) {
      return NextResponse.json({ error: 'Failed to deduct Lunari' }, { status: 500 });
    }

    // 7. Add to bank reserve
    void addToBankReserve(finalPrice);

    // 8. Save to inventory collection
    const purchaseRecord = {
      id: item.id,
      name: item.name,
      price: finalPrice,
      roleId: item.roleId,
      description: item.description,
      shopId: 'brimor',
      purchaseDate: new Date().toISOString(),
    };

    await db.collection('inventory').updateOne(
      { _id: discordId as any },
      { $push: { items: purchaseRecord as any } },
      { upsert: true }
    );

    // 8. Grant Discord role
    let grantError: string | null = null;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      grantError = 'Bot token not configured';
    } else {
      try {
        const res = await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${item.roleId}`,
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
          console.error(`[brimor] Failed to grant role to ${discordId}: ${res.status} ${errText}`);
          grantError = 'Failed to grant role';
        }
      } catch (err) {
        console.error('[brimor] Discord API error:', err);
        grantError = 'Failed to grant role';
      }
    }

    // 9. Award "first_role" badge if this is the user's first Brimor purchase
    if (!inventory.some((r: any) => r.shopId === 'brimor')) {
      try {
        const badgesDoc = await db.collection('badges').findOne({ _id: discordId as any });
        const badges = badgesDoc?.data ?? {};
        if (!badges['first_role']) {
          const updatedBadges = { ...badges, first_role: Date.now() };
          await db.collection('badges').updateOne(
            { _id: discordId as any },
            { $set: { data: updatedBadges } },
            { upsert: true }
          );
        }
      } catch (err) {
        console.error('[brimor] Failed to award first_role badge:', err);
      }
    }

    // 10. Log transaction
    void logTransaction({
      discordId,
      type: 'brimor_purchase',
      amount: -finalPrice,
      balanceBefore: deduction.balanceBefore,
      balanceAfter: deduction.balanceAfter,
      metadata: {
        vendorId: 'brimor',
        itemReceived: item.name,
        itemId: item.id,
        roleId: item.roleId,
        ...(discount.eligible ? { passportDiscount: true, originalPrice: item.price } : {}),
      },
      createdAt: new Date(),
      source: 'web',
    });

    const response = NextResponse.json({
      success: true,
      item: item.name,
      newBalance: deduction.balanceAfter,
      grantError,
    });

    return refreshCsrf(response);
  } catch (err) {
    console.error('[brimor] Purchase error:', err);
    return NextResponse.json(
      { error: 'Purchase failed. Please try again.' },
      { status: 500 }
    );
  } finally {
    activePurchases.delete(`${discordId}:brimor:${itemId}`);
  }
}

async function handleToggle(discordId: string, itemId: string) {
  // Separate rate limit for toggles
  const rl = checkRateLimit(
    'brimor_toggle',
    discordId,
    RATE_LIMITS.brimor_toggle.maxRequests,
    RATE_LIMITS.brimor_toggle.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // 1. Find item in DB
  const item = await findVendorItem('brimor', itemId);
  if (!item) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }

  // 2. Verify ownership from inventory
  const client = await clientPromise;
  const db = client.db('Database');
  const inventoryDoc = await db.collection('inventory').findOne({ _id: discordId as any });
  const inventory: any[] = Array.isArray(inventoryDoc?.items) ? inventoryDoc.items : [];

  const owned = inventory.some((r: any) => r.id === itemId && r.shopId === 'brimor');
  if (!owned) {
    return NextResponse.json({ error: 'You do not own this role' }, { status: 403 });
  }

  // 3. Check current role state and toggle
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }

  const userRoles = await getUserGuildRoles(discordId);
  const isActive = userRoles.includes(item.roleId);

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}/roles/${item.roleId}`,
      {
        method: isActive ? 'DELETE' : 'PUT',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[brimor] Failed to toggle role for ${discordId}: ${res.status} ${errText}`);
      return NextResponse.json({ error: 'Failed to toggle role' }, { status: 500 });
    }
  } catch (err) {
    console.error('[brimor] Discord API error:', err);
    return NextResponse.json({ error: 'Failed to toggle role' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    active: !isActive,
    item: item.name,
  });
}
