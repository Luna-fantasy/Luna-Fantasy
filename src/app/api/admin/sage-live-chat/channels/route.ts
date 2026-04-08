import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { hasMongoOperator, getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const CHANNEL_ID_REGEX = /^\d{17,20}$/;

export async function GET() {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  try {
    const client = await clientPromise;
    const db = client.db('Database');

    // Read channel overrides from the live chat config
    const configDoc = await db.collection('bot_config').findOne({ _id: 'sage_live_chat' as any });
    const channelOverrides = configDoc?.data?.channelOverrides ?? {};

    // Read sage_settings to find the list of Sage-enabled channels (if available)
    const settingsDoc = await db.collection('bot_config').findOne({ _id: 'sage_settings' as any });
    const enabledChannels: string[] = settingsDoc?.data?.enabledChannels ?? [];

    return NextResponse.json({
      channelOverrides,
      enabledChannels,
    });
  } catch (err) {
    console.error('[sage-live-chat/channels] GET error:', err);
    return NextResponse.json({ error: 'Failed to read channel data' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireMastermindApi();
  if (!auth.authorized) return auth.response;

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const adminId = auth.session.user.discordId!;
  const adminUsername = auth.session.user.username ?? 'unknown';

  const { allowed, retryAfterMs } = checkRateLimit('sage_channel_override', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limited', retryAfterMs },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { channelId, overrides } = body;

    // Validate channelId (Discord snowflake)
    if (!channelId || typeof channelId !== 'string' || !CHANNEL_ID_REGEX.test(channelId)) {
      return NextResponse.json(
        { error: 'channelId must be a valid Discord channel ID (17-20 digit string)' },
        { status: 400 },
      );
    }

    // Validate overrides object
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      return NextResponse.json(
        { error: 'overrides must be an object' },
        { status: 400 },
      );
    }

    // Check for NoSQL injection
    if (hasMongoOperator(overrides)) {
      return NextResponse.json({ error: 'Invalid overrides value' }, { status: 400 });
    }

    // Only allow known override keys
    const allowedKeys = ['autoJoin', 'reactions'];
    const providedKeys = Object.keys(overrides);

    for (const key of providedKeys) {
      if (!allowedKeys.includes(key)) {
        return NextResponse.json(
          { error: `Invalid override key: ${key}. Allowed: ${allowedKeys.join(', ')}` },
          { status: 400 },
        );
      }
      if (typeof overrides[key] !== 'boolean') {
        return NextResponse.json(
          { error: `Override '${key}' must be a boolean` },
          { status: 400 },
        );
      }
    }

    if (providedKeys.length === 0) {
      return NextResponse.json(
        { error: 'At least one override must be provided' },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db('Database');

    // Read current overrides for audit trail
    const currentDoc = await db.collection('bot_config').findOne({ _id: 'sage_live_chat' as any });
    const beforeOverrides = currentDoc?.data?.channelOverrides?.[channelId] ?? null;

    // Build the $set update for each provided override key
    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: adminId,
    };
    for (const key of providedKeys) {
      updateFields[`data.channelOverrides.${channelId}.${key}`] = overrides[key];
    }

    await db.collection('bot_config').updateOne(
      { _id: 'sage_live_chat' as any },
      { $set: updateFields },
      { upsert: true },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername,
      action: 'sage_channel_override_update',
      before: beforeOverrides,
      after: overrides,
      metadata: { channelId },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, channelId, overrides });
  } catch (err) {
    console.error('[sage-live-chat/channels] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update channel override' }, { status: 500 });
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

  const { allowed } = checkRateLimit('sage_channel_delete', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { channelId } = body;

    if (!channelId || typeof channelId !== 'string' || !CHANNEL_ID_REGEX.test(channelId)) {
      return NextResponse.json(
        { error: 'channelId must be a valid Discord channel ID' },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db('Database');

    const currentDoc = await db.collection('bot_config').findOne({ _id: 'sage_live_chat' as any });
    const beforeOverride = currentDoc?.data?.channelOverrides?.[channelId] ?? null;

    await db.collection('bot_config').updateOne(
      { _id: 'sage_live_chat' as any },
      { $unset: { [`data.channelOverrides.${channelId}`]: 1 } },
    );

    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername,
      action: 'sage_channel_override_delete',
      before: beforeOverride,
      after: null,
      metadata: { channelId },
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, channelId });
  } catch (err) {
    console.error('[sage-live-chat/channels] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete channel override' }, { status: 500 });
  }
}
