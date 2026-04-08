import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const USER_ID_REGEX = /^\d+$/;
const MAX_FACT_LENGTH = 500;

export async function GET(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();

    const client = await clientPromise;
    const db = client.db('Database');

    const filter: Record<string, any> = {};
    if (search) {
      // Escape regex metacharacters to prevent ReDoS
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.userId = { $regex: escaped };
    }

    const docs = await db
      .collection('sage_user_memories')
      .find(filter)
      .sort({ userId: 1 })
      .limit(200)
      .toArray();

    return NextResponse.json(docs);
  } catch (err) {
    console.error('[sage-live-chat/memories] GET error:', err);
    return NextResponse.json({ error: 'Failed to read memories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user.discordId!;
  const adminUsername = auth.session.user.username ?? 'unknown';

  const { allowed, retryAfterMs } = checkRateLimit('sage_memory_write', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limited', retryAfterMs },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { userId, text, expiresAt } = body;

    // Validate userId
    if (!userId || typeof userId !== 'string' || !USER_ID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: 'userId must be a string of digits' },
        { status: 400 },
      );
    }

    // Validate text
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required and must be a string' }, { status: 400 });
    }

    const trimmedText = text.trim();
    if (trimmedText.length < 1 || trimmedText.length > MAX_FACT_LENGTH) {
      return NextResponse.json(
        { error: `text must be between 1 and ${MAX_FACT_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Check for NoSQL injection
    if (hasMongoOperator({ text: trimmedText })) {
      return NextResponse.json({ error: 'Invalid text content' }, { status: 400 });
    }

    // Validate expiresAt if provided
    let parsedExpiry: Date | null = null;
    if (expiresAt !== undefined && expiresAt !== null) {
      if (typeof expiresAt !== 'string') {
        return NextResponse.json(
          { error: 'expiresAt must be an ISO date string' },
          { status: 400 },
        );
      }
      parsedExpiry = new Date(expiresAt);
      if (isNaN(parsedExpiry.getTime())) {
        return NextResponse.json(
          { error: 'expiresAt is not a valid date' },
          { status: 400 },
        );
      }
      if (parsedExpiry.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'expiresAt must be a future date' },
          { status: 400 },
        );
      }
    }

    const fact: Record<string, any> = {
      text: trimmedText,
      setBy: adminUsername,
      setByRole: 'Mastermind',
      setAt: new Date(),
    };
    if (parsedExpiry) {
      fact.expiresAt = parsedExpiry;
    }

    const client = await clientPromise;
    const db = client.db('Database');

    await db.collection('sage_user_memories').updateOne(
      { userId },
      { $push: { facts: fact } as any },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername,
      action: 'sage_memory_add',
      targetDiscordId: userId,
      before: null,
      after: fact,
      metadata: { userId, expiresAt: parsedExpiry?.toISOString() ?? null },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, fact });
  } catch (err) {
    console.error('[sage-live-chat/memories] POST error:', err);
    return NextResponse.json({ error: 'Failed to add memory' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user.discordId!;
  const adminUsername = auth.session.user.username ?? 'unknown';

  const { allowed, retryAfterMs } = checkRateLimit('sage_memory_delete', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limited', retryAfterMs },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { userId, factIndex } = body;

    // Validate userId
    if (!userId || typeof userId !== 'string' || !USER_ID_REGEX.test(userId)) {
      return NextResponse.json(
        { error: 'userId must be a string of digits' },
        { status: 400 },
      );
    }

    // Validate factIndex
    if (typeof factIndex !== 'number' || !Number.isInteger(factIndex) || factIndex < 0) {
      return NextResponse.json(
        { error: 'factIndex must be a non-negative integer' },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db('Database');
    const collection = db.collection('sage_user_memories');

    // Fetch the document to verify the fact exists
    const doc = await collection.findOne({ userId });
    if (!doc) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!doc.facts || factIndex >= doc.facts.length) {
      return NextResponse.json({ error: 'Fact index out of range' }, { status: 404 });
    }

    const removedFact = doc.facts[factIndex];

    // Two-step removal: set the element to null, then pull all nulls
    // This avoids race conditions with positional array operations
    await collection.updateOne(
      { userId },
      { $unset: { [`facts.${factIndex}`]: 1 } },
    );
    await collection.updateOne(
      { userId },
      { $pull: { facts: null } as any },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername,
      action: 'sage_memory_remove',
      targetDiscordId: userId,
      before: removedFact,
      after: null,
      metadata: { userId, factIndex, removedText: removedFact?.text },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, removed: removedFact });
  } catch (err) {
    console.error('[sage-live-chat/memories] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to remove memory' }, { status: 500 });
  }
}
