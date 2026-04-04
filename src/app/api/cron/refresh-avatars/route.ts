import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import clientPromise from '@/lib/mongodb';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '1243327880478462032';

/**
 * POST /api/cron/refresh-avatars
 * Fetches current guild member avatars from Discord API and updates
 * both `discord_users` and `users` collections with fresh data.
 * Protected by x-cron-secret header. Run every 6 hours.
 */
export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected || !cronSecret ||
      Buffer.byteLength(cronSecret) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.DISCORD_BOT_TOKEN ?? process.env.ORACLE_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'No bot token configured' }, { status: 500 });
  }

  try {
    // Fetch all guild members (paginated, 1000 per request)
    const allMembers: { id: string; username: string; globalName: string | null; avatar: string | null }[] = [];
    let after = '0';

    for (let i = 0; i < 10; i++) { // max 10 pages = 10,000 members
      const res = await fetch(
        `${DISCORD_API}/guilds/${GUILD_ID}/members?limit=1000&after=${after}`,
        { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Discord API error (${res.status}): ${err}` }, { status: 502 });
      }

      const members: any[] = await res.json();
      if (members.length === 0) break;

      for (const m of members) {
        if (m.user) {
          allMembers.push({
            id: m.user.id,
            username: m.user.username,
            globalName: m.user.global_name ?? null,
            avatar: m.user.avatar ?? null,
          });
        }
      }

      after = members[members.length - 1].user?.id ?? after;
      if (members.length < 1000) break;
    }

    if (allMembers.length === 0) {
      return NextResponse.json({ fetched: 0, updatedBotCache: 0, updatedWebUsers: 0 });
    }

    const client = await clientPromise;
    const db = client.db('Database');

    // Batch update discord_users collection
    const botCacheOps = allMembers.map(m => ({
      updateOne: {
        filter: { _id: m.id as any },
        update: {
          $set: {
            username: m.username,
            ...(m.globalName ? { globalName: m.globalName } : {}),
            avatar: m.avatar,
            fetchedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const botResult = await db.collection('discord_users').bulkWrite(botCacheOps, { ordered: false });

    // Update users collection (website accounts) with fresh avatar URLs
    const memberMap = new Map(allMembers.map(m => [m.id, m]));
    const webUsers = await db.collection('users')
      .find({ discordId: { $in: allMembers.map(m => m.id) } })
      .project({ discordId: 1, image: 1 })
      .toArray();

    let webUpdated = 0;
    const webOps = [];

    for (const user of webUsers) {
      const member = memberMap.get(user.discordId);
      if (!member) continue;

      // Build the current Discord avatar URL
      let freshUrl: string | null = null;
      if (member.avatar) {
        const ext = member.avatar.startsWith('a_') ? 'gif' : 'png';
        freshUrl = `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.${ext}?size=128`;
      }

      // Only update if the URL changed
      if (freshUrl && freshUrl !== user.image) {
        webOps.push({
          updateOne: {
            filter: { discordId: user.discordId },
            update: { $set: { image: freshUrl } },
          },
        });
      }
    }

    if (webOps.length > 0) {
      const webResult = await db.collection('users').bulkWrite(webOps, { ordered: false });
      webUpdated = webResult.modifiedCount;
    }

    return NextResponse.json({
      fetched: allMembers.length,
      updatedBotCache: botResult.upsertedCount + botResult.modifiedCount,
      updatedWebUsers: webUpdated,
    });
  } catch (error: any) {
    console.error('[refresh-avatars] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
