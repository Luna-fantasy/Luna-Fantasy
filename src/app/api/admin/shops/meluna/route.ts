import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const DB_NAME = 'Database';
const DOC_ID = 'stonebox';

interface StoneEntry {
  name: string;
  weight: number;
  sell_price: number;
  imageUrl?: string;
  emoji_id?: string;
}

function validateStones(stones: unknown): string | null {
  if (!Array.isArray(stones)) return 'stones must be an array';
  if (stones.length > 100) return 'too many stones (max 100)';
  const seen = new Set<string>();
  for (let i = 0; i < stones.length; i++) {
    const s: any = stones[i];
    if (!s || typeof s !== 'object') return `stones[${i}] must be an object`;
    if (typeof s.name !== 'string' || !s.name.trim()) return `stones[${i}].name required`;
    const key = s.name.trim().toLowerCase();
    if (seen.has(key)) return `duplicate stone name: ${s.name}`;
    seen.add(key);
    if (typeof s.weight !== 'number' || s.weight < 0 || s.weight > 1000) {
      return `stones[${i}].weight must be 0-1000`;
    }
    if (typeof s.sell_price !== 'number' || !Number.isInteger(s.sell_price) || s.sell_price < 0 || s.sell_price > 10_000_000) {
      return `stones[${i}].sell_price must be an integer 0-10,000,000`;
    }
    if (s.imageUrl !== undefined && typeof s.imageUrl !== 'string') return `stones[${i}].imageUrl must be a string`;
    if (s.emoji_id !== undefined && typeof s.emoji_id !== 'string') return `stones[${i}].emoji_id must be a string`;
  }
  return null;
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('vendor_config');
    const doc = await col.findOne({ _id: DOC_ID as any });
    const data = (doc?.data as any) ?? {};
    return NextResponse.json({
      price: typeof data.price === 'number' ? data.price : 2000,
      refund_amount: typeof data.refund_amount === 'number'
        ? data.refund_amount
        : (typeof data.refundAmount === 'number' ? data.refundAmount : 1000),
      refund_chance: typeof data.refund_chance === 'number' ? data.refund_chance : 0.5,
      stones: Array.isArray(data.stones) ? data.stones : [],
      image: (data.image as string) ?? null,
      title: (data.title as string) ?? 'Meluna',
      description: (data.description as string) ?? '',
      updatedAt: doc?.updatedAt ?? null,
      updatedBy: doc?.updatedBy ?? null,
    });
  } catch (err) {
    console.error('Meluna admin GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: {
    price?: number;
    refund_amount?: number;
    refund_chance?: number;
    stones?: StoneEntry[];
    image?: string;
    title?: string;
    description?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const price = Math.floor(Number(body.price ?? 0));
  const refundAmount = Math.floor(Number(body.refund_amount ?? 0));
  const refundChance = Number(body.refund_chance ?? 0.5);

  if (!Number.isFinite(price) || price < 1 || price > 10_000_000) {
    return NextResponse.json({ error: 'price must be 1-10,000,000' }, { status: 400 });
  }
  if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > 10_000_000) {
    return NextResponse.json({ error: 'refund_amount must be 0-10,000,000' }, { status: 400 });
  }
  if (!Number.isFinite(refundChance) || refundChance < 0 || refundChance > 1) {
    return NextResponse.json({ error: 'refund_chance must be 0-1' }, { status: 400 });
  }

  const stones = Array.isArray(body.stones) ? body.stones.map((s) => ({
    name: String(s.name ?? '').trim().slice(0, 80),
    weight: Number(s.weight ?? 0),
    sell_price: Math.floor(Number(s.sell_price ?? 0)),
    ...(typeof s.imageUrl === 'string' ? { imageUrl: s.imageUrl.slice(0, 500) } : {}),
    ...(typeof s.emoji_id === 'string' ? { emoji_id: s.emoji_id.slice(0, 40) } : {}),
  })) : [];

  const err = validateStones(stones);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('vendor_config');
    const before = await col.findOne({ _id: DOC_ID as any });
    const beforeData = before?.data ?? {};
    const nextData = {
      ...beforeData,
      price,
      refund_amount: refundAmount,
      refund_chance: refundChance,
      stones,
      ...(typeof body.image === 'string' ? { image: body.image.slice(0, 500) } : {}),
      ...(typeof body.title === 'string' ? { title: body.title.slice(0, 120) } : {}),
      ...(typeof body.description === 'string' ? { description: body.description.slice(0, 600) } : {}),
    };

    await col.updateOne(
      { _id: DOC_ID as any },
      { $set: { data: nextData, updatedAt: new Date(), updatedBy: adminId } },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: 'meluna_stonebox_update',
      before: { price: beforeData.price, refund_amount: beforeData.refund_amount, stones: beforeData.stones ?? [] },
      after: { price, refund_amount: refundAmount, stones },
      metadata: { stoneCount: stones.length },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Meluna admin POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
