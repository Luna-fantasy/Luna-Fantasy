import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { uploadObject, deleteObject, isR2Configured } from '@/lib/admin/r2';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

interface JesterStone {
  name: string;
  imageUrl: string;
  weight: number;
  sell_price: number;
  emoji_id: string;
}

interface ForbiddenStone {
  name: string;
  imageUrl: string;
  weight: number;
  hint: string;
  sell_price: number;
  gift_role_id: string;
  emoji_id: string;
  give_command: string[];
  giver_title: string;
}

interface MoonStonesConfig {
  stones: JesterStone[];
  forbidden_stones: ForbiddenStone[];
  box: { price: number; refund_chance: number; refund_amount: number };
  allowed_roles: string[];
  completion_reward: { role_id: string };
  full_completion_role_id: string;
}

/**
 * Calculate drop percentages from stone weights (same logic as Jester bot).
 */
function calcDropRates(stones: JesterStone[]): Map<string, number> {
  const drawableStones = stones.filter((s) => s.weight > 0);
  const totalWeight = drawableStones.reduce((sum, s) => {
    const entries = Math.max(1, Math.round(s.weight * 1000));
    return sum + entries;
  }, 0);

  const rates = new Map<string, number>();
  for (const s of stones) {
    if (s.weight === 0) {
      rates.set(s.name, 0);
    } else {
      const entries = Math.max(1, Math.round(s.weight * 1000));
      rates.set(s.name, Math.round((entries / totalWeight) * 10000) / 100);
    }
  }
  return rates;
}

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);

    // Read moon_stones from bot_config
    const configDoc = await db.collection('bot_config').findOne({ _id: 'jester_moon_stones' as any });
    const moonStones: MoonStonesConfig | null = configDoc?.data ?? null;

    if (!moonStones || !moonStones.stones) {
      return NextResponse.json({ error: 'Moon stones config not found in database' }, { status: 500 });
    }

    const dropRates = calcDropRates(moonStones.stones);

    const stones = moonStones.stones.map((s) => ({
      ...s,
      dropPercent: dropRates.get(s.name) ?? 0,
    }));

    const forbiddenStones = moonStones.forbidden_stones ?? [];

    // Get ownership distribution from MongoDB
    let distribution: any[] = [];
    let totalOwners = 0;
    try {
      const pipeline = [
        {
          $project: {
            stoneArr: {
              $cond: {
                if: { $isArray: '$stones' },
                then: '$stones',
                else: {
                  $cond: {
                    if: { $and: [{ $ne: ['$data', null] }, { $isArray: '$data.stones' }] },
                    then: '$data.stones',
                    else: []
                  }
                }
              }
            }
          }
        },
        { $unwind: '$stoneArr' },
        { $group: { _id: '$stoneArr.name', count: { $sum: 1 }, owners: { $addToSet: '$_id' } } },
        { $project: { name: '$_id', count: 1, ownerCount: { $size: '$owners' } } },
        { $sort: { count: -1 as const } },
      ];
      distribution = await db.collection('stones').aggregate(pipeline).toArray();
      totalOwners = await db.collection('stones').countDocuments();
    } catch {
      // If aggregation fails, just return empty distribution
    }

    return NextResponse.json({ stones, forbiddenStones, distribution, totalOwners });
  } catch (error) {
    console.error('Stones config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const botConfigCol = db.collection('bot_config');

    // Helper: read current moon_stones from bot_config
    const getMoonStones = async (): Promise<MoonStonesConfig | null> => {
      const doc = await botConfigCol.findOne({ _id: 'jester_moon_stones' as any });
      return doc?.data ?? null;
    };

    // Helper: write moon_stones to ALL collections the bot reads from
    const saveMoonStones = async (moonStones: MoonStonesConfig): Promise<void> => {
      // 1. bot_config — dashboard's canonical store
      await botConfigCol.updateOne(
        { _id: 'jester_moon_stones' as any },
        { $set: { data: moonStones, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true }
      );

      // 2. stones_config — bot reads via stones_config_db.ts
      await db.collection('stones_config').updateOne(
        { _id: 'regular' as any },
        { $set: { items: moonStones.stones } },
        { upsert: true }
      );
      await db.collection('stones_config').updateOne(
        { _id: 'forbidden' as any },
        { $set: { items: moonStones.forbidden_stones } },
        { upsert: true }
      );

      // 3. vendor_config — bot reads via vendor_config_db.ts for shop settings
      await db.collection('vendor_config').updateOne(
        { _id: 'stonebox' as any },
        {
          $set: {
            data: {
              price: moonStones.box?.price ?? 2000,
              refund_chance: moonStones.box?.refund_chance ?? 0.5,
              refund_amount: moonStones.box?.refund_amount ?? 1000,
              stones: moonStones.stones.map(s => ({
                name: s.name,
                weight: s.weight,
                sell_price: s.sell_price,
              })),
            },
          },
        },
        { upsert: true }
      );
    };

    if (action === 'update_stone') {
      const { name, weight, sell_price, emoji_id } = body;
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Stone name is required' }, { status: 400 });
      }

      const moonStones = await getMoonStones();
      if (!moonStones) {
        return NextResponse.json({ error: 'Moon stones config not found in database' }, { status: 500 });
      }

      let stoneIdx = moonStones.stones.findIndex((s) => s.name === name);
      let isForbidden = false;
      if (stoneIdx === -1) {
        stoneIdx = moonStones.forbidden_stones.findIndex((s) => s.name === name);
        isForbidden = true;
      }
      if (stoneIdx === -1) {
        return NextResponse.json({ error: `Stone "${name}" not found` }, { status: 404 });
      }

      const targetArr = isForbidden ? moonStones.forbidden_stones : moonStones.stones;
      const before = { ...targetArr[stoneIdx] };

      if (weight !== undefined) targetArr[stoneIdx].weight = Number(weight);
      if (sell_price !== undefined) targetArr[stoneIdx].sell_price = Number(sell_price);
      if (emoji_id !== undefined) targetArr[stoneIdx].emoji_id = String(emoji_id);

      await saveMoonStones(moonStones);

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'stones_update_stone',
        before,
        after: targetArr[stoneIdx],
        metadata: { stoneName: name, isForbidden },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true, stone: targetArr[stoneIdx] });

    } else if (action === 'update_image') {
      const { name, imageData, contentType } = body;
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Stone name is required' }, { status: 400 });
      }
      if (!imageData || typeof imageData !== 'string') {
        return NextResponse.json({ error: 'Image data (base64) is required' }, { status: 400 });
      }

      if (!isR2Configured()) {
        return NextResponse.json({ error: 'R2 storage is not configured' }, { status: 503 });
      }

      const moonStones = await getMoonStones();
      if (!moonStones) {
        return NextResponse.json({ error: 'Moon stones config not found in database' }, { status: 500 });
      }

      let stoneIdx = moonStones.stones.findIndex((s) => s.name === name);
      let isForbidden = false;
      if (stoneIdx === -1) {
        stoneIdx = moonStones.forbidden_stones.findIndex((s) => s.name === name);
        isForbidden = true;
      }
      if (stoneIdx === -1) {
        return NextResponse.json({ error: `Stone "${name}" not found` }, { status: 404 });
      }

      const targetArr = isForbidden ? moonStones.forbidden_stones : moonStones.stones;
      const oldImageUrl = targetArr[stoneIdx].imageUrl;

      // Upload to R2
      const snakeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      const r2Key = `stones/${snakeName}.png`;
      const buffer = Buffer.from(imageData, 'base64');
      const mimeType = contentType || 'image/png';
      const publicUrl = await uploadObject(r2Key, buffer, mimeType);

      if (oldImageUrl?.startsWith('https://assets.lunarian.app/') && oldImageUrl !== publicUrl) {
        const oldKey = oldImageUrl.replace('https://assets.lunarian.app/', '');
        deleteObject(oldKey).catch(err => console.error('Failed to delete old stone R2 image:', err));
      }

      targetArr[stoneIdx].imageUrl = publicUrl;
      await saveMoonStones(moonStones);

      // Update all user stone records in MongoDB
      const updateResult = await db.collection('stones').updateMany(
        { 'stones': { $elemMatch: { name } } },
        { $set: { 'stones.$[elem].imageUrl': publicUrl } },
        { arrayFilters: [{ 'elem.name': name }] }
      );
      console.log(`Updated ${updateResult.modifiedCount} user stone records for ${name}`);

      // Legacy format
      const legacyCursor = db.collection('stones').find({
        'data.stones': { $elemMatch: { name } }
      });
      for await (const doc of legacyCursor) {
        const stonesArr = doc.data?.stones;
        if (!Array.isArray(stonesArr)) continue;
        let changed = false;
        for (const s of stonesArr) {
          if (s.name === name && s.imageUrl !== publicUrl) {
            s.imageUrl = publicUrl;
            changed = true;
          }
        }
        if (changed) {
          await db.collection('stones').updateOne(
            { _id: doc._id },
            { $set: { stones: stonesArr }, $unset: { data: "" } }
          );
        }
      }

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'stones_update_image',
        before: { name, imageUrl: oldImageUrl },
        after: { name, imageUrl: publicUrl },
        metadata: { stoneName: name, r2Key, userRecordsUpdated: updateResult.modifiedCount },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true, imageUrl: publicUrl, userRecordsUpdated: updateResult.modifiedCount });

    } else if (action === 'add_stone') {
      const { stone } = body;
      if (!stone || typeof stone !== 'object') {
        return NextResponse.json({ error: 'Stone object is required' }, { status: 400 });
      }
      const { name, weight, sell_price, emoji_id, type } = stone;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Stone name is required' }, { status: 400 });
      }
      if (weight === undefined || typeof Number(weight) !== 'number' || isNaN(Number(weight)) || Number(weight) < 0) {
        return NextResponse.json({ error: 'Weight must be a non-negative number' }, { status: 400 });
      }
      if (sell_price === undefined || typeof Number(sell_price) !== 'number' || isNaN(Number(sell_price)) || Number(sell_price) < 0) {
        return NextResponse.json({ error: 'Sell price must be a non-negative number' }, { status: 400 });
      }

      const moonStones = await getMoonStones();
      if (!moonStones) {
        return NextResponse.json({ error: 'Moon stones config not found in database' }, { status: 500 });
      }

      const allNames = [
        ...moonStones.stones.map((s) => s.name.toLowerCase()),
        ...moonStones.forbidden_stones.map((s) => s.name.toLowerCase()),
      ];
      if (allNames.includes(name.trim().toLowerCase())) {
        return NextResponse.json({ error: `A stone named "${name.trim()}" already exists` }, { status: 409 });
      }

      const isForbidden = type === 'forbidden';

      if (isForbidden) {
        const { hint, gift_role_id, giver_title } = stone;
        if (!hint || typeof hint !== 'string' || !hint.trim()) {
          return NextResponse.json({ error: 'Hint is required for forbidden stones' }, { status: 400 });
        }
        if (!gift_role_id || typeof gift_role_id !== 'string' || !/^\d{17,20}$/.test(gift_role_id)) {
          return NextResponse.json({ error: 'Valid gift_role_id is required for forbidden stones' }, { status: 400 });
        }
        if (!giver_title || typeof giver_title !== 'string' || !giver_title.trim()) {
          return NextResponse.json({ error: 'Giver title is required for forbidden stones' }, { status: 400 });
        }

        const newForbidden: ForbiddenStone = {
          name: name.trim(),
          imageUrl: '',
          weight: Number(weight),
          hint: hint.trim(),
          sell_price: Number(sell_price),
          gift_role_id,
          emoji_id: emoji_id ? String(emoji_id) : '',
          give_command: [],
          giver_title: giver_title.trim(),
        };
        moonStones.forbidden_stones.push(newForbidden);
      } else {
        const newStone: JesterStone = {
          name: name.trim(),
          imageUrl: '',
          weight: Number(weight),
          sell_price: Number(sell_price),
          emoji_id: emoji_id ? String(emoji_id) : '',
        };
        moonStones.stones.push(newStone);
      }

      await saveMoonStones(moonStones);

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'stones_add_stone',
        before: null,
        after: isForbidden ? moonStones.forbidden_stones[moonStones.forbidden_stones.length - 1] : moonStones.stones[moonStones.stones.length - 1],
        metadata: { stoneName: name.trim(), isForbidden },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true, name: name.trim() });

    } else if (action === 'delete_stone') {
      const { name } = body;
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Stone name is required' }, { status: 400 });
      }

      const moonStones = await getMoonStones();
      if (!moonStones) {
        return NextResponse.json({ error: 'Moon stones config not found in database' }, { status: 500 });
      }

      let stoneIdx = moonStones.stones.findIndex((s) => s.name === name);
      let isForbidden = false;
      if (stoneIdx === -1) {
        stoneIdx = moonStones.forbidden_stones.findIndex((s) => s.name === name);
        isForbidden = true;
      }
      if (stoneIdx === -1) {
        return NextResponse.json({ error: `Stone "${name}" not found` }, { status: 404 });
      }

      const targetArr = isForbidden ? moonStones.forbidden_stones : moonStones.stones;
      const deleted = targetArr.splice(stoneIdx, 1)[0];

      await saveMoonStones(moonStones);

      // Clean up R2 image (fire-and-forget)
      if (deleted.imageUrl?.startsWith('https://assets.lunarian.app/')) {
        const r2Key = deleted.imageUrl.replace('https://assets.lunarian.app/', '');
        deleteObject(r2Key).catch(err => console.error('Failed to delete stone R2 image:', err));
      }

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: authResult.session.user?.globalName ?? 'Unknown',
        action: 'stones_delete_stone',
        before: deleted,
        after: null,
        metadata: { stoneName: name, isForbidden },
        ip: getClientIp(request),
      });

      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Stones config update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
