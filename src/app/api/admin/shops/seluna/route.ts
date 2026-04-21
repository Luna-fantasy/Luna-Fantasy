import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const DB_NAME = 'Database';

interface SelunaItem {
  id: string;
  type: 'card' | 'stone' | 'role' | 'tickets' | 'background';
  name: string;
  price: number;
  stock: number;
  rarity?: string;
  attack?: number;
  amount?: number;
  roleId?: string;
  imageUrl?: string;
  description?: string;
}

interface EnrichedSelunaItem extends SelunaItem {
  thumbnail?: string;
}

function sanitizeString(v: unknown, maxLen: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, maxLen);
}

function validateItems(items: unknown): string | null {
  if (!Array.isArray(items)) return 'items must be an array';
  if (items.length > 50) return 'too many items (max 50)';
  const seen = new Set<string>();
  const validTypes = new Set(['card', 'stone', 'role', 'tickets', 'background']);
  for (let i = 0; i < items.length; i++) {
    const it: any = items[i];
    if (!it || typeof it !== 'object') return `items[${i}] must be an object`;
    if (typeof it.id !== 'string' || !it.id) return `items[${i}].id required`;
    if (seen.has(it.id)) return `duplicate item id: ${it.id}`;
    seen.add(it.id);
    if (!validTypes.has(it.type)) return `items[${i}].type must be card|stone|role|tickets|background`;
    if (typeof it.name !== 'string' || !it.name) return `items[${i}].name required`;
    if (typeof it.price !== 'number' || it.price < 1 || it.price > 100_000_000) return `items[${i}].price must be 1-100,000,000`;
    if (typeof it.stock !== 'number' || it.stock < -1 || it.stock > 100_000) return `items[${i}].stock must be -1 (unlimited) or 0-100,000`;
    if (it.type === 'role' && (!it.roleId || typeof it.roleId !== 'string')) return `items[${i}].roleId required for role items`;
    if (it.type === 'tickets' && (typeof it.amount !== 'number' || it.amount < 1)) return `items[${i}].amount required for ticket items`;
    if (it.type === 'background' && (!it.imageUrl || typeof it.imageUrl !== 'string')) return `items[${i}].imageUrl required for background items`;
  }
  return null;
}

