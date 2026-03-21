import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { discordId: string } }
) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  const { discordId } = params;
  if (!/^\d{17,20}$/.test(discordId)) {
    return NextResponse.json({ error: 'Invalid Discord ID' }, { status: 400 });
  }

  let body: { amount: number; reason: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { amount, reason } = body;
  if (typeof amount !== 'number' || amount === 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Amount must be a non-zero integer' }, { status: 400 });
  }
  if (Math.abs(amount) > 200) {
    return NextResponse.json({ error: 'Amount cannot exceed 200 levels at once' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 500) {
    return NextResponse.json({ error: 'Reason required (3-500 characters)' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('Database');
    const levelsCol = db.collection('levels');

    const doc = await levelsCol.findOne({ _id: discordId as any });
    let levelBefore = 0;
    let xpBefore = 0;
    if (doc) {
      if (doc.level !== undefined) {
        levelBefore = doc.level ?? 0;
        xpBefore = doc.xp ?? 0;
      } else if (doc.data) {
        const raw = typeof doc.data === 'string' ? (() => { try { return JSON.parse(doc.data); } catch { return null; } })() : doc.data;
        levelBefore = raw?.level ?? 0;
        xpBefore = raw?.xp ?? 0;
      }
    }

    const levelAfter = levelBefore + amount;
    if (levelAfter < 0) {
      return NextResponse.json({
        error: `Cannot reduce below 0. Current level: ${levelBefore}`,
        level: levelBefore,
      }, { status: 400 });
    }

    // Sync XP to match the new level using Butler's formula: xp = (level * 10)^2
    // Without this, the bot recalculates level from stale XP on next interaction
    const xpForLevel = Math.floor(Math.pow(levelAfter * 10, 2));

    await levelsCol.updateOne(
      { _id: discordId as any },
      { $set: { level: levelAfter, xp: xpForLevel }, $unset: { data: "" } },
      { upsert: true }
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? authResult.session.user?.username ?? 'Unknown',
      action: 'level_modify',
      targetDiscordId: discordId,
      before: { level: levelBefore, xp: xpBefore },
      after: { level: levelAfter, xp: xpForLevel },
      metadata: { amount, reason: reason.trim() },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, levelBefore, levelAfter });
  } catch (error) {
    console.error('Level modify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
