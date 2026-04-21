import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import {
  getItem, updateItem, deleteItem,
  ITEM_CATEGORIES, RARITIES, type ItemCategory, type Rarity,
} from '@/lib/admin/vaelcroft';

export const dynamic = 'force-dynamic';

interface Ctx { params: { key: string } }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const key = String(ctx.params.key ?? '');
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

  const existing = await getItem(key);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 80);
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 500);
  if (typeof body.category === 'string') {
    const c = body.category.toLowerCase() as ItemCategory;
    if (!ITEM_CATEGORIES.includes(c)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    patch.category = c;
  }
  if (typeof body.rarity === 'string') {
    const r = body.rarity.toLowerCase() as Rarity;
    if (!RARITIES.includes(r)) return NextResponse.json({ error: 'Invalid rarity' }, { status: 400 });
    patch.rarity = r;
  }
  if (body.price != null) patch.price = Math.max(0, Math.floor(Number(body.price) || 0));
  if (body.income_bonus != null) patch.income_bonus = Math.max(0, Math.floor(Number(body.income_bonus) || 0));
  if (typeof body.image_url === 'string') patch.image_url = body.image_url.slice(0, 500);
  if (typeof body.active === 'boolean') patch.active = body.active;

  try {
    await updateItem(key, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Vaelcroft item patch error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  if (!(await validateCsrf(req))) return NextResponse.json({ error: 'CSRF' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const key = String(ctx.params.key ?? '');
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

  try {
    const res = await deleteItem(key);
    if (res.placedCount > 0) {
      return NextResponse.json({ error: `Cannot delete — ${res.placedCount} user(s) own this item.` }, { status: 409 });
    }
    if (!res.deletedCatalog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Vaelcroft item delete error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