async function buildThumbnailResolver(db: any) {
  // Preload card + stone image maps once per GET
  const cardImages = new Map<string, string>();
  try {
    const rarityDocs = await db.collection('cards_config').find({}).toArray();
    for (const doc of rarityDocs) {
      const items = Array.isArray(doc?.items) ? doc.items : [];
      for (const c of items) {
        if (c?.name && c?.imageUrl) {
          cardImages.set(`${String(c.name).toLowerCase()}|${String(doc._id).toUpperCase()}`, String(c.imageUrl));
          cardImages.set(String(c.name).toLowerCase(), String(c.imageUrl));
        }
      }
    }
  } catch {}

  const stoneImages = new Map<string, string>();
  try {
    const moonDoc = await db.collection('bot_config').findOne({ _id: 'jester_moon_stones' as any });
    const moonData = moonDoc?.data ?? {};
    const stoneLists = [
      ...(Array.isArray(moonData.stones) ? moonData.stones : []),
      ...(Array.isArray(moonData.forbidden_stones) ? moonData.forbidden_stones : []),
    ];
    for (const s of stoneLists) {
      if (s?.name && s?.imageUrl) {
        stoneImages.set(String(s.name).toLowerCase(), String(s.imageUrl));
      }
    }
  } catch {}

  return (item: SelunaItem): string | null => {
    const t = (item.type || '').toLowerCase();
    if (t === 'card') {
      const key = item.rarity
        ? `${item.name.toLowerCase()}|${item.rarity.toUpperCase()}`
        : item.name.toLowerCase();
      return cardImages.get(key) ?? cardImages.get(item.name.toLowerCase()) ?? null;
    }
    if (t === 'stone') {
      return stoneImages.get(item.name.toLowerCase()) ?? null;
    }
    if (t === 'background') {
      return item.imageUrl ?? null;
    }
    if (t === 'tickets') {
      return 'https://assets.lunarian.app/jester/shops/zoldar_mooncarver.png';
    }
    return null;
  };
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', adminId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('seluna_vendor');

    const [shopDoc, itemsDoc, stocksDoc, scheduleDoc, adminConfigDoc, settingsDoc] = await Promise.all([
      col.findOne({ id: 'active_shops' }),
      col.findOne({ id: 'inventory_items' }),
      col.findOne({ id: 'shop_stocks' }),
      col.findOne({ id: 'schedule' }),
      col.findOne({ id: 'admin_config' }),
      col.findOne({ id: 'settings' }),
    ]);

    const shopsMap = shopDoc?.value ?? {};
    let startTime = 0, endTime = 0, nextAppearTime = 0;
    for (const [key, ch] of Object.entries(shopsMap) as [string, any][]) {
      if (ch?.isDev || key.startsWith('dev_')) continue;
      if (ch?.startTime) {
        const st = typeof ch.startTime === 'number' ? ch.startTime : new Date(ch.startTime).getTime();
        const et = typeof ch.endTime === 'number' ? ch.endTime : new Date(ch.endTime).getTime();
        if (st > startTime) {
          startTime = st;
          endTime = et;
          nextAppearTime = typeof ch.nextAppearTime === 'number' ? ch.nextAppearTime : 0;
        }
      }
    }

    const now = Date.now();
    const active = startTime > 0 && now >= startTime && now < endTime;

    const rawItems: SelunaItem[] = Array.isArray(itemsDoc?.value) ? itemsDoc.value : [];
    const resolveThumb = await buildThumbnailResolver(db);
    const items: EnrichedSelunaItem[] = rawItems.map((it) => ({
      ...it,
      thumbnail: resolveThumb(it) ?? undefined,
    }));

    const schedule = scheduleDoc?.value ?? { duration_hours: 24, reappear_days: 30 };
    const adminConfig = adminConfigDoc?.value ?? { channels: [], guildId: '' };

    // Fallback: if no admin_config.channels, surface any non-dev active_shops channel keys
    let channels: string[] = Array.isArray(adminConfig.channels) ? adminConfig.channels : [];
    if (channels.length === 0) {
      const discovered = Object.keys(shopsMap).filter((k) => {
        const v = shopsMap[k];
        return !v?.isDev && !k.startsWith('dev_') && /^\d{17,20}$/.test(k);
      });
      channels = discovered;
    }

    const settings = (settingsDoc?.value ?? {}) as {
      title?: string; description?: string; image?: string; imageVersion?: number;
    };

    // Pre-populate with canonical defaults so the editor never flashes empty.
    // Matches LunaJesterMain/config.ts:688-691 seluna_vendor persona.
    const SELUNA_DEFAULT_TITLE = 'Seluna - The Moonlight Merchant';
    const SELUNA_DEFAULT_DESCRIPTION =
      'Greetings, traveler. I am Seluna, keeper of rare treasures beneath the moonlight. My shop appears only once each month for 24 hours. Choose wisely.';
    const SELUNA_DEFAULT_IMAGE = 'https://assets.lunarian.app/jester/icons/seluna.png';

    return NextResponse.json({
      active,
      startTime: startTime || null,
      endTime: active ? endTime : null,
      nextOpenAt: !active && nextAppearTime > now ? nextAppearTime : null,
      items,
      schedule,
      channels,
      guildId: typeof adminConfig.guildId === 'string' ? adminConfig.guildId : '',
      settings: {
        title: (typeof settings.title === 'string' && settings.title.trim())
          ? settings.title
          : SELUNA_DEFAULT_TITLE,
        description: (typeof settings.description === 'string' && settings.description.trim())
          ? settings.description
          : SELUNA_DEFAULT_DESCRIPTION,
        image: (typeof settings.image === 'string' && settings.image.trim())
          ? settings.image
          : SELUNA_DEFAULT_IMAGE,
        imageVersion: typeof settings.imageVersion === 'number' ? settings.imageVersion : 20260414,
      },
    });
  } catch (err) {
    console.error('Seluna admin GET error:', err);
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
    action: 'set_items' | 'set_schedule' | 'force_open' | 'force_close' | 'set_channels' | 'set_settings';
    items?: SelunaItem[];
    schedule?: { duration_hours: number; reappear_days: number };
    duration_hours?: number;
    channels?: string[];
    guildId?: string;
    settings?: { title?: string; description?: string; image?: string; imageVersion?: number };
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const col = db.collection('seluna_vendor');

  try {
    if (body.action === 'set_settings') {
      const s = body.settings ?? {};
      const cleaned = {
        title: typeof s.title === 'string' ? s.title.slice(0, 160) : '',
        description: typeof s.description === 'string' ? s.description.slice(0, 800) : '',
        image: typeof s.image === 'string' ? s.image.split('?')[0].slice(0, 500) : '',
        imageVersion: typeof s.imageVersion === 'number' && Number.isFinite(s.imageVersion) ? Math.floor(s.imageVersion) : Date.now(),
      };

      const before = await col.findOne({ id: 'settings' });
      await col.updateOne(
        { id: 'settings' },
        { $set: { value: cleaned, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true },
      );

      // Ask the bot to edit any open Discord shop messages so they reflect the new portrait/title/description.
      await col.updateOne(
        { id: 'admin_queue' },
        {
          $set: {
            value: {
              actionId: Date.now(),
              action: 'update_message',
              processed: false,
              issuedBy: adminId,
            },
            updatedAt: new Date(),
            updatedBy: adminId,
          },
        },
        { upsert: true },
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: auth.session.user?.globalName ?? 'Unknown',
        action: 'seluna_settings_update',
        before: { settings: before?.value ?? null },
        after: { settings: cleaned },
        metadata: { hasImage: !!cleaned.image, imageVersion: cleaned.imageVersion },
        ip: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'set_channels') {
      const channels = Array.isArray(body.channels)
        ? body.channels.filter((c) => typeof c === 'string' && /^\d{17,20}$/.test(c)).slice(0, 10)
        : [];
      const guildId = typeof body.guildId === 'string' && /^\d{17,20}$/.test(body.guildId) ? body.guildId : '';

      const before = await col.findOne({ id: 'admin_config' });
      await col.updateOne(
        { id: 'admin_config' },
        { $set: { value: { channels, guildId }, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true },
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: auth.session.user?.globalName ?? 'Unknown',
        action: 'seluna_channels_update',
        before: { channels: before?.value?.channels ?? [] },
        after: { channels, guildId },
        metadata: { count: channels.length },
        ip: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'force_open') {
      const hours = Math.max(1, Math.min(168, Math.floor(Number(body.duration_hours ?? 24))));
      const now = Date.now();
      const end = now + hours * 60 * 60 * 1000;

      // Read schedule to determine reappear_days for nextAppearTime
      const schedDoc = await col.findOne({ id: 'schedule' });
      const reappearDays = Math.max(1, Math.min(365, Number(schedDoc?.value?.reappear_days ?? 30)));
      const nextAppearTime = end + reappearDays * 24 * 60 * 60 * 1000;

      // 1. Website-facing admin_override entry (bazaar picks up immediately)
      const before = await col.findOne({ id: 'active_shops' });
      const current = (before?.value ?? {}) as Record<string, any>;
      current['admin_override'] = {
        startTime: now,
        endTime: end,
        nextAppearTime,
        isDev: false,
        openedBy: adminId,
      };

      await col.updateOne(
        { id: 'active_shops' },
        { $set: { value: current, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true },
      );

      // 2. Bot-facing admin queue — Jester poller picks this up and opens Discord shops
      const cfgDoc = await col.findOne({ id: 'admin_config' });
      const savedChannels = Array.isArray(cfgDoc?.value?.channels) ? cfgDoc.value.channels : [];
      const channels = Array.isArray(body.channels) && body.channels.length > 0
        ? body.channels.filter((c) => typeof c === 'string' && /^\d{17,20}$/.test(c)).slice(0, 10)
        : savedChannels;
      const guildId = body.guildId ?? cfgDoc?.value?.guildId ?? '';

      await col.updateOne(
        { id: 'admin_queue' },
        {
          $set: {
            value: {
              actionId: now,
              action: 'force_open',
              channels,
              guildId,
              duration_hours: hours,
              processed: false,
              issuedBy: adminId,
            },
            updatedAt: new Date(),
            updatedBy: adminId,
          },
        },
        { upsert: true },
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: auth.session.user?.globalName ?? 'Unknown',
        action: 'seluna_force_open',
        before: null,
        after: { startTime: now, endTime: end, duration_hours: hours, channels },
        metadata: { duration_hours: hours, channelCount: channels.length },
        ip: getClientIp(req),
      });

      return NextResponse.json({ success: true, startTime: now, endTime: end, channels });
    }

    if (body.action === 'force_close') {
      const now = Date.now();
      const before = await col.findOne({ id: 'active_shops' });
      const current = (before?.value ?? {}) as Record<string, any>;

      // Set endTime=now on all non-dev entries to close them immediately (website view)
      for (const [k, v] of Object.entries(current) as [string, any][]) {
        if (v?.isDev || k.startsWith('dev_')) continue;
        current[k] = { ...v, endTime: now };
      }

      await col.updateOne(
        { id: 'active_shops' },
        { $set: { value: current, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true },
      );

      // Tell the bot to mirror the close across Discord channels
      await col.updateOne(
        { id: 'admin_queue' },
        {
          $set: {
            value: {
              actionId: now,
              action: 'force_close',
              processed: false,
              issuedBy: adminId,
            },
            updatedAt: new Date(),
            updatedBy: adminId,
          },
        },
        { upsert: true },
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: auth.session.user?.globalName ?? 'Unknown',
        action: 'seluna_force_close',
        before: null,
        after: { closedAt: now },
        metadata: { closedAt: now },
        ip: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'set_items') {
      const items = body.items;
      if (!items) return NextResponse.json({ error: 'items required' }, { status: 400 });
      const cleaned = items.map((it) => ({
        id: sanitizeString(it.id, 60).replace(/[^a-z0-9_-]/gi, ''),
        type: it.type,
        name: sanitizeString(it.name, 100),
        price: Math.floor(Number(it.price ?? 0)),
        stock: Math.floor(Number(it.stock ?? 0)),
        rarity: it.rarity ? sanitizeString(it.rarity, 20) : undefined,
        attack: typeof it.attack === 'number' ? Math.floor(it.attack) : undefined,
        amount: typeof it.amount === 'number' ? Math.floor(it.amount) : undefined,
        roleId: it.roleId ? sanitizeString(it.roleId, 25) : undefined,
        imageUrl: it.imageUrl ? sanitizeString(it.imageUrl, 500) : undefined,
        description: it.description ? sanitizeString(it.description, 300) : undefined,
      }));
      const err = validateItems(cleaned);
      if (err) return NextResponse.json({ error: err }, { status: 400 });

      const before = await col.findOne({ id: 'inventory_items' });
      await col.updateOne(
        { id: 'inventory_items' },
        { $set: { value: cleaned, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true },
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: auth.session.user?.globalName ?? 'Unknown',
        action: 'seluna_items_update',
        before: { items: before?.value ?? [] },
        after: { items: cleaned },
        metadata: { count: cleaned.length },
        ip: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'set_schedule') {
      const s = body.schedule;
      if (!s) return NextResponse.json({ error: 'schedule required' }, { status: 400 });
      const duration_hours = Math.max(1, Math.min(168, Math.floor(Number(s.duration_hours ?? 24))));
      const reappear_days = Math.max(1, Math.min(365, Math.floor(Number(s.reappear_days ?? 30))));
      const cleaned = { duration_hours, reappear_days };

      const before = await col.findOne({ id: 'schedule' });
      await col.updateOne(
        { id: 'schedule' },
        { $set: { value: cleaned, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true },
      );

      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: auth.session.user?.globalName ?? 'Unknown',
        action: 'seluna_schedule_update',
        before: { schedule: before?.value ?? null },
        after: { schedule: cleaned },
        metadata: cleaned,
        ip: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('Seluna admin POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
