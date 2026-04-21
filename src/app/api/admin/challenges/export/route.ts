import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const DB = 'Database';

// GET: Export challenge data as CSV or JSON
export async function GET(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_export', discordId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const format = searchParams.get('format') || 'csv';

    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid challenge ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const col = client.db(DB).collection('community_challenges');
    const challenge = await col.findOne({ _id: new ObjectId(id) });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Resolve usernames
    const userIds = new Set<string>();
    for (const e of (challenge.entries || [])) userIds.add(e.userId);
    for (const v of (challenge.votes || [])) { userIds.add(v.voterId); userIds.add(v.votedForUserId); }

    const ids = Array.from(userIds);
    const userMap = new Map<string, string>();

    if (ids.length > 0) {
      const users = await client.db(DB).collection('discord_users')
        .find({ _id: { $in: ids } as any })
        .project({ _id: 1, username: 1 })
        .toArray();
      for (const u of users) userMap.set(String(u._id), u.username || String(u._id));
    }

    if (format === 'json') {
      // Full JSON export
      return new NextResponse(JSON.stringify(challenge, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="challenge_${id}.json"`,
        },
      });
    }

    // RFC 4180 CSV escaping — prevents formula injection (=, +, -, @)
    const escapeCSV = (val: string): string => {
      // Prefix formula-triggering chars with tab for defense-in-depth
      let safe = val;
      if (/^[=+\-@]/.test(safe)) safe = '\t' + safe;
      // Wrap in double quotes, escape internal quotes
      return '"' + safe.replace(/"/g, '""') + '"';
    };

    // CSV export — one row per vote
    const lines: string[] = [
      'voter_id,voter_name,voted_for_id,voted_for_name,timestamp,flagged,flag_reason',
    ];

    for (const v of (challenge.votes || [])) {
      const voterName = userMap.get(v.voterId) || v.voterId;
      const votedForName = userMap.get(v.votedForUserId) || v.votedForUserId;
      const ts = v.votedAt ? new Date(v.votedAt).toISOString() : '';
      const flagged = v.flagged ? 'true' : 'false';
      const reason = (v.flagReason || '').replace(/\n/g, ' ');
      lines.push([v.voterId, escapeCSV(voterName), v.votedForUserId, escapeCSV(votedForName), ts, flagged, escapeCSV(reason)].join(','));
    }

    // Add entries section
    lines.push('');
    lines.push('--- ENTRIES ---');
    lines.push('user_id,username,image_url,submitted_at');
    for (const e of (challenge.entries || [])) {
      const username = e.username || userMap.get(e.userId) || e.userId;
      const ts = e.submittedAt ? new Date(e.submittedAt).toISOString() : '';
      lines.push([e.userId, escapeCSV(username), escapeCSV(e.imageUrl || ''), ts].join(','));
    }

    const csv = lines.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="challenge_${id}.csv"`,
      },
    });
  } catch (error) {
    console.error('Challenge export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
