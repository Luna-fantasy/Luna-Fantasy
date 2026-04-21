import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { uploadObject, isR2Configured } from '@/lib/admin/r2';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const PNG_MAGIC  = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF]);
const WEBP_RIFF  = Buffer.from('RIFF');
const WEBP_SIG   = Buffer.from('WEBP');

function verifyImageMagicBytes(buf: Buffer, claimedType: string): boolean {
  if (buf.length < 12) return false;
  if (claimedType === 'image/png')  return buf.subarray(0, 4).equals(PNG_MAGIC);
  if (claimedType === 'image/jpeg') return buf.subarray(0, 3).equals(JPEG_MAGIC);
  if (claimedType === 'image/webp') return buf.subarray(0, 4).equals(WEBP_RIFF) && buf.subarray(8, 12).equals(WEBP_SIG);
  return false;
}

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const docs = await db.collection('seluna_vendor').find().toArray();

    // Parse documents
    const inventoryDoc = docs.find((d: any) => d.id === 'inventory_items');
    const activeShopsDoc = docs.find((d: any) => d.id === 'active_shops');
    const shopStocksDoc = docs.find((d: any) => d.id === 'shop_stocks');

    const inventoryItems = inventoryDoc?.value ?? [];
    const activeShops = activeShopsDoc?.value ?? {};
    const shopStocks = shopStocksDoc?.value ?? {};

    // Determine if there's a REAL active shop (non-dev, non-expired, non-cancelled)
    const now = Date.now();
    let activeShop: any = null;
    for (const [channelId, shop] of Object.entries(activeShops) as any) {
      if (channelId.startsWith('dev_')) continue;
      if (shop.isDev) continue;
      if (shop.cancelled || shop.manualClose) continue;
      if (shop.endTime && shop.endTime < now) continue;
      activeShop = { channelId, ...shop };
      break;
    }

    // Get current stock for active shop
    let currentStocks: Record<string, number> = {};
    if (activeShop && shopStocks[activeShop.channelId]) {
      currentStocks = shopStocks[activeShop.channelId];
    }

    return NextResponse.json({
      inventoryItems,
      isOpen: !!activeShop,
      activeShop,
      shopStocks: currentStocks,
    });
  } catch (error) {
    console.error('Seluna fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('seluna_vendor');

    if (action === 'add_item') {
      const { item } = body;
      if (!item?.type || !item?.name || item?.price === undefined) {
        return NextResponse.json({ error: 'type, name, and price are required' }, { status: 400 });
      }
      // Handle Background image upload to R2
      let backgroundUrl = item.backgroundUrl;
      if (item.type === 'Background' && item.imageData && item.contentType) {
        if (!isR2Configured()) {
          return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 500 });
        }
        const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowedImageTypes.includes(item.contentType)) {
          return NextResponse.json({ error: 'Invalid image type. Only PNG, JPEG, and WebP are allowed.' }, { status: 400 });
        }
        // Check base64 string length before decoding to prevent memory spikes
        // 5MB binary ≈ 6.67MB base64; use 7MB ceiling for padding
        if (typeof item.imageData !== 'string' || item.imageData.length > 7_000_000) {
          return NextResponse.json({ error: 'Image data too large (max 5MB)' }, { status: 400 });
        }
        const buffer = Buffer.from(item.imageData, 'base64');
        if (buffer.length > 5_000_000) {
          return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
        }
        // Verify file magic bytes match the claimed content type
        if (!verifyImageMagicBytes(buffer, item.contentType)) {
          return NextResponse.json({ error: 'File content does not match the claimed image type' }, { status: 400 });
        }
        const ext = item.contentType.split('/')[1] || 'png';
        const key = `backgrounds/seluna/${Date.now()}_${item.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
        backgroundUrl = await uploadObject(key, buffer, item.contentType);
      }

      const newItem: Record<string, any> = {
        id: `item_${Date.now()}`,
        type: item.type,
        name: item.name,
        price: Number(item.price),
        stock: item.stock !== undefined ? Number(item.stock) : -1,
        ...(item.rarity ? { rarity: item.rarity } : {}),
        ...(item.roleId ? { roleId: item.roleId } : {}),
        ...(item.amount ? { amount: Number(item.amount) } : {}),
        ...(item.description ? { description: item.description } : {}),
      };

      // Background-specific fields
      if (item.type === 'Background') {
        if (backgroundUrl) newItem.backgroundUrl = backgroundUrl;
        if (item.rankBackgroundUrl) newItem.rankBackgroundUrl = item.rankBackgroundUrl;
        if (item.backgroundType) newItem.backgroundType = item.backgroundType;
      }

      // Ensure inventory_items doc exists
      await col.updateOne(
        { id: 'inventory_items' },
        { $setOnInsert: { id: 'inventory_items', value: [] } },
        { upsert: true }
      );
      await col.updateOne(
        { id: 'inventory_items' },
        { $push: { value: newItem } as any }
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'seluna_add_item',
        before: null,
        after: newItem,
        metadata: { itemId: newItem.id },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true, item: newItem });

    } else if (action === 'remove_item') {
      const { itemId } = body;
      if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

      await col.updateOne(
        { id: 'inventory_items' },
        { $pull: { value: { id: itemId } } as any }
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'seluna_remove_item',
        before: { itemId },
        after: null,
        metadata: { itemId },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true });

    } else if (action === 'update_item') {
      const { itemId, updates } = body;
      if (!itemId || !updates) return NextResponse.json({ error: 'itemId and updates required' }, { status: 400 });

      // Read, modify, write back
      const doc = await col.findOne({ id: 'inventory_items' });
      const items = doc?.value ?? [];
      const idx = items.findIndex((i: any) => i.id === itemId);
      if (idx === -1) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      const before = { ...items[idx] };
      items[idx] = { ...items[idx], ...updates };

      await col.updateOne({ id: 'inventory_items' }, { $set: { value: items } });

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'seluna_update_item',
        before,
        after: items[idx],
        metadata: { itemId },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true, item: items[idx] });

    } else if (action === 'force_close') {
      // Close all active shops by setting manualClose flag
      const doc = await col.findOne({ id: 'active_shops' });
      if (doc?.value) {
        const shops = { ...doc.value };
        for (const key of Object.keys(shops)) {
          shops[key] = { ...shops[key], manualClose: true, cancelled: true };
        }
        await col.updateOne({ id: 'active_shops' }, { $set: { value: shops } });
      }

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'seluna_force_close',
        before: null,
        after: { action: 'force_close' },
        metadata: {},
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Seluna action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
