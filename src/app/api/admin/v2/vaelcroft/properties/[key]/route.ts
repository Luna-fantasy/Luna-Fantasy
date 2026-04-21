import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import {
  getProperty, updateProperty, deleteProperty,
  PROPERTY_TIERS, type PropertyTier, type SlotRule,
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

  const existing = await getProperty(key);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const patch: any = {};
  if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 80);
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 500);
  if (typeof body.tier === 'string') {
    const t = body.tier.toLowerCase() as PropertyTier;
    if (!PROPERTY_TIERS.includes(t)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    patch.tier = t;
  }
  if (body.price != null) patch.price = Math.max(0, Math.floor(Number(body.price) || 0));
  if (body.base_income != null) patch.base_income = Math.max(0, Math.floor(Number(body.base_income) || 0));
  if (typeof body.image_url === 'string') patch.image_url = body.image_url.slice(0, 500);
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (body.slot_rules_override !== undefined) {
    patch.slot_rules_override = sanitizeSlotRule(body.slot_rules_override);
  }

  try {
    await updateProperty(key, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Vaelcroft property patch error:', err);
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
    const res = await deleteProperty(key);
    if (res.hadOwner) {
      return NextResponse.json({ error: 'Property is currently owned; force-foreclose from Ownership panel first.' }, { status: 409 });
    }
    if (!res.deletedCatalog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Vaelcroft property delete error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function sanitizeSlotRule(raw: unknown): SlotRule | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as any;
  const total = Number(obj.total);
  if (!Number.isFinite(total) || total <= 0 || total > 50) return null;
  const by_rarity: Partial<Record<string, number>> = {};
  for (const [k, v] of Object.entries(obj.by_rarity ?? {})) {
    if (!['common', 'rare', 'epic', 'unique', 'legendary'].includes(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 50) by_rarity[k] = Math.floor(n);
  }
  return { total: Math.floor(total), by_rarity: by_rarity as any };
}
