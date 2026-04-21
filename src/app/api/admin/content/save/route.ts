import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { uploadObject, isR2Configured } from '@/lib/admin/r2';
import { commitTranslationChanges } from '@/lib/admin/github';
import { invalidateOverrideCache } from '@/i18n/request';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

// Whitelist of collections and fields that can be edited inline
const ALLOWED_EDITS: Record<string, string[]> = {
  partners: ['name', 'type.en', 'type.ar', 'description.en', 'description.ar', 'logo'],
  characters: ['name.en', 'name.ar', 'lore', 'lore.en', 'lore.ar', 'imageUrl'],
};

function isAllowedDbEdit(collection: string, field: string): boolean {
  const allowed = ALLOWED_EDITS[collection];
  if (!allowed) return false;
  return allowed.includes(field);
}

// Strip HTML tags to prevent stored XSS
function sanitizeValue(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

// Set a nested field using dot notation
function setNestedField(obj: Record<string, any>, dotPath: string, value: any): void {
  const parts = dotPath.split('.');
  if (parts.length > 5) throw new Error('Path too deeply nested');
  let target = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null) {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = value;
}

export async function POST(request: NextRequest) {
  // Auth
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  // CSRF
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  // Rate limit: 5 saves/min
  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_content_save', adminId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs, 'Rate limited — max 5 saves per minute');

  try {
    const formData = await request.formData();
    const results: { translations: number; dbFields: number; images: number; github: boolean } = {
      translations: 0,
      dbFields: 0,
      images: 0,
      github: false,
    };

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const ip = getClientIp(request);
    const adminName = authResult.session.user?.globalName ?? 'Unknown';

    // --- Translation changes ---
    const translationsRaw = formData.get('translations');
    if (translationsRaw && typeof translationsRaw === 'string') {
      const translations: { locale: string; key: string; value: string }[] = JSON.parse(translationsRaw);

      // Validate locale values
      const validLocales = ['en', 'ar'];
      const validTranslations = translations.filter(
        (t) => validLocales.includes(t.locale) && t.key && typeof t.value === 'string'
          && /^[a-zA-Z0-9_.]{1,100}$/.test(t.key)
      );

      // Group by locale
      const byLocale = new Map<string, { key: string; value: string }[]>();
      for (const t of validTranslations) {
        const sanitized = sanitizeValue(t.value);
        if (!byLocale.has(t.locale)) byLocale.set(t.locale, []);
        byLocale.get(t.locale)!.push({ key: t.key, value: sanitized });
      }

      // Apply to MongoDB (merge into existing overrides)
      const col = db.collection('translation_overrides');
      for (const [locale, changes] of Array.from(byLocale.entries())) {
        const doc = await col.findOne({ _id: locale as any });
        const existing = doc?.overrides ?? {};

        for (const { key, value } of changes) {
          existing[key] = value;
        }

        await col.updateOne(
          { _id: locale as any },
          { $set: { overrides: existing } },
          { upsert: true }
        );

        results.translations += changes.length;

        // GitHub commit
        try {
          const { committed } = await commitTranslationChanges(changes, locale);
          if (committed) results.github = true;
        } catch (err) {
          console.error(`[EditMode] GitHub commit failed for ${locale}:`, err);
        }
      }

      // Invalidate i18n cache
      invalidateOverrideCache();

      // Audit log
      await logAdminAction({
        adminDiscordId: adminId,
        adminUsername: adminName,
        action: 'inline_edit_translations',
        before: null,
        after: { changeCount: results.translations },
        metadata: { locales: Array.from(byLocale.keys()) },
        ip,
      });
    }

    // --- DB field changes ---
    const dbFieldsRaw = formData.get('dbFields');
    if (dbFieldsRaw && typeof dbFieldsRaw === 'string') {
      const dbFields: { collection: string; id: string; field: string; value: string }[] = JSON.parse(dbFieldsRaw);

      for (const edit of dbFields) {
        if (!isAllowedDbEdit(edit.collection, edit.field)) {
          console.warn(`[EditMode] Blocked disallowed DB edit: ${edit.collection}.${edit.field}`);
          continue;
        }
        // Defense against NoSQL operator injection via edit.id — must be a plain
        // string in slug format (no object payloads like { $ne: null }).
        if (typeof edit.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(edit.id)) {
          console.warn(`[EditMode] Blocked invalid edit.id: ${JSON.stringify(edit.id)}`);
          continue;
        }

        const sanitized = sanitizeValue(edit.value);
        const updateDoc: Record<string, any> = {};
        setNestedField(updateDoc, edit.field, sanitized);

        await db.collection(edit.collection).updateOne(
          { id: edit.id },
          { $set: updateDoc }
        );

        results.dbFields++;
      }

      if (results.dbFields > 0) {
        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'inline_edit_db_fields',
          before: null,
          after: { changeCount: results.dbFields },
          metadata: { fields: dbFields.map((f) => `${f.collection}.${f.field}`) },
          ip,
        });
      }
    }

    // --- Image uploads ---
    const imageEntries: { id: string; file: File; meta: any }[] = [];
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('image_') && !key.startsWith('image_meta_') && value instanceof File) {
        const id = key.replace('image_', '');
        const metaRaw = formData.get(`image_meta_${id}`);
        const meta = metaRaw ? JSON.parse(metaRaw as string) : {};
        imageEntries.push({ id, file: value, meta });
      }
    }

    if (imageEntries.length > 0 && isR2Configured()) {
      for (const { id, file, meta } of imageEntries) {
        // Validate file
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) continue;

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop() ?? 'png';
        const r2Key = `inline-edits/${id}.${ext}`;
        const url = await uploadObject(r2Key, buffer, file.type);

        // Cache-bust on write-to-DB so Discord + browsers bypass the stale
        // copy cached against the prior version of this R2 key. Matches the
        // pattern documented in memory `feedback_r2_cache_pattern.md`.
        const bustedUrl = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;

        // If meta has DB info, update the document
        if (meta.dbCollection && meta.dbId && meta.dbField) {
          if (isAllowedDbEdit(meta.dbCollection, meta.dbField)) {
            const updateDoc: Record<string, any> = {};
            setNestedField(updateDoc, meta.dbField, bustedUrl);
            await db.collection(meta.dbCollection).updateOne(
              { id: meta.dbId },
              { $set: updateDoc }
            );
          }
        }

        results.images++;
      }

      if (results.images > 0) {
        await logAdminAction({
          adminDiscordId: adminId,
          adminUsername: adminName,
          action: 'inline_edit_images',
          before: null,
          after: { imageCount: results.images },
          metadata: { imageIds: imageEntries.map((e) => e.id) },
          ip,
        });
      }
    }

    // Fire on-demand revalidation so edits appear live within ~1–3s instead
    // of waiting for the 60s ISR cycle. Revalidating the locale layout
    // cascades to every public page. Wrapped in try/catch because a failing
    // revalidate shouldn't block the save response.
    if (results.translations > 0 || results.dbFields > 0 || results.images > 0) {
      try {
        revalidatePath('/', 'layout');
      } catch (err) {
        console.warn('[EditMode] revalidatePath failed — edits will appear on next ISR cycle:', err);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[EditMode] Save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
