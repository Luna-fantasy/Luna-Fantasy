import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import {
  getLuckboxShopConfigAll,
  getStoneBoxConfig,
  getTicketShopConfig,
  saveLuckboxConfig,
  saveStoneBoxConfig,
  saveTicketConfig,
} from '@/lib/bazaar/shop-config';
import type { LuckboxBoxConfig, StoneConfig, TicketPackage } from '@/types/bazaar';

// ── Validation helpers ──

const MAX_PRICE = 1_000_000;
const MAX_LABEL_LEN = 50;
const MAX_NAME_LEN = 80;
const VALID_RARITIES = ['common', 'rare', 'epic', 'unique', 'legendary', 'secret', 'forbidden'];

function sanitizeString(s: string, maxLen: number): string {
  return String(s).replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

function validateLuckboxTiers(tiers: unknown): { valid: boolean; error?: string; data?: LuckboxBoxConfig[] } {
  if (!Array.isArray(tiers)) return { valid: false, error: 'tiers must be an array' };
  if (tiers.length === 0) return { valid: false, error: 'At least one tier is required' };
  if (tiers.length > 20) return { valid: false, error: 'Maximum 20 tiers allowed' };

  const result: LuckboxBoxConfig[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!t || typeof t !== 'object') return { valid: false, error: `Tier ${i}: invalid object` };

    const id = sanitizeString(String(t.id ?? ''), 30);
    if (!id || id.length < 1) return { valid: false, error: `Tier ${i}: id required` };
    if (ids.has(id)) return { valid: false, error: `Tier ${i}: duplicate id "${id}"` };
    ids.add(id);

    const label = sanitizeString(String(t.label ?? ''), MAX_LABEL_LEN);
    if (!label) return { valid: false, error: `Tier ${i}: label required` };

    const price = Number(t.price);
    if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE) {
      return { valid: false, error: `Tier ${i}: price must be 1-${MAX_PRICE}` };
    }

    if (!Array.isArray(t.rarities) || t.rarities.length === 0) {
      return { valid: false, error: `Tier ${i}: at least one rarity required` };
    }
    if (t.rarities.length > 6) {
      return { valid: false, error: `Tier ${i}: maximum 6 rarities per box` };
    }

    let totalPct = 0;
    const rarities: { rarity: string; percentage: number }[] = [];
    for (const r of t.rarities) {
      const rarity = sanitizeString(String(r.rarity ?? ''), 20).toLowerCase();
      if (!VALID_RARITIES.includes(rarity)) {
        return { valid: false, error: `Tier ${i}: invalid rarity "${rarity}"` };
      }
      const pct = Number(r.percentage);
      if (!Number.isFinite(pct) || pct < 0.1 || pct > 100) {
        return { valid: false, error: `Tier ${i}: percentage must be 0.1-100` };
      }
      totalPct += pct;
      rarities.push({ rarity, percentage: pct });
    }

    if (totalPct > 100.01) {
      return { valid: false, error: `Tier ${i}: rarity percentages cannot exceed 100 (got ${totalPct})` };
    }

    result.push({
      id,
      label,
      price: Math.round(price),
      rarities,
      enabled: t.enabled !== false,
      order: typeof t.order === 'number' ? t.order : i,
    });
  }

  return { valid: true, data: result };
}

function validateStoneConfig(body: unknown): { valid: boolean; error?: string; data?: { price: number; refundAmount: number; stones: StoneConfig[] } } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid body' };
  const b = body as any;

  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE) {
    return { valid: false, error: `price must be 1-${MAX_PRICE}` };
  }

  const refundAmount = Number(b.refundAmount);
  if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > price) {
    return { valid: false, error: 'refundAmount must be 0 to price' };
  }

  if (!Array.isArray(b.stones) || b.stones.length === 0) {
    return { valid: false, error: 'At least one stone required' };
  }
  if (b.stones.length > 30) {
    return { valid: false, error: 'Maximum 30 stones allowed' };
  }

  const stones: StoneConfig[] = [];
  for (let i = 0; i < b.stones.length; i++) {
    const s = b.stones[i];
    const name = sanitizeString(String(s.name ?? ''), MAX_NAME_LEN);
    if (!name) return { valid: false, error: `Stone ${i}: name required` };

    const weight = Number(s.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      return { valid: false, error: `Stone ${i}: weight must be 0-100` };
    }

    const sell_price = Number(s.sell_price);
    if (!Number.isFinite(sell_price) || sell_price < 0 || sell_price > MAX_PRICE) {
      return { valid: false, error: `Stone ${i}: sell_price must be 0-${MAX_PRICE}` };
    }

    const imageUrl = sanitizeString(String(s.imageUrl ?? ''), 500);

    stones.push({ name, weight, sell_price, imageUrl });
  }

  return { valid: true, data: { price: Math.round(price), refundAmount: Math.round(refundAmount), stones } };
}

