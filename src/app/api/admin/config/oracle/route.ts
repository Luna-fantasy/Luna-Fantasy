import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateOracleConfig } from '@/lib/admin/oracle-config-validation';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_SECTIONS = new Set([
  'setup', 'games_trivia', 'games_sowalef', 'games_settings',
  'content_welcome', 'content_panel', 'content_buttons', 'content_aura', 'content_whisper', 'content_expiry',
  'assets', 'music',
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
  content_expiry:  { docId: 'oracle_vc_content', field: 'expiryTitles' },
  assets:          { docId: 'oracle_vc_assets', field: '_root' },
  music:           { docId: 'oracle_vc_music',  field: '_root' },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('oracle_config_read', adminId, 15, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    // Load all Oracle VC config documents in parallel
    const [setup, games, content, vip, assets, music] = await Promise.all([
      col.findOne({ _id: 'oracle_vc_setup' as any }),
      col.findOne({ _id: 'oracle_vc_games' as any }),
      col.findOne({ _id: 'oracle_vc_content' as any }),
      col.findOne({ _id: 'oracle_vc_vip' as any }),
      col.findOne({ _id: 'oracle_vc_assets' as any }),
      col.findOne({ _id: 'oracle_vc_music' as any }),
    ]);

    const sections: Record<string, any> = {};

    // Setup — default to empty config if not seeded
    const setupData = setup?.data ?? {
      hubChannels: [], vipCategoryId: '', logChannelId: '', staffRoleIds: [],
      maxTempRoomsPerUser: 1, maxVipRoomsPerUser: 1, gracePeriodMs: 10000,
      welcomeCooldownMs: 60000, challengesEnabled: true, challengeIntervalMs: 1800000,
      challengeMinMembers: 3, auraUpdateIntervalMs: 60000, panelAutoRefreshMs: 30000,
    };
    sections.setup = setupData;

    // Games — always return arrays (empty if not seeded)
    const gamesData = games?.data;
    sections.games_trivia = gamesData?.trivia ?? [];
    sections.games_sowalef = gamesData?.sowalef ?? [];
    if (gamesData) {
      const { trivia, sowalef, ...settings } = gamesData;
      sections.games_settings = settings;
    } else {
      sections.games_settings = {
        mathOps: { enabled: ['add', 'subtract', 'multiply', 'divide', 'square', 'cube', 'percent', 'multistep_add', 'multistep_sub', 'order_of_ops'], rewardMin: 5, rewardMax: 10, timeoutMs: 20000 },
        triviaReward: { autoDropMin: 50, autoDropMax: 200, miniMin: 5, miniMax: 10 },
        triviaTimeoutMs: 30000, triviaSessionSize: 10,
        streakBonuses: { '3': 5, '5': 10, '10': 25 },
        quickReact: { rewardMin: 5, rewardMax: 10, delayMin: 3000, delayMax: 8000, timeoutMs: 10000 },
        emojiRaceEmojis: ['🌙', '⭐', '🔮', '💎', '🗡️', '🛡️', '👑', '🔥'],
        sowalefSessionSize: 10, sowalefDebounceMs: 5000,
        gameCooldownMs: 10000, endCooldownMs: 5000,
        auraRewardMultipliers: { dormant: 0.5, flickering: 0.75, glowing: 1.0, radiant: 1.5, blazing: 2.0 },
        bossChallenge: { enabled: true, rewardMin: 500, rewardMax: 1000, cooldownHours: 24, questionCount: 5 },
      };
    }

    // Content — always return all sub-sections
    const contentData = content?.data;
    sections.content_welcome = contentData?.welcomeGreetings ?? [];
    sections.content_panel = contentData?.panelText ?? { line1: '', line2: '', line3: '', line4: '' };
    sections.content_buttons = contentData?.buttonLabels ?? {};
    sections.content_aura = {
      auraTiers: contentData?.auraTiers ?? { dormant: '💤 نايمة', flickering: '✨ تتحرك', glowing: '🌙 دافية', radiant: '💎 حامية', blazing: '🔥 مشتعلة!' },
      auraThresholds: contentData?.auraThresholds ?? { flickering: 10, glowing: 30, radiant: 60, blazing: 90 },
      auraWeights: contentData?.auraWeights ?? { warmthPerVisitor: 3, warmthMax: 25, energyDivisor: 10, energyMax: 25, harmonyPerMin: 5, harmonyMax: 25, loyaltyMax: 25 },
    };
    sections.content_whisper = contentData?.whisper ?? { cooldownMs: 60000, colors: [], ansiColors: [], modalTitle: '', modalPlaceholder: '', autoCleanupMs: 300000 };
    sections.content_expiry = contentData?.expiryTitles ?? {
      trivia: '🧠 تحدي المعرفة — انتهى الوقت!', math: '🧮 حل المسألة — انتهى الوقت!',
      emoji_race: '🏃 سباق الإيموجي — انتهى الوقت!', quickreact: '⚡ سرعة رد فعل — انتهى الوقت!',
      endurance: '💪 تحدي التحمّل — انتهى الوقت!',
    };

    // VIP (deprecated — kept for backwards compat)
    if (vip?.data) sections.vip = vip.data;

    // Assets
    sections.assets = assets?.data ?? { panelBannerUrl: '', emojis: {} };

    // Music library (MP3 tracks uploaded via /admin/voice Music tab).
    // Older docs predate `localEnabled` — coerce to true so existing installs
    // keep loading VPS-local MP3s exactly as before until an admin flips it.
    const musicData: any = music?.data ?? { enabled: false, tracks: [] };
    if (typeof musicData.localEnabled !== 'boolean') musicData.localEnabled = true;
    sections.music = musicData;

    // Collect most recent updatedAt/updatedBy across all config documents
    const allDocs = [setup, games, content, vip, assets, music];
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
  const { allowed, retryAfterMs } = checkRateLimit('oracle_config', adminId, 5, 60_000);
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

    // Music: default-coerce `localEnabled` to true if the client dropped it.
    // Older dashboard sessions don't know about this field; without this
    // seed, saving would silently turn off VPS-local loading.
    if (section === 'music' && value && typeof value === 'object') {
      if (typeof (value as any).localEnabled !== 'boolean') {
        (value as any).localEnabled = true;
      }
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
