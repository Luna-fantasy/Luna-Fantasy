import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf, refreshCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '1243327880478462032';

function getOracleToken(): string | null {
  return process.env.ORACLE_BOT_TOKEN ?? null;
}

// GET — List available text channels grouped by category
export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const token = getOracleToken();
  if (!token) {
    return NextResponse.json({ error: 'ORACLE_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, {
      headers: { Authorization: `Bot ${token}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Discord channel fetch failed:', res.status, errText);
      return NextResponse.json(
        { error: `Discord API error: ${res.status}` },
        { status: 502 }
      );
    }

    const allChannels: any[] = await res.json();

    // Build a category name map
    const categoryMap: Record<string, string> = {};
    for (const ch of allChannels) {
      if (ch.type === 4) {
        categoryMap[ch.id] = ch.name;
      }
    }

    // Filter to text channels (type 0) and announcement channels (type 5)
    const textChannels = allChannels
      .filter((ch: any) => ch.type === 0 || ch.type === 5)
      .map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        parentId: ch.parent_id ?? null,
        parentName: ch.parent_id ? categoryMap[ch.parent_id] ?? 'Uncategorized' : 'No Category',
        position: ch.position ?? 0,
      }))
      .sort((a: any, b: any) => {
        // Sort by parent name, then by position
        if (a.parentName !== b.parentName) return a.parentName.localeCompare(b.parentName);
        return a.position - b.position;
      });

    // Fetch guild emojis
    let emojis: any[] = [];
    try {
      const emojiRes = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/emojis`, {
        headers: { Authorization: `Bot ${token}` },
        next: { revalidate: 0 },
      });
      if (emojiRes.ok) {
        emojis = (await emojiRes.json())
          .filter((e: any) => e.available !== false)
          .map((e: any) => ({ id: e.id, name: e.name, animated: !!e.animated }));
      }
    } catch {}

    return NextResponse.json({ channels: textChannels, emojis });
  } catch (error) {
    console.error('Discord channel fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
  }
}

// POST — Send an announcement to a channel
export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed } = checkRateLimit('admin_write', adminId, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited — max 5 announces per minute' }, { status: 429 });
  }

  const token = getOracleToken();
  if (!token) {
    return NextResponse.json({ error: 'ORACLE_BOT_TOKEN not configured' }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { channelId, content, imageData, imageType } = body;

  if (!channelId || typeof channelId !== 'string') {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
  }

  if (content.length > 4000) {
    return NextResponse.json({ error: 'Message too long (max 4000 characters)' }, { status: 400 });
  }

  // Validate channelId format (snowflake)
  if (!/^\d{17,20}$/.test(channelId)) {
    return NextResponse.json({ error: 'Invalid channel ID format' }, { status: 400 });
  }

  try {
    let res: Response;

    if (imageData && typeof imageData === 'string') {
      // Send with image attachment via multipart form data
      const buffer = Buffer.from(imageData, 'base64');

      // Validate image size (max 8MB)
      if (buffer.length > 8 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 });
      }

      const resolvedType = imageType || 'image/png';
      const ext = resolvedType.includes('gif') ? 'gif'
        : resolvedType.includes('jpeg') || resolvedType.includes('jpg') ? 'jpg'
        : resolvedType.includes('webp') ? 'webp'
        : 'png';

      const form = new FormData();
      form.append('payload_json', JSON.stringify({ content: content.trim() }));
      form.append(
        'files[0]',
        new Blob([buffer], { type: resolvedType }),
        `announcement.${ext}`
      );

      res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${token}` },
        body: form,
      });
    } else {
      // Text-only message
      res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() }),
      });
    }

    if (!res.ok) {
      const errBody = await res.text();
      console.error('Discord send failed:', res.status, errBody);

      if (res.status === 403) {
        return NextResponse.json(
          { error: 'Bot lacks permission to post in this channel' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Discord API error: ${res.status}` },
        { status: 502 }
      );
    }

    const msg = await res.json();

    // Audit log
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'oracle_announce',
      before: null,
      after: {
        channelId,
        messageId: msg.id,
        contentPreview: content.trim().substring(0, 200),
        hasImage: !!imageData,
      },
      metadata: { channelId, messageId: msg.id },
      ip: getClientIp(request),
    });

    const response = NextResponse.json({ success: true, messageId: msg.id });
    return refreshCsrf(response);
  } catch (error) {
    console.error('Announce send error:', error);
    return NextResponse.json({ error: 'Failed to send announcement' }, { status: 500 });
  }
}
