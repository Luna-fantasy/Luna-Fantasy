import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import {
  listProperties, createProperty, getProperty,
  PROPERTY_TIERS, slugifyKey, type PropertyTier, type SlotRule,
} from '@/lib/admin/vaelcroft';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;
  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 60, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const activeOnly = req.nextUrl.searchParams.get('activeOnly') === '1';
    const rows = await listProperties({ activeOnly });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('Vaelcroft properties list error:', err);
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
  const keyInput = String(body.key ?? name).trim();
  const key = slugifyKey(keyInput);
  if (!key) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

  const tier = String(body.tier ?? '').toLowerCase() as PropertyTier;
  if (!PROPERTY_TIERS.includes(tier)) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

  const price = Math.max(0, Math.floor(Number(body.price) || 0));
  const base_income = Math.max(0, Math.floor(Number(body.base_income) || 0));
  const image_url = String(body.image_url ?? '').slice(0, 500);
  const description = String(body.description ?? '').slice(0, 500);
  const active = body.active !== false;
  const slot_rules_override = sanitizeSlotRule(body.slot_rules_override);

  const existing = await getProperty(key);
  if (existing) return NextResponse.json({ error: 'Key already exists' }, { status: 409 });

  try {
    await createProperty({
      key, name, description, tier, price, base_income, image_url, active,
      slot_rules_override: slot_rules_override ?? null,
    });
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error('Vaelcroft property create error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function sanitizeSlotRule(raw: unknown): SlotRule | null {
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
