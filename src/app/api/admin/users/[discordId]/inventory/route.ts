import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { creditLunari, getBalance } from '@/lib/bazaar/lunari-ops';
import { logTransaction } from '@/lib/bazaar/lunari-ops';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

function parseInventory(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try { const parsed = JSON.parse(data); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let body: { item: any; reason: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { item, reason } = body;
  if (!item || !item.name) return NextResponse.json({ error: 'Item must have a name' }, { status: 400 });
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('inventory');

    const doc = await col.findOne({ _id: discordId as any });
    const currentItems = doc ? parseInventory(doc.items ?? doc.data) : [];

    const newItem = {
      ...item,
      id: item.id ?? `admin_${Date.now()}`,
      shopId: item.shopId ?? 'admin',
      purchaseDate: new Date().toISOString(),
    };
    const updatedItems = [...currentItems, newItem];

    await col.updateOne(
      { _id: discordId as any },
      { $set: { items: updatedItems }, $unset: { data: '' } },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'inventory_give',
      targetDiscordId: discordId,
      before: { itemCount: currentItems.length },
      after: { itemCount: updatedItems.length, item: newItem },
      metadata: { reason, itemName: newItem.name },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, item: newItem });
  } catch (error) {
    console.error('Inventory give error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });

  let body: { itemId: string; reason: string; refund?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { itemId, reason, refund } = body;
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
  if (!reason || reason.length < 3) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('inventory');

    const doc = await col.findOne({ _id: discordId as any });
    if (!doc) return NextResponse.json({ error: 'User has no inventory' }, { status: 404 });

    // Migrate legacy st.db format (data field) → canonical items field
    // Same pattern used by Butler's InventoryManager.addItem()
    if (!Array.isArray(doc.items) && doc.data !== undefined) {
      const migrated = parseInventory(doc.data);
      await col.updateOne(
        { _id: discordId as any },
        { $set: { items: migrated }, $unset: { data: '' } }
      );
    }

    const currentItems = parseInventory(doc.items ?? doc.data);
    const removedItem = currentItems.find((it: any) => it.id === itemId);
    if (!removedItem) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Atomic $pull — prevents double-refund race conditions.
    // Uses findOneAndUpdate to get accurate post-pull document state.
    const result = await col.findOneAndUpdate(
      { _id: discordId as any, 'items.id': itemId },
      { $pull: { items: { id: itemId } } as any },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'Item already removed' }, { status: 404 });
    }

    const afterCount = Array.isArray(result.items) ? result.items.length : 0;

    // Handle refund if requested and item has a price
    let refundResult: { amount: number; balanceAfter: number } | null = null;
    if (refund && removedItem.price && Number(removedItem.price) > 0) {
      const refundAmount = Number(removedItem.price);
      const balanceBefore = await getBalance(discordId);
      const { balanceAfter } = await creditLunari(discordId, refundAmount);

      await logTransaction({
        discordId,
        type: 'admin_refund',
        amount: refundAmount,
        balanceBefore,
        balanceAfter,
        metadata: {
          itemReceived: removedItem.name,
          refundAmount,
          vendorId: removedItem.shopId ?? 'unknown',
        },
        source: 'web',
        createdAt: new Date(),
      });

      refundResult = { amount: refundAmount, balanceAfter };
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: refund ? 'inventory_remove_refund' : 'inventory_remove',
      targetDiscordId: discordId,
      before: { itemCount: currentItems.length, item: removedItem },
      after: { itemCount: afterCount, ...(refundResult ? { refund: refundResult } : {}) },
      metadata: { reason, itemName: removedItem.name, ...(refundResult ? { refundAmount: refundResult.amount } : {}) },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, removedItem, refund: refundResult });
  } catch (error) {
    console.error('Inventory remove error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
