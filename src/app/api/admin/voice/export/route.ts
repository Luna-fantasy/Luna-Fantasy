import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB = 'Database';

// GET: Export voice room data as CSV or JSON
export async function GET(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_voice_export', discordId, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';

    const client = await clientPromise;
    const db = client.db(DB);

    // Fetch active rooms
    const rooms = await db.collection('vc_rooms')
      .find({})
      .project({
        _id: 1, name: 1, ownerId: 1, type: 1, vipTier: 1,
        'aura.tier': 1, 'aura.score': 1, memberCount: 1,
        isLocked: 1, isHidden: 1, createdAt: 1,
        'stats.totalVisitors': 1, 'stats.uniqueVisitors': 1, 'stats.peakMembers': 1,
      })
      .toArray();

    // Fetch top users
    const users = await db.collection('vc_user_stats')
      .find({})
      .project({
        _id: 1, totalRoomsCreated: 1, totalVoiceMinutes: 1,
        challengesWon: 1,
      })
      .toArray();

    if (format === 'json') {
      const payload = { rooms, users };
      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="voice_export.json"',
        },
      });
    }

    // RFC 4180 CSV escaping — prevents formula injection (=, +, -, @)
    const escapeCSV = (val: string): string => {
      let safe = val;
      if (/^[=+\-@]/.test(safe)) safe = '\t' + safe;
      return '"' + safe.replace(/"/g, '""') + '"';
    };

    // Section 1: Active rooms
    const lines: string[] = [
      'room_id,name,owner_id,type,aura_tier,aura_score,members,visitors,peak,locked,created',
    ];

    for (const r of rooms) {
      const roomId = escapeCSV(String(r._id));
      const name = escapeCSV(String(r.name || ''));
      const ownerId = escapeCSV(String(r.ownerId || ''));
      const type = escapeCSV(String(r.type || ''));
      const auraTier = escapeCSV(String(r.aura?.tier ?? ''));
      const auraScore = escapeCSV(String(r.aura?.score ?? 0));
      const members = escapeCSV(String(r.memberCount ?? 0));
      const visitors = escapeCSV(String(r.stats?.totalVisitors ?? 0));
      const peak = escapeCSV(String(r.stats?.peakMembers ?? 0));
      const locked = escapeCSV(r.isLocked ? 'true' : 'false');
      const created = escapeCSV(r.createdAt ? new Date(r.createdAt).toISOString() : '');
      lines.push([roomId, name, ownerId, type, auraTier, auraScore, members, visitors, peak, locked, created].join(','));
    }

    // Blank line separator
    lines.push('');

    // Section 2: Top users
    lines.push('user_id,rooms_created,voice_minutes,challenges_won');

    for (const u of users) {
      const userId = escapeCSV(String(u._id));
      const roomsCreated = escapeCSV(String(u.totalRoomsCreated ?? 0));
      const voiceMinutes = escapeCSV(String(u.totalVoiceMinutes ?? 0));
      const challengesWon = escapeCSV(String(u.challengesWon ?? 0));
      lines.push([userId, roomsCreated, voiceMinutes, challengesWon].join(','));
    }

    const csv = lines.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="voice_export.csv"',
      },
    });
  } catch (error) {
    console.error('Voice export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
