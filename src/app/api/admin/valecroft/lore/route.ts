import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeErrorMessage, getClientIp } from '@/lib/admin/sanitize';
import { getValecroftLore, saveValecroftLore } from '@/lib/admin/valecroft-lore';
import { coerceLore, type ValecroftLore } from '@/lib/admin/valecroft-lore-types';

export const dynamic = 'force-dynamic';

// Basic string length guards so we don't eat a 16MB doc.
const MAX_TEXT = 4000;
const MAX_GALLERY = 20;
const MAX_FAMILY = 50;

function stripHtml(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/<[^>]*>/g, '').trim().slice(0, MAX_TEXT);
}

function sanitize(lore: ValecroftLore): ValecroftLore {
  const c = coerceLore(lore);
  return {
    home: {
      name: { en: stripHtml(c.home.name.en), ar: stripHtml(c.home.name.ar) },
      description: { en: stripHtml(c.home.description.en), ar: stripHtml(c.home.description.ar) },
      imageUrl: stripHtml(c.home.imageUrl),
      gallery: c.home.gallery.slice(0, MAX_GALLERY).map((g) => stripHtml(g)).filter(Boolean),
    },
    family: c.family.slice(0, MAX_FAMILY).map((m) => ({
      id: stripHtml(m.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60),
      name: { en: stripHtml(m.name.en), ar: stripHtml(m.name.ar) },
      role: { en: stripHtml(m.role.en), ar: stripHtml(m.role.ar) },
      bio: { en: stripHtml(m.bio.en), ar: stripHtml(m.bio.ar) },
      imageUrl: stripHtml(m.imageUrl),
    })).filter((m) => m.id.length > 0),
  };
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const lore = await getValecroftLore();
    return NextResponse.json({ lore });
  } catch (e) {
    console.error('[valecroft/lore GET]', e);
    return NextResponse.json(
      { error: 'Failed to load', detail: sanitizeErrorMessage((e as Error).message) },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  let body: { lore: ValecroftLore };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.lore || typeof body.lore !== 'object') {
    return NextResponse.json({ error: 'lore required' }, { status: 400 });
  }

  const clean = sanitize(body.lore);
  // Family ids must be unique.
  const seen = new Set<string>();
  for (const m of clean.family) {
    if (seen.has(m.id)) {
      return NextResponse.json({ error: `Duplicate family member id: ${m.id}` }, { status: 400 });
    }
    seen.add(m.id);
  }

  try {
    await saveValecroftLore(clean);
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? 'Unknown',
      action: 'valecroft_lore_save',
      before: null,
      after: { familyCount: clean.family.length, galleryCount: clean.home.gallery.length },
      metadata: { familyIds: clean.family.map((m) => m.id) },
      ip: getClientIp(req),
    });
    return NextResponse.json({ success: true, lore: clean });
  } catch (e) {
    console.error('[valecroft/lore PUT]', e);
    return NextResponse.json(
      { error: 'Failed to save', detail: sanitizeErrorMessage((e as Error).message) },
      { status: 500 },
    );
  }
}
