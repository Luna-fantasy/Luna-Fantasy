import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateOracleConfig } from '@/lib/admin/oracle-config-validation';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_SECTIONS = new Set([
  'setup', 'games_trivia', 'games_sowalef', 'games_settings',
  'content_welcome', 'content_panel', 'content_buttons', 'content_aura', 'content_whisper',
  'vip', 'assets',
]);

// Maps dashboard section names -> bot_config document _id + data field path
const SECTION_MAP: Record<string, { docId: string; field: string }> = {
  setup:           { docId: 'oracle_vc_setup', field: '_root' },
  games_trivia:    { docId: 'oracle_vc_games', field: 'trivia' },
  games_sowalef:   { docId: 'oracle_vc_games', field: 'sowalef' },
  games_settings:  { docId: 'oracle_vc_games', field: '_settings' },
  content_welcome: { docId: 'oracle_vc_content', field: 'welcomeGreetings' },
  content_panel:   { docId: 'oracle_vc_content', field: 'panelText' },
  content_buttons: { docId: 'oracle_vc_content', field: 'buttonLabels' },
  content_aura:    { docId: 'oracle_vc_content', field: '_aura' },
  content_whisper: { docId: 'oracle_vc_content', field: 'whisper' },
  vip:             { docId: 'oracle_vc_vip', field: '_root' },
  assets:          { docId: 'oracle_vc_assets', field: '_root' },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    // Load all Oracle VC config documents in parallel
    const [setup, games, content, vip, assets] = await Promise.all([
      col.findOne({ _id: 'oracle_vc_setup' as any }),
      col.findOne({ _id: 'oracle_vc_games' as any }),
      col.findOne({ _id: 'oracle_vc_content' as any }),
      col.findOne({ _id: 'oracle_vc_vip' as any }),
      col.findOne({ _id: 'oracle_vc_assets' as any }),
    ]);

    const sections: Record<string, any> = {};

    // Setup
    if (setup?.data) sections.setup = setup.data;

    // Games
    if (games?.data) {
      if (games.data.trivia) sections.games_trivia = games.data.trivia;
      if (games.data.sowalef) sections.games_sowalef = games.data.sowalef;
      // games_settings is everything except trivia and sowalef
      const { trivia, sowalef, ...settings } = games.data;
      if (Object.keys(settings).length > 0) sections.games_settings = settings;
    }

    // Content
    if (content?.data) {
      if (content.data.welcomeGreetings) sections.content_welcome = content.data.welcomeGreetings;
      if (content.data.panelText) sections.content_panel = content.data.panelText;
      if (content.data.buttonLabels) sections.content_buttons = content.data.buttonLabels;
      // content_aura is combined auraTiers + auraThresholds + auraWeights
      const aura: Record<string, any> = {};
      if (content.data.auraTiers) aura.auraTiers = content.data.auraTiers;
      if (content.data.auraThresholds) aura.auraThresholds = content.data.auraThresholds;
      if (content.data.auraWeights) aura.auraWeights = content.data.auraWeights;
      if (Object.keys(aura).length > 0) sections.content_aura = aura;
      if (content.data.whisper) sections.content_whisper = content.data.whisper;
    }

    // VIP
    if (vip?.data) sections.vip = vip.data;

    // Assets
    if (assets?.data) sections.assets = assets.data;

    // Collect most recent updatedAt/updatedBy across all config documents
    const allDocs = [setup, games, content, vip, assets];
    let latestAt: Date | null = null;
    let latestBy: string | null = null;
    for (const doc of allDocs) {
      if (doc?.updatedAt && (!latestAt || new Date(doc.updatedAt) > latestAt)) {
        latestAt = new Date(doc.updatedAt);
        latestBy = doc.updatedBy ?? null;
      }
    }

    return NextResponse.json({
      sections,
      metadata: { updatedAt: latestAt?.toISOString() ?? null, updatedBy: latestBy },
    });
  } catch (err: any) {
    console.error('[admin/config/oracle GET] Error:', err);
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

  if (value !== null && typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json.length > 2_000_000) {
      return NextResponse.json({ error: 'Config value too large' }, { status: 400 });
    }
    if (hasMongoOperator(value)) {
      return NextResponse.json({ error: 'Invalid characters in config value' }, { status: 400 });
    }
  }

  // Validate value ranges
  const validationError = validateOracleConfig(section, value);
  if (validationError) {
    return NextResponse.json({ error: `Invalid config value: ${validationError}` }, { status: 400 });
  }

  const adminId = auth.session.user.discordId!;
  const { allowed } = checkRateLimit('oracle_config', adminId, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many config changes. Wait a moment.' }, { status: 429 });
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

    let before: any;

    if (mapping.field === '_root') {
      before = currentDoc?.data ?? null;
    } else if (mapping.field === '_settings') {
      // _settings is everything in data except trivia and sowalef
      if (currentDoc?.data) {
        const { trivia, sowalef, ...rest } = currentDoc.data;
        before = rest;
      } else {
        before = null;
      }
    } else if (mapping.field === '_aura') {
      // _aura is auraTiers + auraThresholds + auraWeights combined
      if (currentDoc?.data) {
        before = {
          auraTiers: currentDoc.data.auraTiers ?? null,
          auraThresholds: currentDoc.data.auraThresholds ?? null,
          auraWeights: currentDoc.data.auraWeights ?? null,
        };
      } else {
        before = null;
      }
    } else {
      before = currentDoc?.data?.[mapping.field] ?? null;
    }

    // Write to MongoDB
    if (mapping.field === '_root') {
      // Replace entire data object
      await col.updateOne(
        { _id: mapping.docId as any },
        { $set: { data: value, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true }
      );
    } else if (mapping.field === '_settings') {
      // Update each key individually, but NOT trivia/sowalef
      const setFields: Record<string, any> = {
        updatedAt: new Date(),
        updatedBy: adminId,
      };
      for (const [k, v] of Object.entries(value)) {
        if (k !== 'trivia' && k !== 'sowalef') {
          setFields[`data.${k}`] = v;
        }
      }
      await col.updateOne(
        { _id: mapping.docId as any },
        { $set: setFields },
        { upsert: true }
      );
    } else if (mapping.field === '_aura') {
      // Update all three aura sub-fields
      const setFields: Record<string, any> = {
        updatedAt: new Date(),
        updatedBy: adminId,
      };
      if (value.auraTiers !== undefined) setFields['data.auraTiers'] = value.auraTiers;
      if (value.auraThresholds !== undefined) setFields['data.auraThresholds'] = value.auraThresholds;
      if (value.auraWeights !== undefined) setFields['data.auraWeights'] = value.auraWeights;
      await col.updateOne(
        { _id: mapping.docId as any },
        { $set: setFields },
        { upsert: true }
      );
    } else {
      // Update specific field within data
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
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user.username ?? 'unknown',
      action: 'config_oracle_update',
      metadata: { section, docId: mapping.docId },
      before,
      after: value,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, saved: true });
  } catch (err: any) {
    console.error('[admin/config/oracle PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }
}
