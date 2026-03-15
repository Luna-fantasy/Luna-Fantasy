import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
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
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    // Load all Butler config documents in parallel
    const [economy, games, leveling, banking, shop] = await Promise.all([
      col.findOne({ _id: 'butler_economy' as any }),
      col.findOne({ _id: 'butler_games' as any }),
      col.findOne({ _id: 'butler_level_system' as any }),
      col.findOne({ _id: 'butler_banking' as any }),
      col.findOne({ _id: 'butler_shop' as any }),
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
    }

    // Banking
    if (banking?.data) {
      sections.loan_tiers = banking.data.loan_tiers;
      sections.investment = banking.data.investment;
      sections.trade_settings = banking.data.trade_settings;
      sections.insurance = banking.data.insurance;
    }

    // Shop
    if (shop?.data) {
      sections.shop_items = shop.data.items ?? shop.data;
    }

    return NextResponse.json({ sections });
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
    if (json.includes('"$')) {
      return NextResponse.json({ error: 'Invalid characters in config value' }, { status: 400 });
    }
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
      action: 'config_butler_update',
      metadata: { section, docId: mapping.docId },
      before,
      after: value,
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    });

    // No git push, no deploy needed — bot picks up changes within 30s
    return NextResponse.json({ saved: true });
  } catch (err: any) {
    console.error('[admin/config/butler PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
  }
}
