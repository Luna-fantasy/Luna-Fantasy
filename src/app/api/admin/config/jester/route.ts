import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, sanitizeErrorMessage, getClientIp } from '@/lib/admin/sanitize';
import { validateJesterConfig } from '@/lib/admin/config-validation';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_SECTIONS = new Set([
  'status', 'all_of_games', 'roulette', 'mafia', 'rps', 'guessthecountry',
  'bombroulette', 'LunaFantasy', 'LunaFantasyEvent',
  'GrandFantasy', 'FactionWar', 'points_settings', 'ticket_shop_settings',
  'votegame', 'collection_rewards', 'trade_config', 'channel_config',
  'shop_brimor', 'shop_broker', 'level_rewards',
  'commands', 'trade', 'seluna_schedule',
]);

// Maps dashboard section names → bot_config document _id + data field path
const SECTION_MAP: Record<string, { docId: string; field: string }> = {
  status:               { docId: 'jester_status', field: 'text' },
  all_of_games:         { docId: 'jester_game_settings', field: 'all_of_games' },
  roulette:             { docId: 'jester_game_settings', field: 'roulette' },
  mafia:                { docId: 'jester_game_settings', field: 'mafia' },
  rps:                  { docId: 'jester_game_settings', field: 'rps' },
  guessthecountry:      { docId: 'jester_game_settings', field: 'guessthecountry' },
  bombroulette:         { docId: 'jester_game_settings', field: 'bombroulette' },
  LunaFantasy:          { docId: 'jester_game_settings', field: 'LunaFantasy' },
  LunaFantasyEvent:     { docId: 'jester_game_settings', field: 'LunaFantasyEvent' },
  GrandFantasy:         { docId: 'jester_game_settings', field: 'GrandFantasy' },
  FactionWar:           { docId: 'jester_game_settings', field: 'FactionWar' },
  points_settings:      { docId: 'jester_points_settings', field: '_root' },
  ticket_shop_settings: { docId: 'jester_game_settings', field: 'ticket_shop_settings' },
  votegame:             { docId: 'jester_game_settings', field: 'votegame' },
  collection_rewards:   { docId: 'jester_collection_rewards', field: '_root' },
  trade_config:         { docId: 'jester_trade', field: '_root' },
  channel_config:       { docId: 'jester_channels', field: '_root' },
  shop_brimor:          { docId: 'jester_shops', field: 'brimor' },
  shop_broker:          { docId: 'jester_shops', field: 'broker' },
  level_rewards:        { docId: 'jester_level_rewards', field: '_root' },
  commands:             { docId: 'jester_commands', field: '_root' },
  trade:                { docId: 'jester_trade', field: 'auction_duration_ms' },
  seluna_schedule:      { docId: 'jester_seluna_schedule', field: '_root' },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    const vendorCol = client.db(DB_NAME).collection('vendor_config');

    const [gameSettings, pointsSettings, statusDoc, collectionRewards, tradeConfig, channelConfig, brimorDoc, brokerDoc, levelRewardsDoc, commandsDoc, selunaScheduleDoc] = await Promise.all([
      col.findOne({ _id: 'jester_game_settings' as any }),
      col.findOne({ _id: 'jester_points_settings' as any }),
      col.findOne({ _id: 'jester_status' as any }),
      col.findOne({ _id: 'jester_collection_rewards' as any }),
      col.findOne({ _id: 'jester_trade' as any }),
      col.findOne({ _id: 'jester_channels' as any }),
      vendorCol.findOne({ _id: 'brimor' as any }),
      vendorCol.findOne({ _id: 'broker' as any }),
      col.findOne({ _id: 'jester_level_rewards' as any }),
      col.findOne({ _id: 'jester_commands' as any }),
      col.findOne({ _id: 'jester_seluna_schedule' as any }),
    ]);

    const sections: Record<string, any> = {};

    // Status
    if (statusDoc?.data) {
      sections.status = statusDoc.data.text ?? statusDoc.data;
    }

    // Game settings — spread each game into its own section
    if (gameSettings?.data) {
      const gs = gameSettings.data;
      for (const key of [
        'all_of_games', 'votegame', 'roulette', 'mafia', 'rps', 'guessthecountry',
        'bombroulette', 'LunaFantasy', 'LunaFantasyEvent',
        'GrandFantasy', 'FactionWar', 'ticket_shop_settings',
      ]) {
        if (gs[key]) {
          const val = { ...gs[key] };
          // Strip large nested blocks for frontend
          if (key === 'LunaFantasy') delete val.cards;
          if (key === 'FactionWar') delete val.factions;
          sections[key] = val;
        }
      }
    }

    // Points settings
    if (pointsSettings?.data) {
      sections.points_settings = pointsSettings.data;
    }

    // Collection rewards
    if (collectionRewards?.data) {
      sections.collection_rewards = collectionRewards.data;
    }

    // Trade config
    if (tradeConfig?.data) {
      sections.trade_config = tradeConfig.data;
    }

    // Channel config
    if (channelConfig?.data) {
      sections.channel_config = channelConfig.data;
    }

    // Shops (Brimor, Broker) — stored in vendor_config collection
    if (brimorDoc?.data) sections.shop_brimor = brimorDoc.data;
    if (brokerDoc?.data) sections.shop_broker = brokerDoc.data;

    // Level rewards (Jester milestone rewards at every 10 levels)
    if (levelRewardsDoc?.data) {
      sections.level_rewards = levelRewardsDoc.data;
    }

    // Commands
    if (commandsDoc?.data) sections.commands = commandsDoc.data;

    // Trade (auction duration — separate from trade_config to avoid overwriting other fields)
    if (tradeConfig?.data?.auction_duration_ms !== undefined) {
      sections.trade = { auction_duration_ms: tradeConfig.data.auction_duration_ms };
    }

    // Seluna schedule
    if (selunaScheduleDoc?.data) sections.seluna_schedule = selunaScheduleDoc.data;

    // Collect most recent updatedAt/updatedBy across all config documents
    const allDocs = [gameSettings, pointsSettings, statusDoc, collectionRewards, tradeConfig, channelConfig, brimorDoc, brokerDoc, levelRewardsDoc, commandsDoc, selunaScheduleDoc];
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
    return NextResponse.json({ error: `Failed to read config: ${sanitizeErrorMessage(err.message)}` }, { status: 500 });
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

  // Validate value ranges (prevents negative rewards, invalid player counts, etc.)
  const validationError = validateJesterConfig(section, value);
  if (validationError) {
    return NextResponse.json({ error: `Invalid config value: ${validationError}` }, { status: 400 });
  }

  const adminId = auth.session.user.discordId!;
  const { allowed } = checkRateLimit('jester_config', adminId, 5, 60_000);
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

    // Shops (brimor/broker) live in vendor_config, not bot_config
    const isVendorShop = section === 'shop_brimor' || section === 'shop_broker';
    const targetCol = isVendorShop
      ? client.db(DB_NAME).collection('vendor_config')
      : col;
    const targetDocId = isVendorShop
      ? (section === 'shop_brimor' ? 'brimor' : 'broker')
      : mapping.docId;

    // Read current value for audit
    const currentDoc = await targetCol.findOne({ _id: targetDocId as any });
    const before = isVendorShop
      ? currentDoc?.data ?? null
      : mapping.field === '_root'
        ? currentDoc?.data ?? null
        : currentDoc?.data?.[mapping.field] ?? null;

    if (isVendorShop) {
      // vendor_config stores entire shop config in data field
      await targetCol.updateOne(
        { _id: targetDocId as any },
        { $set: { data: value, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true }
      );
    } else if (mapping.field === '_root') {
      // For points_settings etc., replace the entire data object
      await col.updateOne(
        { _id: mapping.docId as any },
        { $set: { data: value, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true }
      );
    } else {
      // For game settings, update the specific field within data
      // Strip cards/factions from game settings (managed separately)
      let writeValue = value;
      if (section === 'LunaFantasy' && typeof value === 'object') {
        writeValue = { ...value };
        delete writeValue.cards;
      }
      if (section === 'FactionWar' && typeof value === 'object') {
        writeValue = { ...value };
        delete writeValue.factions;
      }

      await col.updateOne(
        { _id: mapping.docId as any },
        {
          $set: {
            [`data.${mapping.field}`]: writeValue,
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
      action: 'config_jester_update',
      metadata: { section, docId: mapping.docId },
      before,
      after: value,
      ip: getClientIp(req),
    });

    // No git push, no deploy needed — bot picks up changes within 30s
    return NextResponse.json({ success: true, saved: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to write config: ${sanitizeErrorMessage(err.message)}` }, { status: 500 });
  }
}
