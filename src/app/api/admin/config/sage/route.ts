import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_SECTIONS = new Set([
  'provider', 'google_model', 'openrouter_model',
  'enable_search', 'enable_image_generation',
  'system_prompt', 'privileged_roles', 'lunarian_role_id', 'lunarian_access',
  'all_known_roles', 'image_generation_model', 'sage_prefix', 'owner_role_ids',
  'image_gen_roles', 'lore_text', 'channel_context_limit',
]);

// Maps dashboard section names → bot_config document _id + data field path
const SECTION_MAP: Record<string, { docId: string; field: string }> = {
  provider:           { docId: 'sage_settings', field: 'provider' },
  google_model:       { docId: 'sage_settings', field: 'google_model' },
  openrouter_model:   { docId: 'sage_settings', field: 'openrouter_model' },
  enable_search:      { docId: 'sage_settings', field: 'enable_search' },
  enable_image_generation: { docId: 'sage_settings', field: 'enable_image_generation' },
  system_prompt:      { docId: 'sage_system_prompt', field: 'prompt' },
  privileged_roles:   { docId: 'sage_privileges', field: 'privilegedRoles' },
  lunarian_role_id:   { docId: 'sage_privileges', field: 'lunarianRoleId' },
  lunarian_access:    { docId: 'sage_privileges', field: 'lunarianAccess' },
  all_known_roles:    { docId: 'sage_privileges', field: 'allKnownRoles' },
  image_generation_model: { docId: 'sage_settings', field: 'image_generation_model' },
  sage_prefix:        { docId: 'sage_settings', field: 'sage_prefix' },
  owner_role_ids:     { docId: 'sage_settings', field: 'owner_role_ids' },
  image_gen_roles:    { docId: 'sage_settings', field: 'image_gen_roles' },
  lore_text:          { docId: 'sage_lore', field: 'text' },
  channel_context_limit: { docId: 'sage_settings', field: 'channel_context_limit' },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    // Load all Sage config documents in parallel
    const [settings, systemPrompt, privileges, loreDoc] = await Promise.all([
      col.findOne({ _id: 'sage_settings' as any }),
      col.findOne({ _id: 'sage_system_prompt' as any }),
      col.findOne({ _id: 'sage_privileges' as any }),
      col.findOne({ _id: 'sage_lore' as any }),
    ]);

    const sections: Record<string, any> = {};

    // Settings
    if (settings?.data) {
      sections.provider = settings.data.provider;
      sections.google_model = settings.data.google_model;
      sections.openrouter_model = settings.data.openrouter_model;
      sections.enable_search = settings.data.enable_search;
      sections.enable_image_generation = settings.data.enable_image_generation;
      sections.image_generation_model = settings.data.image_generation_model ?? null;
      sections.sage_prefix = settings.data.sage_prefix ?? null;
      sections.owner_role_ids = settings.data.owner_role_ids ?? null;
      sections.image_gen_roles = settings.data.image_gen_roles ?? null;
      sections.channel_context_limit = settings.data.channel_context_limit ?? null;
    }

    // System prompt
    if (systemPrompt?.data) {
      sections.system_prompt = systemPrompt.data.prompt;
    }

    // Lore
    if (loreDoc?.data) {
      sections.lore_text = loreDoc.data.text ?? '';
    }

    // Privileges
    if (privileges?.data) {
      sections.privileged_roles = privileges.data.privilegedRoles;
      sections.lunarian_role_id = privileges.data.lunarianRoleId;
      sections.lunarian_access = privileges.data.lunarianAccess;
      sections.all_known_roles = privileges.data.allKnownRoles;
    }

    return NextResponse.json({ sections });
  } catch (err: any) {
    console.error('[admin/config/sage GET] Error:', err);
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const { section, value } = await req.json();

  if (!section || value === undefined) {
    return NextResponse.json({ error: 'section and value required' }, { status: 400 });
  }

  if (!ALLOWED_SECTIONS.has(section)) {
    return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
  }

  // NoSQL injection check
  if (value !== null && typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json.length > 500_000) {
      return NextResponse.json({ error: 'Config value too large' }, { status: 400 });
    }
    if (hasMongoOperator(value)) {
      return NextResponse.json({ error: 'Invalid characters in config value' }, { status: 400 });
    }
  }

  const adminId = auth.session.user.discordId!;
  const { allowed, retryAfterMs } = checkRateLimit('sage_config', adminId, 5, 60_000);
  if (!allowed) {
    return rateLimitResponse(retryAfterMs, 'Too many config changes. Wait a moment.');
  }

  try {
    const mapping = SECTION_MAP[section];
    if (!mapping) {
      return NextResponse.json({ error: `No mapping for section: ${section}` }, { status: 400 });
    }

    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    // Read current value for audit
    const currentDoc = await col.findOne({ _id: mapping.docId as any });
    const before = currentDoc?.data?.[mapping.field] ?? null;

    // Write to MongoDB — updates the specific field within the data object
    await col.updateOne(
      { _id: mapping.docId as any },
      {
        $set: {
          [`data.${mapping.field}`]: value,
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user.username ?? 'unknown',
      action: 'config_sage_update',
      metadata: { section, docId: mapping.docId },
      before,
      after: value,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, saved: true });
  } catch (err: any) {
    console.error('[admin/config/sage PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }
}
