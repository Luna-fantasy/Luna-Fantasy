import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit, rateLimitResponse } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB = 'Database';

// GET: Return all text keys with current values + defaults
export async function GET() {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const discordId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_texts', discordId, 20, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const client = await clientPromise;
    const doc = await client.db(DB).collection('bot_config').findOne({ _id: 'challenge_texts' as any });
    const currentValues: Record<string, string> = (doc as any)?.data || {};

    return NextResponse.json({ texts: currentValues });
  } catch (error) {
    console.error('Challenge texts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update one or more text keys
export async function PUT(req: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('admin_challenge_texts_write', adminId, 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const body = await req.json();
    const { updates } = body; // Record<string, string | null> — null means reset to default

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Invalid body: expected { updates: Record<string, string | null> }' }, { status: 400 });
    }

    // Validate text values
    for (const [key, value] of Object.entries(updates)) {
      if (typeof key !== 'string' || key.length > 100) {
        return NextResponse.json({ error: `Invalid key: ${key}` }, { status: 400 });
      }
      if (value !== null && (typeof value !== 'string' || value.length > 2000)) {
        return NextResponse.json({ error: `Invalid value for ${key} (max 2000 chars)` }, { status: 400 });
      }
      // Strip dangerous MongoDB operators
      if (key.startsWith('$') || key.includes('.')) {
        return NextResponse.json({ error: 'Invalid key format' }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const col = client.db(DB).collection('bot_config');

    // Get current state for audit
    const beforeDoc = await col.findOne({ _id: 'challenge_texts' as any });
    const before: Record<string, string> = (beforeDoc as any)?.data || {};

    // Build $set and $unset operations
    const setOps: Record<string, string> = {};
    const unsetOps: Record<string, string> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        unsetOps[`data.${key}`] = '';
      } else {
        setOps[`data.${key}`] = value as string;
      }
    }

    const updateOp: any = {};
    if (Object.keys(setOps).length > 0) updateOp.$set = setOps;
    if (Object.keys(unsetOps).length > 0) updateOp.$unset = unsetOps;

    if (Object.keys(updateOp).length > 0) {
      await col.updateOne({ _id: 'challenge_texts' as any }, updateOp, { upsert: true });
    }

    // Audit log
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: 'challenge_texts_update',
      before: { changedKeys: Object.keys(updates), oldValues: Object.fromEntries(Object.keys(updates).map(k => [k, before[k] || null])) },
      after: updates,
      metadata: { keyCount: Object.keys(updates).length },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, message: `Updated ${Object.keys(updates).length} text(s). Bot will use new texts within 30 seconds.` });
  } catch (error) {
    console.error('Challenge texts PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
