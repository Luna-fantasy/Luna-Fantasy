import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp, hasMongoOperator } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB = 'Database';
const COL = 'community_challenges';
const HOF_COL = 'tournament_hall_of_fame';
const DISCORD_EPOCH = 1420070400000;

function avatarUrl(userId: string, hash: string | null): string | null {
  if (!hash) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=64`;
}

function accountAgeDays(userId: string): number {
  try {
    // Extract creation timestamp from Discord snowflake without BigInt (ES5 compat)
    const id = Number(userId);
    const timestamp = Math.floor(id / 4194304) + DISCORD_EPOCH;
    return Math.floor((Date.now() - timestamp) / 86400_000);
  } catch { return -1; }
}

// GET: List challenges + full vote data for active challenge
export async function GET(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenges', discordId, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const statusFilter = searchParams.get('status');

    const client = await clientPromise;
    const db = client.db(DB);
    const col = db.collection(COL);

    const filter: any = {};
    if (statusFilter) filter.status = statusFilter;

    // Fetch active challenge separately (with full entries + votes)
    const [activeChallenge, historyChallenges, total, hofDoc] = await Promise.all([
      col.findOne({ status: 'active' }), // Full document including votes
      col.find({ ...filter, status: { $ne: 'active' } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .project({ votes: 0 }) // Exclude votes for history (performance)
        .toArray(),
      col.countDocuments(filter),
      db.collection(HOF_COL).findOne({ guildId: { $exists: true } }),
    ]);

    // Collect all user IDs for resolution
    const userIds = new Set<string>();
    const allChallenges = activeChallenge ? [activeChallenge, ...historyChallenges] : historyChallenges;
    for (const ch of allChallenges) {
      if (ch.createdBy) userIds.add(ch.createdBy);
      if (ch.closedBy) userIds.add(ch.closedBy);
      for (const e of (ch.entries || [])) userIds.add(e.userId);
      for (const v of (ch.votes || [])) { userIds.add(v.voterId); userIds.add(v.votedForUserId); }
    }

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

    // Enrich a single challenge
    const enrichChallenge = (ch: any, includeVotes: boolean) => {
      const enrichedEntries = (ch.entries || []).map((e: any) => ({
        userId: e.userId,
        username: e.username || userMap.get(e.userId)?.name || e.userId,
        avatar: avatarUrl(e.userId, userMap.get(e.userId)?.avatar ?? null),
        imageUrl: e.imageUrl,
        submittedAt: e.submittedAt,
      }));

      const enrichedVotes = includeVotes ? (ch.votes || []).map((v: any) => {
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
      }) : undefined;

      return {
        _id: ch._id,
        name: ch.name,
        description: ch.description,
        type: ch.type || 'image',
        status: ch.status,
        guildId: ch.guildId,
        submissionChannelId: ch.submissionChannelId,
        votingChannelId: ch.votingChannelId,
        entryCount: ch.entryCount ?? (ch.entries || []).length,
        voteCount: ch.voteCount ?? 0,
        flaggedVoteCount: ch.flaggedVoteCount ?? 0,
        entries: enrichedEntries,
        votes: enrichedVotes,
        reward: ch.reward,
        createdBy: ch.createdBy,
        createdByName: userMap.get(ch.createdBy)?.name || ch.createdBy,
        createdAt: ch.createdAt,
        votingExpiresAt: ch.votingExpiresAt,
        closedAt: ch.closedAt,
        closedBy: ch.closedBy,
        closedByName: ch.closedBy ? (userMap.get(ch.closedBy)?.name || ch.closedBy) : null,
      };
    };

    const enrichedActive = activeChallenge ? enrichChallenge(activeChallenge, true) : null;
    const enrichedHistory = historyChallenges.map(ch => enrichChallenge(ch, false));

    // Summary stats
    const statsPipeline = await col.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        entries: { $sum: { $ifNull: ['$entryCount', 0] } },
        votes: { $sum: { $ifNull: ['$voteCount', 0] } },
      }}
    ]).toArray();

    const stats = { total: 0, active: 0, closed: 0, cancelled: 0, totalEntries: 0, totalVotes: 0 };
    for (const s of statsPipeline) {
      stats.total += s.count;
      stats.totalEntries += s.entries;
      stats.totalVotes += s.votes;
      if (s._id === 'active') stats.active = s.count;
      else if (s._id === 'closed') stats.closed = s.count;
      else if (s._id === 'cancelled') stats.cancelled = s.count;
    }

    return NextResponse.json({
      activeChallenge: enrichedActive,
      challenges: enrichedHistory,
      total,
      page,
      limit,
      stats,
      hallOfFame: hofDoc?.winners || [],
    });
  } catch (error) {
    console.error('Challenges GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new challenge from the dashboard
export async function POST(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenges_write', adminId, 5, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });

  try {
    const body = await req.json();
    const { name, description, type, submissionChannelId, votingChannelId, logChannelId, reward1st, reward2nd, reward3rd, duration, scheduledAt } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Invalid name (1-100 chars)' }, { status: 400 });
    }
    if (!submissionChannelId || !/^\d{17,20}$/.test(submissionChannelId)) {
      return NextResponse.json({ error: 'Invalid submission channel' }, { status: 400 });
    }
    if (!votingChannelId || !/^\d{17,20}$/.test(votingChannelId)) {
      return NextResponse.json({ error: 'Invalid voting channel' }, { status: 400 });
    }
    if (hasMongoOperator(body)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const client = await clientPromise;
    const col = client.db(DB).collection(COL);

    // Schedule support: validate + check if scheduledAt is in the future
    if (scheduledAt && isNaN(new Date(scheduledAt).getTime())) {
      return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
    }
    const isScheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 60_000;

    // Only block if there's already an active challenge (scheduled ones are fine)
    if (!isScheduled) {
      const existing = await col.findOne({ status: 'active' });
      if (existing) {
        return NextResponse.json({ error: `Active challenge already exists: "${existing.name}"` }, { status: 409 });
      }
    }

    const sanitizedName = name.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/```/g, '').trim();
    const sanitizedDesc = description ? String(description).replace(/@(everyone|here)/gi, '@\u200b$1').replace(/```/g, '').slice(0, 500) : undefined;

    const tiers: any[] = [];
    const MAX_REWARD = 1_000_000;
    const r1 = Math.min(Math.floor(Number(reward1st) || 0), MAX_REWARD);
    const r2 = Math.min(Math.floor(Number(reward2nd) || 0), MAX_REWARD);
    const r3 = Math.min(Math.floor(Number(reward3rd) || 0), MAX_REWARD);
    if (r1 > 0) tiers.push({ rank: 1, amount: r1 });
    if (r2 > 0) tiers.push({ rank: 2, amount: r2 });
    if (r3 > 0) tiers.push({ rank: 3, amount: r3 });

    const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '1243327880478462032';

    const doc: any = {
      name: sanitizedName,
      description: sanitizedDesc,
      type: type || 'image',
      status: isScheduled ? 'scheduled' : 'active',
      ...(isScheduled ? { scheduledAt: new Date(scheduledAt) } : {}),
      guildId: GUILD_ID,
      submissionChannelId,
      votingChannelId,
      logChannelId: logChannelId && /^\d{17,20}$/.test(logChannelId) ? logChannelId : undefined,
      entries: [],
      votes: [],
      lockedUsers: [],
      entryCount: 0,
      voteCount: 0,
      flaggedVoteCount: 0,
      createdBy: adminId,
      createdAt: new Date(),
    };

    if (tiers.length > 0) doc.reward = { type: 'lunari', tiers };
    if (duration && Number(duration) > 0) {
      const ms = Number(duration) * 3600_000;
      doc.votingDuration = ms;
      doc.votingExpiresAt = new Date(Date.now() + ms);
    }

    const result = await col.insertOne(doc);

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'challenge_create',
      before: null,
      after: { name: sanitizedName, type: doc.type, submissionChannelId, votingChannelId },
      metadata: { challengeId: result.insertedId.toString(), reward: tiers.length > 0 ? tiers : undefined },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      challengeId: result.insertedId.toString(),
      message: `Challenge "${sanitizedName}" created. The bot will pick it up within 60 seconds.`,
    });
  } catch (error) {
    console.error('Challenges POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Admin actions (close, cancel, remove entry)
export async function PUT(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenges_write', adminId, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });

  try {
    const body = await req.json();
    const { action, challengeId, userId } = body;

    if (!challengeId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!['close', 'cancel', 'remove_entry'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    let objId: ObjectId;
    try { objId = new ObjectId(challengeId); } catch { return NextResponse.json({ error: 'Invalid ID' }, { status: 400 }); }

    const client = await clientPromise;
    const col = client.db(DB).collection(COL);
    const challenge = await col.findOne({ _id: objId });
    if (!challenge) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const adminName = authResult.session.user?.globalName ?? 'Unknown';

    if (action === 'close') {
      if (challenge.status !== 'active') return NextResponse.json({ error: 'Must be active to close' }, { status: 400 });
      await col.updateOne({ _id: objId }, { $set: { status: 'closed', closedAt: new Date(), closedBy: adminId } });
      await logAdminAction({ adminDiscordId: adminId, adminUsername: adminName, action: 'challenge_close', before: { status: 'active' }, after: { status: 'closed' }, metadata: { challengeName: challenge.name }, ip: getClientIp(req) });
      return NextResponse.json({ success: true, message: 'Challenge closed. Use bot command for full results + rewards.' });
    }

    if (action === 'cancel') {
      if (challenge.status !== 'active') return NextResponse.json({ error: 'Must be active to cancel' }, { status: 400 });
      await col.updateOne({ _id: objId }, { $set: { status: 'cancelled', closedAt: new Date(), closedBy: adminId } });
      await logAdminAction({ adminDiscordId: adminId, adminUsername: adminName, action: 'challenge_cancel', before: { status: 'active' }, after: { status: 'cancelled' }, metadata: { challengeName: challenge.name }, ip: getClientIp(req) });
      return NextResponse.json({ success: true, message: 'Challenge cancelled.' });
    }

    if (action === 'remove_entry') {
      if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      const entry = (challenge.entries || []).find((e: any) => e.userId === userId);
      if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

      const votesToRemove = (challenge.votes || []).filter((v: any) => v.voterId === userId || v.votedForUserId === userId);
      const flaggedToRemove = votesToRemove.filter((v: any) => v.flagged).length;

      await col.updateOne({ _id: objId }, {
        $pull: { entries: { userId } as any, votes: { $or: [{ voterId: userId }, { votedForUserId: userId }] } as any, lockedUsers: userId } as any,
        $inc: { entryCount: -1, voteCount: -votesToRemove.length, flaggedVoteCount: -flaggedToRemove },
      } as any);

      await logAdminAction({ adminDiscordId: adminId, adminUsername: adminName, action: 'challenge_remove_entry', targetDiscordId: userId, before: { username: entry.username }, after: null, metadata: { challengeName: challenge.name, removedVotes: votesToRemove.length }, ip: getClientIp(req) });
      return NextResponse.json({ success: true, message: `Removed ${entry.username}` });
    }
  } catch (error) {
    console.error('Challenges PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
