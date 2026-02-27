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
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { getVendorItems, findVendorItem } from '@/lib/bazaar/vendor-config';

// In-memory purchase lock to prevent double purchases
const activePurchases = new Set<string>();

/**
 * GET — Return Mells Selvair shop items enriched with user ownership + active status.
 */
export async function GET() {
  const session = await auth();
  const discordId = session?.user?.discordId;

  const items = await getVendorItems('mells_selvair');

  if (items.length === 0) {
    return NextResponse.json({ items: [], user: null });
  }

  let ownedItemIds = new Set<string>();
  let activeBackground = 'default';
  let activeRankBackground = 'default';

  if (discordId) {
    const client = await clientPromise;
    const db = client.db('Database');

    // Read inventory — st.db pattern: { _id: discordId, data: [...] }
    const inventoryDoc = await db.collection('inventory').findOne({ _id: discordId as any });
    const rawInventory = inventoryDoc?.data;
    const inventory: any[] = Array.isArray(rawInventory)
      ? rawInventory
      : typeof rawInventory === 'string'
        ? JSON.parse(rawInventory)
        : rawInventory ? [rawInventory] : [];

    for (const record of inventory) {
      if (record.shopId === 'mells_selvair') {
        ownedItemIds.add(record.id);
      }
    }

    // Read active backgrounds from profiles collection
    const profileDoc = await db.collection('profiles').findOne({ _id: discordId as any });
    if (profileDoc?.data) {
      const profileData = typeof profileDoc.data === 'string'
        ? JSON.parse(profileDoc.data)
        : profileDoc.data;
      activeBackground = profileData.active_background || 'default';
      activeRankBackground = profileData.active_rank_background || 'default';
    }
  }

  const enrichedItems = items.map((item) => ({
    ...item,
    owned: ownedItemIds.has(item.id),
    active: item.type === 'rank'
      ? activeRankBackground === item.id
      : activeBackground === item.id,
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
 * POST — Buy a background or equip/unequip it.
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

  if (action === 'equip') {
    return handleEquip(discordId, itemId);
  }

  // Default action: buy
  return handleBuy(request, discordId, itemId);
}

async function handleBuy(request: Request, discordId: string, itemId: string) {
  // Rate limit
  const rl = checkRateLimit(
    'mells_purchase',
    discordId,
    RATE_LIMITS.mells_purchase.maxRequests,
    RATE_LIMITS.mells_purchase.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // Anti-duplicate purchase lock
  const lockKey = `${discordId}:mells:${itemId}`;
  if (activePurchases.has(lockKey)) {
    return NextResponse.json({ error: 'Purchase already in progress' }, { status: 409 });
  }
  activePurchases.add(lockKey);

  try {
    // 1. Find item in DB
    const item = await findVendorItem('mells_selvair', itemId);
    if (!item) {
      return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
    }

    // 2. Check not already owned
    const client = await clientPromise;
    const db = client.db('Database');
    const inventoryDoc = await db.collection('inventory').findOne({ _id: discordId as any });
    const rawInventory = inventoryDoc?.data;
    const inventory: any[] = Array.isArray(rawInventory)
      ? rawInventory
      : typeof rawInventory === 'string'
        ? JSON.parse(rawInventory)
        : rawInventory ? [rawInventory] : [];

    const alreadyOwned = inventory.some((r: any) => r.id === itemId && r.shopId === 'mells_selvair');
    if (alreadyOwned) {
      return NextResponse.json({ error: 'You already own this background' }, { status: 400 });
    }

    // 3. Debt check
    const hasDebt = await checkDebt(discordId);
    if (hasDebt) {
      return NextResponse.json(
        { error: 'You have outstanding debt. Pay your debts first.' },
        { status: 403 }
      );
    }

    // 4. Balance check
    const balance = await getBalance(discordId);
    if (balance < item.price) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 5. Deduct Lunari
    const deduction = await deductLunari(discordId, item.price);
    if (!deduction.success) {
      return NextResponse.json({ error: 'Failed to deduct Lunari' }, { status: 500 });
    }

    // 6. Add to bank reserve
    void addToBankReserve(item.price);

    // 7. Save to inventory collection (st.db push pattern)
    const purchaseRecord = {
      id: item.id,
      name: item.name,
      price: item.price,
      roleId: '',
      description: '',
      shopId: 'mells_selvair',
      type: item.type,
      imageUrl: item.imageUrl,
      purchaseDate: new Date().toISOString(),
    };

    if (inventoryDoc) {
      await db.collection('inventory').updateOne(
        { _id: discordId as any },
        { $push: { data: purchaseRecord as any } }
      );
    } else {
      await db.collection('inventory').insertOne({
        _id: discordId as any,
        data: [purchaseRecord],
      } as any);
    }

    // 8. Log transaction
    void logTransaction({
      discordId,
      type: 'mells_purchase',
      amount: -item.price,
      balanceBefore: deduction.balanceBefore,
      balanceAfter: deduction.balanceAfter,
      metadata: {
        vendorId: 'mells_selvair',
        itemReceived: item.name,
        itemId: item.id,
        itemType: item.type,
      },
      createdAt: new Date(),
      source: 'web',
    });

    const response = NextResponse.json({
      success: true,
      item: item.name,
      newBalance: deduction.balanceAfter,
    });

    return refreshCsrf(response);
  } catch (err) {
    console.error('[mells] Purchase error:', err);
    return NextResponse.json(
      { error: 'Purchase failed. Please try again.' },
      { status: 500 }
    );
  } finally {
    activePurchases.delete(`${discordId}:mells:${itemId}`);
  }
}

async function handleEquip(discordId: string, itemId: string) {
  // Rate limit
  const rl = checkRateLimit(
    'mells_equip',
    discordId,
    RATE_LIMITS.mells_equip.maxRequests,
    RATE_LIMITS.mells_equip.windowMs
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  // 1. Find item in DB
  const item = await findVendorItem('mells_selvair', itemId);
  if (!item) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db('Database');

  // 2. Verify ownership from inventory
  const inventoryDoc = await db.collection('inventory').findOne({ _id: discordId as any });
  const rawInventory = inventoryDoc?.data;
  const inventory: any[] = Array.isArray(rawInventory)
    ? rawInventory
    : typeof rawInventory === 'string'
      ? JSON.parse(rawInventory)
      : rawInventory ? [rawInventory] : [];

  const owned = inventory.some((r: any) => r.id === itemId && r.shopId === 'mells_selvair');
  if (!owned) {
    return NextResponse.json({ error: 'You do not own this background' }, { status: 403 });
  }

  // 3. Read current profile
  const profileDoc = await db.collection('profiles').findOne({ _id: discordId as any });
  const profileData = profileDoc?.data
    ? (typeof profileDoc.data === 'string' ? JSON.parse(profileDoc.data) : { ...profileDoc.data })
    : {};

  // 4. Toggle active background — if already active, set to 'default'
  const isRank = item.type === 'rank';
  const field = isRank ? 'active_rank_background' : 'active_background';
  const currentActive = profileData[field] || 'default';
  const newValue = currentActive === itemId ? 'default' : itemId;

  profileData[field] = newValue;

  // 5. Write back to profiles collection
  if (profileDoc) {
    await db.collection('profiles').updateOne(
      { _id: discordId as any },
      { $set: { data: profileData } }
    );
  } else {
    await db.collection('profiles').insertOne({
      _id: discordId as any,
      data: profileData,
    } as any);
  }

  return NextResponse.json({
    success: true,
    active: newValue !== 'default',
    item: item.name,
    activeId: newValue,
  });
}
