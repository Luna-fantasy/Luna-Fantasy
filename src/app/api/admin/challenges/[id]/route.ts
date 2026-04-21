import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB = 'Database';
const COL = 'community_challenges';
const DISCORD_EPOCH = 1420070400000;

function avatarUrl(userId: string, hash: string | null): string | null {
  if (!hash) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=64`;
}

function accountAgeDays(userId: string): number {
  try {
    const id = Number(userId);
    const timestamp = Math.floor(id / 4194304) + DISCORD_EPOCH;
    return Math.floor((Date.now() - timestamp) / 86400_000);
  } catch { return -1; }
}

// GET: Full detail for a single challenge (including votes + entries + rankings)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_detail', discordId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { id } = await params;

  let objId: ObjectId;
  try { objId = new ObjectId(id); }
  catch { return NextResponse.json({ error: 'Invalid challenge ID' }, { status: 400 }); }

  try {
    const client = await clientPromise;
    const db = client.db(DB);
    const ch = await db.collection(COL).findOne({ _id: objId });

    if (!ch) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

    // Resolve user IDs
    const userIds = new Set<string>();
    if (ch.createdBy) userIds.add(ch.createdBy);
    if (ch.closedBy) userIds.add(ch.closedBy);
    for (const e of (ch.entries || [])) userIds.add(e.userId);
    for (const v of (ch.votes || [])) { userIds.add(v.voterId); userIds.add(v.votedForUserId); }

    const ids = Array.from(userIds);
    const userMap = new Map<string, { name: string; avatar: string | null }>();

    if (ids.length > 0) {
      const [webUsers, discordUsers] = await Promise.all([
        db.collection('users').find({ discordId: { $in: ids } }).project({ discordId: 1, username: 1, globalName: 1, image: 1 }).toArray(),
        db.collection('discord_users').find({ _id: { $in: ids } as any }).project({ _id: 1, username: 1, avatar: 1 }).toArray(),
      ]);
      for (const u of discordUsers) {
        if (u.username) userMap.set(String(u._id), { name: u.username, avatar: u.avatar ?? null });
      }
      for (const u of webUsers) {
        userMap.set(u.discordId, { name: u.globalName || u.username || '', avatar: u.image ?? null });
      }
    }

    // Enrich entries
    const entries = (ch.entries || []).map((e: any) => ({
      userId: e.userId,
      username: e.username || userMap.get(e.userId)?.name || e.userId,
      avatar: avatarUrl(e.userId, userMap.get(e.userId)?.avatar ?? null),
      imageUrl: e.imageUrl,
      content: e.content,
      submittedAt: e.submittedAt,
    }));

    // Enrich votes
    const votes = (ch.votes || []).map((v: any) => {
      const voterInfo = userMap.get(v.voterId);
      const votedForInfo = userMap.get(v.votedForUserId);
      return {
        voterId: v.voterId,
        voterName: voterInfo?.name || v.voterId,
        voterAvatar: avatarUrl(v.voterId, voterInfo?.avatar ?? null),
        voterAccountAge: accountAgeDays(v.voterId),
        votedForUserId: v.votedForUserId,
        votedForUsername: votedForInfo?.name || v.votedForUserId,
        votedAt: v.votedAt,
        flagged: v.flagged || false,
        flagReason: v.flagReason || null,
      };
    });

    // Compute rankings (tally votes)
    const voteCounts = new Map<string, number>();
    for (const v of (ch.votes || [])) {
      voteCounts.set(v.votedForUserId, (voteCounts.get(v.votedForUserId) || 0) + 1);
    }
    const rankings = entries.map((e: any) => ({
      userId: e.userId,
      username: e.username,
      avatar: e.avatar,
      imageUrl: e.imageUrl,
      content: e.content,
      votes: voteCounts.get(e.userId) || 0,
    }))
    .sort((a: any, b: any) => b.votes - a.votes)
    .map((r: any, i: number) => ({ ...r, rank: i + 1 }));

    return NextResponse.json({
      challenge: {
        _id: ch._id,
        name: ch.name,
        description: ch.description,
        type: ch.type || 'image',
        status: ch.status,
        entryCount: ch.entryCount ?? entries.length,
        voteCount: ch.voteCount ?? 0,
        flaggedVoteCount: ch.flaggedVoteCount ?? 0,
        reward: ch.reward,
        createdBy: ch.createdBy,
        createdByName: userMap.get(ch.createdBy)?.name || ch.createdBy,
        createdAt: ch.createdAt,
        closedAt: ch.closedAt,
        closedBy: ch.closedBy,
        closedByName: ch.closedBy ? (userMap.get(ch.closedBy)?.name || ch.closedBy) : null,
      },
      entries,
      votes,
      rankings,
    });
  } catch (err) {
    console.error('[Challenge Detail] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 });
  }
}
