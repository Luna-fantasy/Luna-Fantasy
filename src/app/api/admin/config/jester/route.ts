import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_SECTIONS = new Set([
  'status', 'all_of_games', 'roulette', 'mafia', 'rps', 'guessthecountry',
  'bombroulette', 'magicbot', 'LunaFantasy', 'LunaFantasyEvent',
  'GrandFantasy', 'FactionWar', 'points_settings', 'ticket_shop_settings',
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
  magicbot:             { docId: 'jester_game_settings', field: 'magicbot' },
  LunaFantasy:          { docId: 'jester_game_settings', field: 'LunaFantasy' },
  LunaFantasyEvent:     { docId: 'jester_game_settings', field: 'LunaFantasyEvent' },
  GrandFantasy:         { docId: 'jester_game_settings', field: 'GrandFantasy' },
  FactionWar:           { docId: 'jester_game_settings', field: 'FactionWar' },
  points_settings:      { docId: 'jester_points_settings', field: '_root' },
  ticket_shop_settings: { docId: 'jester_game_settings', field: 'ticket_shop_settings' },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const col = client.db(DB_NAME).collection('bot_config');

    const [gameSettings, pointsSettings, statusDoc] = await Promise.all([
      col.findOne({ _id: 'jester_game_settings' as any }),
      col.findOne({ _id: 'jester_points_settings' as any }),
      col.findOne({ _id: 'jester_status' as any }),
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
        'all_of_games', 'roulette', 'mafia', 'rps', 'guessthecountry',
        'bombroulette', 'magicbot', 'LunaFantasy', 'LunaFantasyEvent',
        'GrandFantasy', 'FactionWar', 'ticket_shop_settings', 'luckboxes'
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

    return NextResponse.json({ sections });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to read config: ${err.message}` }, { status: 500 });
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

    // Read current value for audit
    const currentDoc = await col.findOne({ _id: mapping.docId as any });
    const before = mapping.field === '_root'
      ? currentDoc?.data ?? null
      : currentDoc?.data?.[mapping.field] ?? null;

    // For points_settings, replace the entire data object
    // For game settings, update the specific field within data
    if (mapping.field === '_root') {
      await col.updateOne(
        { _id: mapping.docId as any },
        { $set: { data: value, updatedAt: new Date(), updatedBy: adminId } },
        { upsert: true }
      );
    } else {
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
      ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    });

    // No git push, no deploy needed — bot picks up changes within 30s
    return NextResponse.json({ saved: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to write config: ${err.message}` }, { status: 500 });
  }
}
