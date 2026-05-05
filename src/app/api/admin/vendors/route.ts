import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.includes(key) || key.startsWith('$') || key.includes('.')) continue;
    result[key] = sanitizeObject(value);
  }
  return result;
}

function validateVendorData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'data must be a non-null object';
  }

  const obj = data as Record<string, unknown>;

  // Validate prices — must be positive integers within bounds
  if (obj.prices !== undefined) {
    if (typeof obj.prices !== 'object' || obj.prices === null) return 'prices must be an object';
    for (const [key, val] of Object.entries(obj.prices as Record<string, unknown>)) {
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 10_000_000) {
        return `prices.${key} must be an integer between 1 and 10,000,000`;
      }
    }
  }

  // Validate weights — must be non-negative numbers within bounds
  if (obj.weights !== undefined) {
    if (typeof obj.weights !== 'object' || obj.weights === null) return 'weights must be an object';
    for (const [key, val] of Object.entries(obj.weights as Record<string, unknown>)) {
      if (typeof val !== 'number' || val < 0 || val > 1000) {
        return `weights.${key} must be a number between 0 and 1000`;
      }
    }
  }

  return null;
}

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_read', discordId, 30, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const vendors = await db.collection('vendor_config').find().toArray();
    return NextResponse.json({ vendors: vendors.map((v) => ({ id: v._id, ...v })) });
  } catch (error) {
    console.error('Vendor config error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: { vendorId: string; data: any };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { vendorId, data } = body;
  if (!vendorId || !data) return NextResponse.json({ error: 'vendorId and data required' }, { status: 400 });
  if (typeof vendorId !== 'string' || !/^[a-z0-9_-]{1,50}$/i.test(vendorId)) {
    return NextResponse.json({ error: 'vendorId must be alphanumeric (with - or _), max 50 chars' }, { status: 400 });
  }

  const sanitizedData = sanitizeObject(data);

  const validationError = validateVendorData(sanitizedData);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('vendor_config');

    const before = await col.findOne({ _id: vendorId as any });
    await col.updateOne({ _id: vendorId as any }, { $set: { data: sanitizedData } }, { upsert: true });

    // Mells Selvair lives in TWO collections — vendor_config holds the typed
    // schema (`imageUrl` + `type: 'profile'|'rank'`) used by the admin UI and
    // the public bazaar, while bot_config.butler_shop holds the legacy schema
    // (`backgroundUrl`/`rankBackgroundUrl`) that LunaButler reads at runtime.
    // The admin save endpoint used to update only vendor_config, which meant
    // every Mells edit silently failed to reach the Discord shop and items
    // added on the bot side never appeared on the dashboard. Mirror writes
    // here, translating the schema, so both sides stay aligned.
    if (vendorId === 'mells_selvair') {
      try {
        await mirrorMellsToButler(db, sanitizedData);
      } catch (mirrorErr) {
        // Don't fail the admin save just because the mirror write hiccuped —
        // the canonical write to vendor_config already landed. Log loudly so
        // it gets noticed; a manual resync is cheap.
        console.error('[vendors PUT] mells mirror to bot_config.butler_shop failed:', mirrorErr);
      }
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'vendor_config_update',
      before: { vendorId, data: before?.data },
      after: { vendorId, data: sanitizedData },
      metadata: { vendorId, mirroredTo: vendorId === 'mells_selvair' ? 'bot_config.butler_shop' : undefined },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vendor config update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Translate vendor_config.mells_selvair items (typed schema) → butler_shop
// items (legacy schema) and write to bot_config.butler_shop.
//
// Per-item translation:
//   { imageUrl: X, type: 'profile' } → { backgroundUrl: X }
//   { imageUrl: X, type: 'rank' }    → { rankBackgroundUrl: X }
//   no imageUrl                      → passed through (role-only items, etc.)
//
// Top-level fields (title/description/image) are forwarded verbatim. Anything
// not on the known list is preserved by spreading the source item, so legacy
// fields like `roleId`, `exclusive`, etc. survive the round trip.
async function mirrorMellsToButler(db: import('mongodb').Db, vendorData: any): Promise<void> {
  if (!vendorData || typeof vendorData !== 'object') return;
  const items = Array.isArray(vendorData.items) ? vendorData.items : [];
  const butlerItems = items.map((it: any) => {
    const base: Record<string, unknown> = {
      id: it.id,
      name: it.name,
      description: it.description ?? '',
      price: it.price,
      roleId: it.roleId ?? '',
    };
    if (it.exclusive) base.exclusive = it.exclusive;
    if (it.imageUrl) {
      if (it.type === 'rank') base.rankBackgroundUrl = it.imageUrl;
      else base.backgroundUrl = it.imageUrl;
    } else {
      // Pre-translation items (already legacy shape) — pass through unchanged.
      if (it.backgroundUrl) base.backgroundUrl = it.backgroundUrl;
      if (it.rankBackgroundUrl) base.rankBackgroundUrl = it.rankBackgroundUrl;
    }
    return base;
  });

  await db.collection('bot_config').updateOne(
    { _id: 'butler_shop' as any },
    {
      $set: {
        'data.items': butlerItems,
        'data.title': vendorData.title ?? "Mells Selvair's Gallery",
        'data.description': vendorData.description ?? '',
        'data.image': vendorData.image ?? '',
        'data.updatedAt': new Date(),
      },
    },
    { upsert: true }
  );
}
