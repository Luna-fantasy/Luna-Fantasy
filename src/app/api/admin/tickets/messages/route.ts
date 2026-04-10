import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

export async function GET(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_read', discordId, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const threadId = request.nextUrl.searchParams.get('threadId');
  if (!threadId || !/^\d+$/.test(threadId)) {
    return NextResponse.json({ error: 'Invalid threadId' }, { status: 400 });
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${DISCORD_API}/channels/${threadId}/messages?limit=100`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
    });

    if (!res.ok) {
      if (res.status === 404) return NextResponse.json({ messages: [], error: 'Thread not found or deleted' });
      if (res.status === 403) return NextResponse.json({ messages: [], error: 'No access to thread' });
      return NextResponse.json({ error: `Discord API ${res.status}` }, { status: 502 });
    }

    const rawMessages = await res.json();

    const messages = rawMessages.reverse().map((m: any) => ({
      id: m.id,
      author: m.author?.username || 'Unknown',
      authorId: m.author?.id,
      avatar: m.author?.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : null,
      isBot: m.author?.bot || false,
      content: m.content || '',
      timestamp: m.timestamp,
      embeds: m.embeds?.length || 0,
      attachments: m.attachments?.map((a: any) => ({ name: a.filename, url: a.url })) || [],
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[admin/tickets/messages] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
