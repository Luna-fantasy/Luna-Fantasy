import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import { getCanvasDefinition } from '@/lib/admin/canvas-definitions';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 30_000;
const VALID_BOTS = ['butler', 'jester'] as const;

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user.discordId!;
  const { allowed } = checkRateLimit('canvas_test_deploy', adminId, 3, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited. Max 3 test deploys per minute.' }, { status: 429 });
  }

  try {
    const { canvasType, channelId, bot } = await req.json();

    if (!canvasType || typeof canvasType !== 'string') {
      return NextResponse.json({ error: 'canvasType is required' }, { status: 400 });
    }
    if (!channelId || !/^\d{17,20}$/.test(channelId)) {
      return NextResponse.json({ error: 'Valid channelId is required' }, { status: 400 });
    }
    if (!VALID_BOTS.includes(bot)) {
      return NextResponse.json({ error: 'bot must be "butler" or "jester"' }, { status: 400 });
    }

    const def = getCanvasDefinition(canvasType);
    if (!def || def.bot !== bot) {
      return NextResponse.json({ error: `Canvas type "${canvasType}" not valid for bot "${bot}"` }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('canvas_test_requests');

    // Ensure TTL index exists (auto-delete after 1 hour)
    try {
      await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
    } catch {
      // Index already exists
    }

    // Insert test request
    const result = await col.insertOne({
      canvasType,
      channelId,
      bot,
      status: 'pending',
      requestedBy: adminId,
      createdAt: new Date(),
    });

    const requestId = result.insertedId;

    // Poll for completion
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const doc = await col.findOne({ _id: requestId });
      if (!doc) {
        return NextResponse.json({ error: 'Request disappeared' }, { status: 500 });
      }

      if (doc.status === 'completed') {
        return NextResponse.json({ success: true, messageUrl: doc.messageUrl ?? '' });
      }
      if (doc.status === 'failed') {
        return NextResponse.json({ error: doc.error ?? 'Bot render failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'timeout' }, { status: 504 });
  } catch (error) {
    console.error('[admin/canvas/test-deploy POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
