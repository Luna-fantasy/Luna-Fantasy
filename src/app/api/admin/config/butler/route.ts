import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateButlerConfig } from '@/lib/admin/config-validation';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_SECTIONS = new Set([
  'daily_reward', 'salary', 'vip_reward', 'text_xp', 'voice_xp',
  'boosted_roles', 'level_rewards',
  'xo_game', 'rps_game', 'connect4_game', 'coinflip_game',
  'hunt_game', 'roulette_game', 'luna21_game', 'steal_system',
  'loan_tiers', 'investment', 'trade_settings', 'insurance', 'shop_items',
  'ticket_system', 'applications_system', 'auto_reply', 'auto_images',
  'channel_config', 'role_config', 'leaderboard_config',
  'insurance_types', 'level_enabled', 'level_up_message', 'level_up_channel',
  'banker_enabled', 'trade_level', 'vip_interest',
  'chat_event_points', 'baloot_reward',
  'double_xp_enabled', 'level_up_mode',
  'commands', 'badge_thresholds', 'status',
]);

// Maps dashboard section names → bot_config document _id + data field path
const SECTION_MAP: Record<string, { docId: string; field: string }> = {
  daily_reward:   { docId: 'butler_economy', field: 'daily_reward' },
  salary:         { docId: 'butler_economy', field: 'salary' },
  vip_reward:     { docId: 'butler_economy', field: 'vip_reward' },
  text_xp:        { docId: 'butler_level_system', field: 'text_xp' },
  voice_xp:       { docId: 'butler_level_system', field: 'voice_xp' },
  boosted_roles:  { docId: 'butler_level_system', field: 'boosted_roles' },
  level_rewards:  { docId: 'butler_level_system', field: 'level_rewards' },
  xo_game:        { docId: 'butler_games', field: 'xo_game' },
  rps_game:       { docId: 'butler_games', field: 'rps_game' },
  connect4_game:  { docId: 'butler_games', field: 'connect4_game' },
  coinflip_game:  { docId: 'butler_games', field: 'coinflip_game' },
  hunt_game:      { docId: 'butler_games', field: 'hunt_game' },
  roulette_game:  { docId: 'butler_games', field: 'roulette_game' },
  luna21_game:    { docId: 'butler_games', field: 'luna21_game' },
  steal_system:   { docId: 'butler_games', field: 'steal_system' },
  loan_tiers:      { docId: 'butler_banking', field: 'loan_tiers' },
  investment:      { docId: 'butler_banking', field: 'investment' },
  trade_settings:  { docId: 'butler_banking', field: 'trade_settings' },
  insurance:       { docId: 'butler_banking', field: 'insurance' },
  shop_items:     { docId: 'butler_shop', field: 'items' },
  ticket_system:        { docId: 'butler_tickets', field: '_root' },
  applications_system:  { docId: 'butler_applications', field: '_root' },
  auto_reply:           { docId: 'butler_auto_reply', field: '_root' },
  auto_images:          { docId: 'butler_auto_images', field: '_root' },
  channel_config:       { docId: 'butler_channels', field: '_root' },
  role_config:          { docId: 'butler_roles', field: '_root' },
  leaderboard_config:   { docId: 'butler_leaderboard', field: '_root' },
  insurance_types:      { docId: 'butler_banking', field: 'insurance_types' },
  level_enabled:        { docId: 'butler_level_system', field: 'enabled' },
  level_up_message:     { docId: 'butler_level_system', field: 'level_up_message' },
  level_up_channel:     { docId: 'butler_level_system', field: 'level_up_channel_id' },
  banker_enabled:       { docId: 'butler_banking', field: 'enabled' },
  trade_level:          { docId: 'butler_banking', field: 'trade_level' },
  vip_interest:         { docId: 'butler_banking', field: 'vip_interest' },
  chat_event_points:    { docId: 'butler_chat_events', field: '_root' },
  baloot_reward:        { docId: 'butler_baloot', field: 'reward' },
  double_xp_enabled:    { docId: 'butler_level_system', field: 'double_xp_enabled' },
  level_up_mode:        { docId: 'butler_level_system', field: 'level_up_mode' },
  commands:             { docId: 'butler_commands', field: '_root' },
  badge_thresholds:     { docId: 'butler_badge_thresholds', field: '_root' },
  status:               { docId: 'butler_status', field: '_root' },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    // Load all Butler config documents in parallel
    const [economy, games, leveling, banking, shop, tickets, applications, autoReply, autoImages, channels, roles, leaderboard, chatEvents, baloot, commands, badgeThresholds, statusDoc] = await Promise.all([
      col.findOne({ _id: 'butler_economy' as any }),
      col.findOne({ _id: 'butler_games' as any }),
      col.findOne({ _id: 'butler_level_system' as any }),
      col.findOne({ _id: 'butler_banking' as any }),
      col.findOne({ _id: 'butler_shop' as any }),
      col.findOne({ _id: 'butler_tickets' as any }),
      col.findOne({ _id: 'butler_applications' as any }),
      col.findOne({ _id: 'butler_auto_reply' as any }),
      col.findOne({ _id: 'butler_auto_images' as any }),
      col.findOne({ _id: 'butler_channels' as any }),
      col.findOne({ _id: 'butler_roles' as any }),
      col.findOne({ _id: 'butler_leaderboard' as any }),
      col.findOne({ _id: 'butler_chat_events' as any }),
      col.findOne({ _id: 'butler_baloot' as any }),
      col.findOne({ _id: 'butler_commands' as any }),
      col.findOne({ _id: 'butler_badge_thresholds' as any }),
      col.findOne({ _id: 'butler_status' as any }),
    ]);

    const sections: Record<string, any> = {};

    // Economy
    if (economy?.data) {
      sections.daily_reward = economy.data.daily_reward;
      sections.salary = economy.data.salary;
      sections.vip_reward = economy.data.vip_reward;
    }

    // Games
    if (games?.data) {
      for (const key of ['xo_game', 'rps_game', 'connect4_game', 'coinflip_game', 'hunt_game', 'roulette_game', 'luna21_game', 'steal_system']) {
        if (games.data[key]) sections[key] = games.data[key];
      }
    }

    // Leveling
    if (leveling?.data) {
      sections.text_xp = leveling.data.text_xp;
      sections.voice_xp = leveling.data.voice_xp;
      sections.boosted_roles = leveling.data.boosted_roles;
      sections.level_rewards = leveling.data.level_rewards;
      if (leveling.data.enabled !== undefined) sections.level_enabled = leveling.data.enabled;
      if (leveling.data.level_up_message) sections.level_up_message = leveling.data.level_up_message;
      if (leveling.data.level_up_channel_id) sections.level_up_channel = leveling.data.level_up_channel_id;
      if (leveling.data.double_xp_enabled !== undefined) sections.double_xp_enabled = leveling.data.double_xp_enabled;
      if (leveling.data.level_up_mode) sections.level_up_mode = leveling.data.level_up_mode;
    }

    // Banking
    if (banking?.data) {
      sections.loan_tiers = banking.data.loan_tiers;
      sections.investment = banking.data.investment;
      sections.trade_settings = banking.data.trade_settings;
      sections.insurance = banking.data.insurance;
      if (banking.data.insurance_types) sections.insurance_types = banking.data.insurance_types;
      if (banking.data.enabled !== undefined) sections.banker_enabled = banking.data.enabled;
      if (banking.data.trade_level !== undefined) sections.trade_level = banking.data.trade_level;
      if (banking.data.vip_interest !== undefined) sections.vip_interest = banking.data.vip_interest;
    }

    // Shop
    if (shop?.data) {
      sections.shop_items = shop.data.items ?? shop.data;
    }

    // Tickets
    if (tickets?.data) sections.ticket_system = tickets.data;

    // Applications
    if (applications?.data) sections.applications_system = applications.data;

    // Auto Reply
    if (autoReply?.data) sections.auto_reply = autoReply.data;

    // Auto Images
    if (autoImages?.data) sections.auto_images = autoImages.data;

    // Channels
    if (channels?.data) sections.channel_config = channels.data;

    // Roles
    if (roles?.data) sections.role_config = roles.data;

    // Leaderboard
    if (leaderboard?.data) sections.leaderboard_config = leaderboard.data;

    // Chat Event Points
    if (chatEvents?.data) sections.chat_event_points = chatEvents.data;

    // Baloot
    if (baloot?.data) sections.baloot_reward = baloot.data.reward;

    // Commands
    if (commands?.data) sections.commands = commands.data;

    // Badge Thresholds
    if (badgeThresholds?.data) sections.badge_thresholds = badgeThresholds.data;

    // Status
    if (statusDoc?.data) sections.status = statusDoc.data;

    // Collect most recent updatedAt/updatedBy across all config documents
    const allDocs = [economy, games, leveling, banking, shop, tickets, applications, autoReply, autoImages, channels, roles, leaderboard, chatEvents, baloot, commands, badgeThresholds, statusDoc];
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
    console.error('[admin/config/butler GET] Error:', err);
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
    if (json.length > 500_000) {
      return NextResponse.json({ error: 'Config value too large' }, { status: 400 });
    }
    if (hasMongoOperator(value)) {
      return NextResponse.json({ error: 'Invalid characters in config value' }, { status: 400 });
    }
  }

  // Validate value ranges (prevents negative XP, zero cooldowns, min > max, etc.)
  const validationError = validateButlerConfig(section, value);
  if (validationError) {
    return NextResponse.json({ error: `Invalid config value: ${validationError}` }, { status: 400 });
  }

  const adminId = auth.session.user.discordId!;
  const { allowed } = checkRateLimit('butler_config', adminId, 5, 60_000);
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
    const before = mapping.field === '_root'
      ? currentDoc?.data ?? null
      : currentDoc?.data?.[mapping.field] ?? null;

    // Write to MongoDB
    if (mapping.field === '_root') {
      // Replace entire data object
      await col.updateOne(
        { _id: mapping.docId as any },
        { $set: { data: value, updatedAt: new Date(), updatedBy: adminId } },
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
      action: 'config_butler_update',
      metadata: { section, docId: mapping.docId },
      before,
      after: value,
      ip: getClientIp(req),
    });

    // No git push, no deploy needed — bot picks up changes within 30s
    return NextResponse.json({ success: true, saved: true });
  } catch (err: any) {
    console.error('[admin/config/butler PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }
}
