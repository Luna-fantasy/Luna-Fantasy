import { NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '1243327880478462032';

function getButlerToken(): string | null {
  const token = (process.env.BUTLER_BOT_TOKEN ?? process.env.ORACLE_BOT_TOKEN ?? '').trim();
  return token.length > 10 ? token : null;
}

export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_channels', discordId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const token = getButlerToken();
  if (!token) {
    return NextResponse.json({ error: 'Discord authentication not configured' }, { status: 500 });
  }

  try {
    // Timeout to prevent indefinite hang if Discord is slow
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, {
      headers: { Authorization: `Bot ${token}` },
      signal: controller.signal,
      next: { revalidate: 0 },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.error('Discord channels fetch failed:', res.status);
      return NextResponse.json({ error: `Discord API error: ${res.status}` }, { status: 502 });
    }

    const allChannels: any[] = await res.json();

    const categoryMap: Record<string, string> = {};
    for (const ch of allChannels) {
      if (ch.type === 4) categoryMap[ch.id] = ch.name;
    }

    const textChannels = allChannels
      .filter((ch: any) => ch.type === 0)
      .map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        parentId: ch.parent_id ?? null,
        parentName: ch.parent_id ? categoryMap[ch.parent_id] ?? 'Uncategorized' : 'No Category',
        position: ch.position ?? 0,
      }))
      .sort((a: any, b: any) => {
        if (a.parentName !== b.parentName) return a.parentName.localeCompare(b.parentName);
        return a.position - b.position;
      });

    return NextResponse.json({ channels: textChannels });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Discord API timed out' }, { status: 504 });
    }
    console.error('Channels fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}
