import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import {
  listItems, createItem, getItem,
  ITEM_CATEGORIES, RARITIES, slugifyKey, type ItemCategory, type Rarity,
} from '@/lib/admin/vaelcroft';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const sp = req.nextUrl.searchParams;
    const categoryRaw = sp.get('category');
    const category = (categoryRaw && ITEM_CATEGORIES.includes(categoryRaw as ItemCategory))
      ? (categoryRaw as ItemCategory)
      : undefined;
    const activeOnly = sp.get('activeOnly') === '1';
    const rows = await listItems({ category, activeOnly });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('Vaelcroft items list error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const name = String(body.name ?? '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const key = slugifyKey(String(body.key ?? name));
  if (!key) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

  const category = String(body.category ?? '').toLowerCase() as ItemCategory;
  if (!ITEM_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  const rarity = String(body.rarity ?? '').toLowerCase() as Rarity;
  if (!RARITIES.includes(rarity)) return NextResponse.json({ error: 'Invalid rarity' }, { status: 400 });

  const price = Math.max(0, Math.floor(Number(body.price) || 0));
  const income_bonus = Math.max(0, Math.floor(Number(body.income_bonus) || 0));
  const image_url = String(body.image_url ?? '').slice(0, 500);
  const description = String(body.description ?? '').slice(0, 500);
  const active = body.active !== false;

  const existing = await getItem(key);
  if (existing) return NextResponse.json({ error: 'Key already exists' }, { status: 409 });

  try {
    await createItem({
      key, name, description, category, rarity, price, income_bonus, image_url, active,
    });
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error('Vaelcroft item create error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
