import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { sanitizeErrorMessage } from '@/lib/admin/sanitize';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '1243327880478462032';

function getBotToken(): string | null {
  return process.env.DISCORD_BOT_TOKEN ?? process.env.ORACLE_BOT_TOKEN ?? null;
}

// ── Types ──

interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

interface GuildChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  parentName: string;
  position: number;
}

interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
}

interface GuildData {
  roles: GuildRole[];
  channels: GuildChannel[];
  emojis: GuildEmoji[];
}

// ── Server-side cache (5-minute TTL) ──

let cachedData: GuildData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchGuildData(token: string): Promise<GuildData> {
  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  const headers = { Authorization: `Bot ${token}` };

  const [guildRes, channelsRes, emojisRes] = await Promise.all([
    fetch(`${DISCORD_API}/guilds/${GUILD_ID}?with_counts=false`, { headers, cache: 'no-store' }),
    fetch(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, { headers, cache: 'no-store' }),
    fetch(`${DISCORD_API}/guilds/${GUILD_ID}/emojis`, { headers, cache: 'no-store' }),
  ]);

  if (!guildRes.ok) {
    const err = await guildRes.text();
    throw new Error(`Discord guild fetch failed (${guildRes.status}): ${err}`);
  }
  if (!channelsRes.ok) {
    const err = await channelsRes.text();
    throw new Error(`Discord channels fetch failed (${channelsRes.status}): ${err}`);
  }

  const guild = await guildRes.json();
  const allChannels: any[] = await channelsRes.json();
  const rawEmojis: any[] = emojisRes.ok ? await emojisRes.json() : [];

  // ── Process roles ──
  const roles: GuildRole[] = (guild.roles ?? [])
    .filter((r: any) => r.name !== '@everyone')
    .map((r: any) => ({
      id: r.id,
      name: r.name,
      color: r.color ?? 0,
      position: r.position ?? 0,
      managed: !!r.managed,
    }))
    .sort((a: GuildRole, b: GuildRole) => b.position - a.position);

  // ── Process channels ──
  const categoryMap: Record<string, string> = {};
  for (const ch of allChannels) {
    if (ch.type === 4) {
      categoryMap[ch.id] = ch.name;
    }
  }

  const channels: GuildChannel[] = allChannels
    .filter((ch: any) => ch.type === 0 || ch.type === 2 || ch.type === 5 || ch.type === 15)
    .map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parentId: ch.parent_id ?? null,
      parentName: ch.parent_id ? categoryMap[ch.parent_id] ?? 'Uncategorized' : 'No Category',
      position: ch.position ?? 0,
    }))
    .sort((a: GuildChannel, b: GuildChannel) => {
      if (a.parentName !== b.parentName) return a.parentName.localeCompare(b.parentName);
      return a.position - b.position;
    });

  // ── Process emojis ──
  const emojis: GuildEmoji[] = rawEmojis
    .filter((e: any) => e.available !== false)
    .map((e: any) => ({
      id: e.id,
      name: e.name,
      animated: !!e.animated,
    }));

  const data: GuildData = { roles, channels, emojis };
  cachedData = data;
  cacheTimestamp = now;
  return data;
}

// ── GET handler ──

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const token = getBotToken();
  if (!token) {
    return NextResponse.json(
      { error: 'No Discord bot token configured (DISCORD_BOT_TOKEN or ORACLE_BOT_TOKEN)' },
      { status: 500 }
    );
  }

  try {
    const data = await fetchGuildData(token);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Guild data fetch error:', error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error.message || 'Failed to fetch guild data') },
      { status: 502 }
    );
  }
}
