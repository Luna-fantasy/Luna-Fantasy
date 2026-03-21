import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const BOT_IDS = ['butler', 'jester', 'oracle', 'sage'] as const;
type BotId = (typeof BOT_IDS)[number];

const STATUS_TYPES = ['online', 'idle', 'dnd'] as const;

const BOT_NAMES: Record<BotId, string> = {
  butler: 'Luna Butler',
  jester: 'Luna Jester',
  oracle: 'Luna Oracle',
  sage: 'Luna Sage',
};

interface BotProfile {
  _id: string;
  name: string;
  status_text: string;
  status_type: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string;
  discord_avatar_url: string | null;
  discord_banner_url: string | null;
  discord_id: string | null;
  last_applied_at: string | null;
  updated_at: Date | null;
  updated_by: string | null;
}

function makeDefault(id: BotId): BotProfile {
  return {
    _id: id,
    name: BOT_NAMES[id],
    status_text: '',
    status_type: 'online',
    avatar_url: null,
    banner_url: null,
    bio: '',
    discord_avatar_url: null,
    discord_banner_url: null,
    discord_id: null,
    last_applied_at: null,
    updated_at: null,
    updated_by: null,
  };
}

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const profiles = await db.collection('bot_profiles').find({}).toArray();

    const result: BotProfile[] = BOT_IDS.map((id) => {
      const existing = profiles.find((p) => String(p._id) === id);
      if (existing) {
        return {
          _id: String(existing._id),
          name: BOT_NAMES[id],
          status_text: existing.status_text ?? '',
          status_type: existing.status_type ?? 'online',
          avatar_url: existing.avatar_url ?? null,
          banner_url: existing.banner_url ?? null,
          bio: existing.bio ?? '',
          discord_avatar_url: existing.discord_avatar_url ?? null,
          discord_banner_url: existing.discord_banner_url ?? null,
          discord_id: existing.discord_id ?? null,
          last_applied_at: existing.last_applied_at ?? null,
          updated_at: existing.updated_at ?? null,
          updated_by: existing.updated_by ?? null,
        };
      }
      return makeDefault(id);
    });

    return NextResponse.json({ profiles: result });
  } catch (error) {
    console.error('Failed to fetch bot profiles:', error);
    return NextResponse.json({ error: 'Failed to load bot profiles' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { botId, status_text, status_type, avatar_url, banner_url, bio } = body;

    if (!botId || !BOT_IDS.includes(botId)) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }

    if (status_type !== undefined && !STATUS_TYPES.includes(status_type)) {
      return NextResponse.json({ error: 'Invalid status type. Must be: online, idle, or dnd' }, { status: 400 });
    }

    if (status_text !== undefined && typeof status_text !== 'string') {
      return NextResponse.json({ error: 'Status text must be a string' }, { status: 400 });
    }

    if (status_text !== undefined && status_text.length > 128) {
      return NextResponse.json({ error: 'Status text too long (max 128 characters)' }, { status: 400 });
    }

    if (bio !== undefined && typeof bio !== 'string') {
      return NextResponse.json({ error: 'Bio must be a string' }, { status: 400 });
    }

    if (bio !== undefined && bio.length > 190) {
      return NextResponse.json({ error: 'Bio too long (max 190 characters)' }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      updated_at: new Date(),
      updated_by: adminId,
    };

    if (status_text !== undefined) update.status_text = status_text.trim();
    if (status_type !== undefined) update.status_type = status_type;
    if (avatar_url !== undefined) update.avatar_url = avatar_url;
    if (banner_url !== undefined) update.banner_url = banner_url;
    if (bio !== undefined) update.bio = bio.trim();

    const client = await clientPromise;
    const db = client.db('Database');

    const before = await db.collection('bot_profiles').findOne({ _id: botId as any });

    await db.collection('bot_profiles').updateOne(
      { _id: botId as any },
      { $set: update },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: auth.session.user?.globalName ?? auth.session.user?.username ?? 'Unknown',
      action: 'bot_profile_update',
      before: before ? { status_text: before.status_text, status_type: before.status_type, avatar_url: before.avatar_url, banner_url: before.banner_url, bio: before.bio } : null,
      after: update,
      metadata: { botId, botName: BOT_NAMES[botId as BotId] },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, saved: true });
  } catch (error) {
    console.error('Failed to save bot profile:', error);
    return NextResponse.json({ error: 'Failed to save bot profile' }, { status: 500 });
  }
}
