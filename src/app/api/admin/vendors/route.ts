import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { preserveMirrorsInPayload } from '@/lib/admin/seluna-mells-mirror';
import { mirrorMellsToButler } from '@/lib/admin/mells-butler-mirror';
import { invalidateVendorConfigCache } from '@/lib/bazaar/vendor-config';
import { invalidateShopConfigCache } from '@/lib/bazaar/shop-config';

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

    // Defensive mirror preservation — for mells_selvair, splice any existing
    // seluna_locked items back into the incoming items[] if the frontend
    // somehow stripped them. Mirrors are append-only and survive forever.
    let finalData: any = sanitizedData;
    if (vendorId === 'mells_selvair') {
      const beforeItems: any[] = Array.isArray(before?.data?.items) ? before!.data.items : [];
      const incomingItems: any[] = Array.isArray((sanitizedData as any)?.items) ? (sanitizedData as any).items : [];
      const merged = preserveMirrorsInPayload(beforeItems, incomingItems);
      // Also reject any attempt to mutate an existing mirror's flags via this
      // generic PUT — mirrors are owned by the Seluna lifecycle. We do this by
      // replacing each existing mirror's row in the merged payload with the
      // current row in the database (the mirror is read-only here).
      const lockedById = new Map<string, any>();
      for (const it of beforeItems) {
        if (it && it.seluna_locked && typeof it.id === 'string') lockedById.set(it.id, it);
      }
      const enforced = merged.map((it: any) => {
        if (it && typeof it.id === 'string' && lockedById.has(it.id)) {
          return lockedById.get(it.id);
        }
        return it;
      });
      finalData = { ...(sanitizedData as Record<string, unknown>), items: enforced };
    }

    // Dot-path $set per field so concurrent writers to the same doc (e.g. the
    // Seluna mirror reconciler touching mells_selvair) never lose sibling keys
    // to a whole-doc replace.
    const setDoc: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(finalData as Record<string, unknown>)) {
      setDoc[`data.${k}`] = v;
    }
    if (Object.keys(setDoc).length === 0) {
      return NextResponse.json({ error: 'data must have at least one field' }, { status: 400 });
    }
    await col.updateOne({ _id: vendorId as any }, { $set: setDoc }, { upsert: true });

    // Bust the bazaar read caches so the public site reflects this save
    // immediately (vendorId can be any vendor_config doc, including the
    // shop-config-cached luckbox/stonebox/tickets/mells docs).
    invalidateVendorConfigCache(vendorId);
    invalidateShopConfigCache();

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
        await mirrorMellsToButler(db, finalData);
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
      after: { vendorId, data: finalData },
      metadata: { vendorId, mirroredTo: vendorId === 'mells_selvair' ? 'bot_config.butler_shop' : undefined },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vendor config update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