function validateTicketPackages(packages: unknown): { valid: boolean; error?: string; data?: TicketPackage[] } {
  if (!Array.isArray(packages)) return { valid: false, error: 'packages must be an array' };
  if (packages.length === 0) return { valid: false, error: 'At least one package required' };
  if (packages.length > 10) return { valid: false, error: 'Maximum 10 packages allowed' };

  const result: TicketPackage[] = [];
  const ids = new Set<string>();

  for (let i = 0; i < packages.length; i++) {
    const p = packages[i];
    const id = sanitizeString(String(p.id ?? ''), 30);
    if (!id) return { valid: false, error: `Package ${i}: id required` };
    if (ids.has(id)) return { valid: false, error: `Package ${i}: duplicate id` };
    ids.add(id);

    const name = sanitizeString(String(p.name ?? ''), MAX_NAME_LEN);
    if (!name) return { valid: false, error: `Package ${i}: name required` };

    const tickets = Number(p.tickets);
    if (!Number.isInteger(tickets) || tickets < 1 || tickets > 100) {
      return { valid: false, error: `Package ${i}: tickets must be 1-100` };
    }

    const price = Number(p.price);
    if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE) {
      return { valid: false, error: `Package ${i}: price must be 1-${MAX_PRICE}` };
    }

    result.push({ id, name, tickets, price: Math.round(price) });
  }

  return { valid: true, data: result };
}

// ── GET: Fetch all shop configs ──

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  try {
    const [luckbox, stonebox, tickets] = await Promise.all([
      getLuckboxShopConfigAll(),
      getStoneBoxConfig(),
      getTicketShopConfig(),
    ]);

    return NextResponse.json({ luckbox, stonebox, tickets });
  } catch (error) {
    console.error('[admin/shops] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT: Update a shop config ──

export async function PUT(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  let body: { shop: string; config: any };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { shop, config } = body;
  if (!shop || !config) {
    return NextResponse.json({ error: 'shop and config required' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const adminName = authResult.session.user?.globalName ?? 'Unknown';

  try {
    switch (shop) {
      case 'luckbox': {
        const validation = validateLuckboxTiers(config.tiers ?? config);
        if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

        const before = await getLuckboxShopConfigAll();
        await saveLuckboxConfig(validation.data!);

        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'shop_config_update',
          before: { shop: 'luckbox', tiers: before },
          after: { shop: 'luckbox', tiers: validation.data },
          metadata: { shop: 'luckbox', tierCount: validation.data!.length },
          ip,
        });

        return NextResponse.json({ success: true, tiers: validation.data });
      }

      case 'stonebox': {
        const validation = validateStoneConfig(config);
        if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

        const before = await getStoneBoxConfig();
        await saveStoneBoxConfig(validation.data!);

        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'shop_config_update',
          before: { shop: 'stonebox', ...before },
          after: { shop: 'stonebox', ...validation.data },
          metadata: { shop: 'stonebox', stoneCount: validation.data!.stones.length },
          ip,
        });

        return NextResponse.json({ success: true, config: validation.data });
      }

      case 'tickets': {
        const validation = validateTicketPackages(config.packages ?? config);
        if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

        const before = await getTicketShopConfig();
        await saveTicketConfig(validation.data!);

        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'shop_config_update',
          before: { shop: 'tickets', packages: before },
          after: { shop: 'tickets', packages: validation.data },
          metadata: { shop: 'tickets', packageCount: validation.data!.length },
          ip,
        });

        return NextResponse.json({ success: true, packages: validation.data });
      }

      default:
        return NextResponse.json({ error: `Unknown shop: ${shop}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[admin/shops] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
