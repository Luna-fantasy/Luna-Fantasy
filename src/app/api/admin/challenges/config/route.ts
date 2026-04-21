import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import clientPromise from '@/lib/mongodb';

const DB = 'Database';
const DOC_ID = 'challenge_config';

// Defaults match bot hardcoded values
const DEFAULTS = {
  hallOfFameChannelId: null as string | null,
  minJoinAgeMs: 3600_000,          // 1 hour
  minAccountAgeMs: 604800_000,     // 7 days
  suspiciousVoteThreshold: 3,
  maxGuildVotesPerSec: 10,
  cmdCooldownMs: 5000,
  voteChangeWindowMs: 120_000,     // 2 min
  updateIntervalMs: 30_000,
  maxTopEntriesShown: 5,
};

// Validation ranges — sane bounds
const RANGES: Record<string, { min: number; max: number }> = {
  minJoinAgeMs:           { min: 0,       max: 86400_000 * 30 },  // 0 to 30 days
  minAccountAgeMs:        { min: 0,       max: 86400_000 * 90 },  // 0 to 90 days
  suspiciousVoteThreshold:{ min: 2,       max: 20 },
  maxGuildVotesPerSec:    { min: 1,       max: 100 },
  cmdCooldownMs:          { min: 0,       max: 60_000 },          // 0 to 60s
  voteChangeWindowMs:     { min: 0,       max: 600_000 },         // 0 to 10 min
  updateIntervalMs:       { min: 10_000,  max: 300_000 },         // 10s to 5 min
  maxTopEntriesShown:     { min: 1,       max: 25 },
};

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const doc = await client.db(DB).collection('bot_config').findOne({ _id: DOC_ID as any });

    // Also check legacy hall_of_fame doc for backward compat
    let hofChannelId = doc?.hallOfFameChannelId ?? null;
    if (!hofChannelId) {
      const legacyHof = await client.db(DB).collection('bot_config').findOne({ _id: 'hall_of_fame' as any });
      hofChannelId = legacyHof?.channelId ?? null;
    }

    const config = {
      ...DEFAULTS,
      ...(doc || {}),
      hallOfFameChannelId: hofChannelId,
    };
    // Remove MongoDB internal fields
    delete (config as any)._id;
    delete (config as any).updatedAt;
    delete (config as any).updatedBy;

    return NextResponse.json({
      config,
      metadata: doc ? { updatedAt: doc.updatedAt, updatedBy: doc.updatedBy } : null,
    });
  } catch (err) {
    console.error('[ChallengeConfig] GET error:', err);
    return NextResponse.json({ config: DEFAULTS, metadata: null });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = auth.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_config', adminId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const body = await req.json();
    const config = body.config;
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Invalid config' }, { status: 400 });
    }

    // Validate and clamp each numeric field
    const sanitized: Record<string, any> = {};

    for (const [key, range] of Object.entries(RANGES)) {
      if (config[key] !== undefined) {
        const val = Number(config[key]);
        if (isNaN(val)) return NextResponse.json({ error: `${key} must be a number` }, { status: 400 });
        sanitized[key] = Math.max(range.min, Math.min(range.max, Math.floor(val)));
      }
    }

    // Hall of Fame channel — validate as snowflake or null
    if (config.hallOfFameChannelId !== undefined) {
      const hof = config.hallOfFameChannelId;
      if (hof === null || hof === '') {
        sanitized.hallOfFameChannelId = null;
      } else if (/^\d{17,20}$/.test(String(hof))) {
        sanitized.hallOfFameChannelId = String(hof);
      } else {
        return NextResponse.json({ error: 'Invalid Hall of Fame channel ID' }, { status: 400 });
      }
    }

    const adminName = auth.session.user?.globalName ?? 'Unknown';
    const ip = getClientIp(req);

    const client = await clientPromise;
    await client.db(DB).collection('bot_config').updateOne(
      { _id: DOC_ID as any },
      { $set: { ...sanitized, updatedAt: new Date(), updatedBy: adminName } },
      { upsert: true },
    );

    // Also update legacy hall_of_fame doc for backward compat with bot
    if (sanitized.hallOfFameChannelId !== undefined) {
      await client.db(DB).collection('bot_config').updateOne(
        { _id: 'hall_of_fame' as any },
        { $set: { channelId: sanitized.hallOfFameChannelId } },
        { upsert: true },
      );
    }

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: adminName,
      action: 'challenge_config_update',
      before: null,
      after: sanitized,
      metadata: {},
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ChallengeConfig] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
