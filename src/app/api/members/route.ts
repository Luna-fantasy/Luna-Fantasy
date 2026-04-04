import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import type { MemberListItem, MembersResponse } from '@/types/members';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit('members_browse', ip, RATE_LIMITS.members_browse.maxRequests, RATE_LIMITS.members_browse.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(48, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)));
    const search = url.searchParams.get('search') || '';
    const sort = url.searchParams.get('sort') || 'newest';

    const client = await clientPromise;
    const db = client.db('Database');

    // Build query filter
    const filter: Record<string, unknown> = {};
    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { globalName: { $regex: escaped, $options: 'i' } },
        { username: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Get total count
    const total = await db.collection('users').countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    // MongoDB sort for date-based sorts
    const mongoSort: Record<string, 1 | -1> =
      sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    // Fetch users
    const users = await db
      .collection('users')
      .find(filter)
      .sort(mongoSort)
      .skip((safePage - 1) * limit)
      .limit(limit)
      .toArray();

    if (users.length === 0) {
      return NextResponse.json({
        members: [],
        total,
        page: safePage,
        totalPages,
      } satisfies MembersResponse);
    }

    // Collect discord IDs for lookups
    const discordIds = users.map((u) => u.discordId);

    // Batch lookup: levels, points, cards, discord bot cache (fresher avatars)
    const [levelDocs, pointDocs, cardDocs, discordUserDocs] = await Promise.all([
      db.collection('levels').find({ _id: { $in: discordIds } as any }).toArray(),
      db.collection('points').find({ _id: { $in: discordIds } as any }).toArray(),
      db.collection('cards').find({ _id: { $in: discordIds } as any }).toArray(),
      db.collection('discord_users').find({ _id: { $in: discordIds } as any }).toArray(),
    ]);

    // Build lookup maps
    const levelMap = new Map<string, number>();
    for (const doc of levelDocs) {
      levelMap.set(String(doc._id), doc.level ?? 0);
    }

    const pointMap = new Map<string, number>();
    for (const doc of pointDocs) {
      pointMap.set(String(doc._id), typeof doc.balance === 'number' ? doc.balance : 0);
    }

    const cardCountMap = new Map<string, number>();
    for (const doc of cardDocs) {
      cardCountMap.set(String(doc._id), Array.isArray(doc.cards) ? doc.cards.length : 0);
    }

    // Discord bot cache — fresher avatar hashes
    const discordAvatarMap = new Map<string, string>();
    for (const doc of discordUserDocs) {
      if (doc.avatar) {
        const ext = doc.avatar.startsWith('a_') ? 'gif' : 'png';
        discordAvatarMap.set(String(doc._id), `https://cdn.discordapp.com/avatars/${doc._id}/${doc.avatar}.${ext}?size=128`);
      }
    }

    // Map to response shape — prefer bot-cached avatar over stale OAuth avatar
    let members: MemberListItem[] = users.map((u) => ({
      discordId: u.discordId,
      name: u.globalName || u.name || u.username || 'Unknown',
      username: u.username || '',
      image: u.image || discordAvatarMap.get(u.discordId) || null,
      joinedAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      level: levelMap.get(u.discordId) ?? 0,
      lunari: pointMap.get(u.discordId) ?? 0,
      cardCount: cardCountMap.get(u.discordId) ?? 0,
    }));

    // Post-sort for stat-based sorts (within the page)
    if (sort === 'level') {
      members.sort((a, b) => b.level - a.level);
    } else if (sort === 'lunari') {
      members.sort((a, b) => b.lunari - a.lunari);
    } else if (sort === 'cards') {
      members.sort((a, b) => b.cardCount - a.cardCount);
    }

    return NextResponse.json({
      members,
      total,
      page: safePage,
      totalPages,
    } satisfies MembersResponse);
  } catch (error) {
    console.error('[members] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
