import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import {
  getLuckboxShopConfigAll,
  getStoneBoxConfig,
  getTicketShopConfig,
  getMellsShopConfig,
  getLunaMapConfig,
  saveLuckboxConfig,
  saveStoneBoxConfig,
  saveTicketConfig,
  saveMellsConfig,
  saveLunaMapConfig,
} from '@/lib/bazaar/shop-config';
import type { MellsShopItem, LunaMapConfig, LunaMapButton } from '@/lib/bazaar/shop-config';
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

    if (Math.abs(totalPct - 100) > 0.1) {
      return { valid: false, error: `Tier ${i}: rarity percentages must total 100 (got ${totalPct.toFixed(1)})` };
    }

    // Validate and pass through card overrides if present
    let cardOverrides: Record<string, { name: string; weight: number }[]> | undefined;
    if (t.cardOverrides && typeof t.cardOverrides === 'object') {
      cardOverrides = {};
      for (const [rarity, cards] of Object.entries(t.cardOverrides)) {
        if (!Array.isArray(cards) || cards.length === 0) continue;
        const validCards: { name: string; weight: number }[] = [];
        for (const c of cards as any[]) {
          if (!c?.name || typeof c.name !== 'string') continue;
          validCards.push({
            name: sanitizeString(String(c.name), 50),
            weight: Math.max(0, Number(c.weight) || 0),
          });
        }
        if (validCards.length > 0) {
          cardOverrides[rarity.toUpperCase()] = validCards;
        }
      }
      if (Object.keys(cardOverrides).length === 0) cardOverrides = undefined;
    }

    result.push({
      id,
      label,
      price: Math.round(price),
      rarities,
      enabled: t.enabled !== false,
      order: typeof t.order === 'number' ? t.order : i,
      ...(cardOverrides ? { cardOverrides } : {}),
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

    let imageUrl = sanitizeString(String(s.imageUrl ?? ''), 500);
    if (imageUrl) {
      try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) imageUrl = '';
      } catch { imageUrl = ''; }
    }

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
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const [luckbox, stonebox, tickets, mells, lunaMap] = await Promise.all([
      getLuckboxShopConfigAll(),
      getStoneBoxConfig(),
      getTicketShopConfig(),
      getMellsShopConfig(),
      getLunaMapConfig(),
    ]);

    return NextResponse.json({ luckbox, stonebox, tickets, mells, lunaMap });
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
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

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

  const ip = getClientIp(request);
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

      case 'mells': {
        if (!Array.isArray(config)) {
          return NextResponse.json({ error: 'Mells config must be an array of items' }, { status: 400 });
        }
        if (config.length > 100) {
          return NextResponse.json({ error: 'Maximum 100 items allowed' }, { status: 400 });
        }

        // Validate and sanitize items (same pattern as luckbox/stonebox/tickets)
        const mellsIds = new Set<string>();
        const sanitizedMells: MellsShopItem[] = [];
        for (const item of config) {
          if (!item.id || typeof item.id !== 'string' || !item.name || typeof item.name !== 'string' || typeof item.price !== 'number') {
            return NextResponse.json({ error: 'Each item must have id (string), name (string), and price (number)' }, { status: 400 });
          }
          const id = sanitizeString(String(item.id), 50);
          const name = sanitizeString(String(item.name), MAX_NAME_LEN);
          if (!id) return NextResponse.json({ error: 'Item id required after sanitization' }, { status: 400 });
          if (!name) return NextResponse.json({ error: 'Item name required after sanitization' }, { status: 400 });
          if (mellsIds.has(id)) {
            return NextResponse.json({ error: `Duplicate item id: "${id}"` }, { status: 400 });
          }
          mellsIds.add(id);
          if (item.price < 0 || item.price > MAX_PRICE * 10) {
            return NextResponse.json({ error: `Invalid price for "${name}"` }, { status: 400 });
          }
          if (item.description && typeof item.description !== 'string') {
            return NextResponse.json({ error: `Description for "${name}" must be a string` }, { status: 400 });
          }
          // Validate imageUrl protocol (prevent javascript: URLs)
          if (item.imageUrl && typeof item.imageUrl === 'string') {
            if (item.imageUrl.length > 500) {
              return NextResponse.json({ error: `Image URL for "${name}" is too long` }, { status: 400 });
            }
            try {
              const parsed = new URL(item.imageUrl);
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                return NextResponse.json({ error: `Image URL for "${name}" must use http or https` }, { status: 400 });
              }
            } catch {
              return NextResponse.json({ error: `Invalid image URL for "${name}"` }, { status: 400 });
            }
          }
          let validatedBackgroundUrl = '';
          if (item.backgroundUrl && typeof item.backgroundUrl === 'string') {
            validatedBackgroundUrl = sanitizeString(String(item.backgroundUrl), 500);
            if (validatedBackgroundUrl) {
              try {
                const parsed = new URL(validatedBackgroundUrl);
                if (!['http:', 'https:'].includes(parsed.protocol)) validatedBackgroundUrl = '';
              } catch { validatedBackgroundUrl = ''; }
            }
          }
          const validTypes = ['profile', 'rank'];
          const itemType = validTypes.includes(item.type) ? item.type : 'profile';
          const exclusive = typeof item.exclusive === 'boolean' ? item.exclusive : false;

          sanitizedMells.push({
            id,
            name,
            description: item.description ? sanitizeString(String(item.description), 500) : '',
            price: Math.round(item.price),
            roleId: item.roleId ? sanitizeString(String(item.roleId), 30) : '',
            backgroundUrl: validatedBackgroundUrl,
            type: itemType as 'profile' | 'rank',
            exclusive,
            enabled: item.enabled !== false,
          });
        }

        const before = await getMellsShopConfig();
        await saveMellsConfig(sanitizedMells);

        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'shop_config_update',
          before: { shop: 'mells', items: before },
          after: { shop: 'mells', items: sanitizedMells },
          metadata: { shop: 'mells', itemCount: sanitizedMells.length },
          ip,
        });

        return NextResponse.json({ success: true, items: sanitizedMells });
      }

      case 'lunamap': {
        if (!config || typeof config !== 'object') {
          return NextResponse.json({ error: 'Invalid luna map config' }, { status: 400 });
        }

        const mapConfig = config as any;
        const buttons = mapConfig.buttons;
        if (!Array.isArray(buttons) || buttons.length === 0 || buttons.length > 15) {
          return NextResponse.json({ error: 'buttons must be an array of 1-15 items' }, { status: 400 });
        }

        const sanitizedButtons: LunaMapButton[] = [];
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          const name = sanitizeString(String(b.name ?? ''), 80);
          if (!name) return NextResponse.json({ error: `Button ${i}: name required` }, { status: 400 });

          const btnStyle = Number(b.btnStyle);
          if (!Number.isInteger(btnStyle) || btnStyle < 1 || btnStyle > 4) {
            return NextResponse.json({ error: `Button ${i}: btnStyle must be 1-4` }, { status: 400 });
          }

          const emojiId = sanitizeString(String(b.emojiId ?? ''), 25);
          if (emojiId && !/^\d*$/.test(emojiId)) {
            return NextResponse.json({ error: `Button ${i}: emojiId must be digits only` }, { status: 400 });
          }

          const btn: LunaMapButton = { name, btnStyle, emojiId };

          // Optional English name
          if (b.name_en) btn.name_en = sanitizeString(String(b.name_en), 80);

          if (b.menu && Array.isArray(b.menu)) {
            if (b.menu.length === 0 || b.menu.length > 25) {
              return NextResponse.json({ error: `Button ${i}: menu must have 1-25 entries` }, { status: 400 });
            }
            const menuItems = [];
            for (let j = 0; j < b.menu.length; j++) {
              const m = b.menu[j];
              const label = sanitizeString(String(m.label ?? ''), 80);
              if (!label) return NextResponse.json({ error: `Button ${i} menu ${j}: label required` }, { status: 400 });
              const content = sanitizeString(String(m.content ?? ''), 4000);
              let image = sanitizeString(String(m.image ?? ''), 500);
              if (image) {
                try {
                  const parsed = new URL(image);
                  if (!['http:', 'https:'].includes(parsed.protocol)) image = '';
                } catch { image = ''; }
              }
              // Optional English fields
              const label_en = m.label_en ? sanitizeString(String(m.label_en), 80) : undefined;
              const content_en = m.content_en ? sanitizeString(String(m.content_en), 4000) : undefined;
              menuItems.push({ label, content, image, ...(label_en ? { label_en } : {}), ...(content_en ? { content_en } : {}) });
            }
            btn.menu = menuItems;
          } else {
            if (b.content) btn.content = sanitizeString(String(b.content), 4000);
            if (b.content_en) btn.content_en = sanitizeString(String(b.content_en), 4000);
            if (b.image) {
              let image = sanitizeString(String(b.image), 500);
              try {
                const parsed = new URL(image);
                if (!['http:', 'https:'].includes(parsed.protocol)) image = '';
              } catch { image = ''; }
              btn.image = image;
            }
          }

          sanitizedButtons.push(btn);
        }

        const sanitizedMap: LunaMapConfig = {
          title: sanitizeString(String(mapConfig.title ?? ''), 200),
          ...(mapConfig.title_en ? { title_en: sanitizeString(String(mapConfig.title_en), 200) } : {}),
          description: sanitizeString(String(mapConfig.description ?? ''), 4000),
          ...(mapConfig.description_en ? { description_en: sanitizeString(String(mapConfig.description_en), 4000) } : {}),
          image: sanitizeString(String(mapConfig.image ?? ''), 500),
          buttons: sanitizedButtons,
        };

        const before = await getLunaMapConfig();
        await saveLunaMapConfig(sanitizedMap);

        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'shop_config_update',
          before: { shop: 'lunamap', config: before },
          after: { shop: 'lunamap', config: sanitizedMap },
          metadata: { shop: 'lunamap', buttonCount: sanitizedButtons.length },
          ip,
        });

        return NextResponse.json({ success: true, config: sanitizedMap });
      }

      default:
        return NextResponse.json({ error: `Unknown shop: ${shop}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[admin/shops] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
