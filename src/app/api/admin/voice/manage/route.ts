import { NextRequest, NextResponse } from 'next/server';
import { requireMastermindApi } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { getClientIp } from '@/lib/admin/sanitize';
import { validateCsrf } from '@/lib/bazaar/csrf';
import { checkRateLimit } from '@/lib/bazaar/rate-limit';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

const ALLOWED_ACTIONS = ['lock', 'unlock', 'delete', 'rename'] as const;
type ManageAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(request: NextRequest) {
  const authResult = await requireMastermindApi();
  if (!authResult.authorized) return authResult.response;

  const csrfValid = await validateCsrf(request);
  if (!csrfValid) return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });

  const adminId = authResult.session.user?.discordId ?? '';
  const { allowed, retryAfterMs } = checkRateLimit('voice_manage', adminId, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429 });
  }

  let body: { action: string; roomId: string; value?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, roomId, value: rawValue } = body;

  // Validate action
  if (!action || !ALLOWED_ACTIONS.includes(action as ManageAction)) {
    return NextResponse.json(
      { error: `action must be one of: ${ALLOWED_ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }

  // Validate roomId
  if (!roomId || typeof roomId !== 'string' || !/^\d{17,20}$/.test(roomId)) {
    return NextResponse.json({ error: 'roomId must be a valid Discord channel ID' }, { status: 400 });
  }

  // Validate value for rename action
  let value = rawValue;
  if (action === 'rename') {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      return NextResponse.json({ error: 'value must be a non-empty string for rename' }, { status: 400 });
    }
    if (value.length > 100) {
      return NextResponse.json({ error: 'value must be 100 characters or fewer' }, { status: 400 });
    }
    // Sanitize Discord markdown injection
    value = value.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/```/g, '');
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const col = db.collection('vc_rooms');

    // Verify room exists
    const room = await col.findOne({ _id: roomId as any });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Build the pending action entry
    const pendingAction: Record<string, unknown> = {
      action,
      by: adminId,
      at: new Date(),
    };
    if (action === 'rename' && value) {
      pendingAction.value = value.trim();
    }

    // Push to pendingActions array — bot picks these up on next aura cycle
    await col.updateOne(
      { _id: roomId as any },
      { $push: { pendingActions: pendingAction } as any },
    );

    // Audit log
    await logAdminAction({
      adminDiscordId: adminId,
      adminUsername: authResult.session.user?.globalName ?? 'Unknown',
      action: `voice_room_${action}`,
      targetDiscordId: room.ownerId ?? undefined,
      before: { roomId, name: room.name },
      after: { roomId, action, ...(action === 'rename' ? { newName: value?.trim() } : {}) },
      metadata: { roomId, action },
      ip: getClientIp(request),
    });

    return NextResponse.json({ success: true, action, roomId });
  } catch (err: any) {
    console.error('[admin/voice/manage POST] Error:', err);
    return NextResponse.json({ error: 'Failed to execute room action' }, { status: 500 });
  }
}
